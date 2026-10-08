import path from 'path';
import mongoose from 'mongoose';
import Document, { ALLOWED_CATEGORIES } from '../models/Document.js';
import s3Service from '../services/s3Service.js';
import activityService from '../services/activityService.js';

/**
 * Escapes regular expression special characters to prevent regex injection
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Parses and normalizes tags from either string or array input
 */
const normalizeTagsInput = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))];
  }
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((t) => String(t).trim()).filter(Boolean))];
      }
    } catch {
      // Not JSON, treat as comma-separated values
    }
    return [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))];
  }
  return [];
};

/**
 * Upload document file to S3 and save metadata in MongoDB
 * @route POST /api/documents
 * @access Private
 */
export const createDocument = async (req, res, next) => {
  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }

    const { subject, semester, category, tags } = req.body;

    // Validate metadata fields
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required'
      });
    }

    if (!semester || typeof semester !== 'string' || !semester.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Semester is required'
      });
    }

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category is required and must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    const originalFileName = path.basename(req.file.originalname).trim() || 'document.pdf';
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;
    const fileType = path.extname(originalFileName).replace('.', '').toLowerCase();
    const normalizedTags = normalizeTagsInput(tags);

    // Step 1: Upload binary file to AWS S3
    let uploadResult;
    try {
      uploadResult = await s3Service.uploadFile({
        fileBuffer: req.file.buffer,
        originalFileName,
        mimeType,
        userId: req.userId
      });
    } catch (s3Error) {
      console.error('S3 Upload Error:', s3Error);
      return res.status(500).json({
        success: false,
        message: 'File upload to storage failed'
      });
    }

    // Step 2: Create MongoDB document record
    let document;
    try {
      document = await Document.create({
        userId: req.userId,
        originalFileName,
        s3Key: uploadResult.s3Key,
        fileType,
        mimeType,
        fileSize,
        subject: subject.trim(),
        semester: semester.trim(),
        category,
        tags: normalizedTags
      });
    } catch (dbError) {
      // Rollback: delete S3 object to prevent orphaned storage files
      try {
        await s3Service.deleteFile(uploadResult.s3Key);
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 object after DB error:', cleanupError);
      }
      throw dbError;
    }

    // Record UPLOAD activity (failure will not disrupt successful upload)
    await activityService.createActivity({
      userId: req.userId,
      documentId: document._id,
      action: 'UPLOAD',
      fileName: document.originalFileName
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List documents for authenticated user with search, filter, and pagination
 * @route GET /api/documents
 * @access Private
 */
export const getDocuments = async (req, res, next) => {
  try {
    const { search, subject, semester, category, favorite, page = 1, limit = 10 } = req.query;

    const queryFilter = {
      userId: req.userId
    };

    if (favorite === 'true') {
      queryFilter.isFavorite = true;
    } else if (favorite === 'false') {
      queryFilter.isFavorite = false;
    }

    if (subject && typeof subject === 'string' && subject.trim()) {
      const cleanSubject = subject.trim().slice(0, 100);
      queryFilter.subject = new RegExp(`^${escapeRegex(cleanSubject)}$`, 'i');
    }

    if (semester && typeof semester === 'string' && semester.trim()) {
      queryFilter.semester = semester.trim().slice(0, 50);
    }

    if (category && typeof category === 'string' && category.trim()) {
      const cleanCat = category.trim();
      if (ALLOWED_CATEGORIES.includes(cleanCat)) {
        queryFilter.category = cleanCat;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const cleanSearch = search.trim().slice(0, 100);
      const searchRegex = new RegExp(escapeRegex(cleanSearch), 'i');
      queryFilter.$or = [
        { originalFileName: searchRegex },
        { subject: searchRegex },
        { tags: searchRegex }
      ];
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const rawLimit = parseInt(limit, 10);
    const parsedLimit = isNaN(rawLimit) || rawLimit <= 0 ? 10 : Math.min(50, rawLimit);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await Document.countDocuments(queryFilter);
    const documents = await Document.find(queryFilter)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const totalPages = total === 0 ? 0 : Math.ceil(total / parsedLimit);

    return res.status(200).json({
      success: true,
      message: 'Documents retrieved successfully',
      data: {
        documents,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single document by ID belonging to authenticated user
 * @route GET /api/documents/:id
 * @access Private
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document retrieved successfully',
      data: {
        document
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a temporary presigned download URL for a document file
 * @route GET /api/documents/:id/download
 * @access Private
 */
export const getDownloadUrl = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Ownership verification: query by both documentId and req.userId
    const document = await Document.findOne({
      _id: id,
      userId: req.userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (!document.s3Key) {
      return res.status(404).json({
        success: false,
        message: 'File not found for this document'
      });
    }

    const expiresIn = 300; // 5 minutes
    const downloadUrl = await s3Service.generateDownloadUrl(document.s3Key, expiresIn);

    // Record DOWNLOAD activity
    await activityService.createActivity({
      userId: req.userId,
      documentId: document._id,
      action: 'DOWNLOAD',
      fileName: document.originalFileName
    });

    return res.status(200).json({
      success: true,
      message: 'Download URL generated successfully',
      data: {
        downloadUrl,
        expiresIn
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update document metadata
 * @route PUT /api/documents/:id
 * @access Private
 */
export const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const { originalFileName, subject, semester, category, tags } = req.body;

    if (originalFileName !== undefined) {
      if (typeof originalFileName !== 'string' || !originalFileName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Original file name cannot be empty'
        });
      }
      const cleanName = path.basename(originalFileName.trim());
      if (cleanName.length > 255) {
        return res.status(400).json({
          success: false,
          message: 'Original file name cannot exceed 255 characters'
        });
      }
      document.originalFileName = cleanName;
    }

    if (subject !== undefined) {
      if (typeof subject !== 'string' || !subject.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subject cannot be empty'
        });
      }
      const cleanSubject = subject.trim();
      if (cleanSubject.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Subject cannot exceed 100 characters'
        });
      }
      document.subject = cleanSubject;
    }

    if (semester !== undefined) {
      if (typeof semester !== 'string' || !semester.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Semester cannot be empty'
        });
      }
      const cleanSemester = semester.trim();
      if (cleanSemester.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Semester cannot exceed 50 characters'
        });
      }
      document.semester = cleanSemester;
    }

    if (category !== undefined) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
        });
      }
      document.category = category;
    }

    if (tags !== undefined) {
      document.tags = normalizeTagsInput(tags);
    }

    await document.save();

    // Record UPDATE activity
    await activityService.createActivity({
      userId: req.userId,
      documentId: document._id,
      action: 'UPDATE',
      fileName: document.originalFileName
    });

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: {
        document
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete document metadata and corresponding S3 storage object
 * @route DELETE /api/documents/:id
 * @access Private
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Preserve document metadata before deletion for activity logging
    const documentId = document._id;
    const fileName = document.originalFileName;
    const userId = document.userId;

    // Delete S3 object if present
    if (document.s3Key) {
      try {
        await s3Service.deleteFile(document.s3Key);
      } catch (s3Error) {
        console.error('Error deleting S3 file:', s3Error);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete file from storage'
        });
      }
    }

    // Delete MongoDB metadata
    await Document.deleteOne({ _id: id, userId: req.userId });

    // Record DELETE activity (only after deletion succeeds)
    await activityService.createActivity({
      userId,
      documentId,
      action: 'DELETE',
      fileName
    });

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle favorite status of a document
 * @route PATCH /api/documents/:id/favorite
 * @access Private
 */
export const toggleFavorite = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const newFavoriteState = !document.isFavorite;
    document.isFavorite = newFavoriteState;
    await document.save();

    const action = newFavoriteState ? 'FAVORITE' : 'UNFAVORITE';
    const message = newFavoriteState
      ? 'Document favorited successfully'
      : 'Document unfavorited successfully';

    // Record activity non-blockingly
    await activityService.createActivity({
      userId: req.userId,
      documentId: document._id,
      action,
      fileName: document.originalFileName
    });

    return res.status(200).json({
      success: true,
      message,
      data: {
        document
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createDocument,
  getDocuments,
  getDocumentById,
  getDownloadUrl,
  updateDocument,
  deleteDocument,
  toggleFavorite
};
