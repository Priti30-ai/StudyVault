import mongoose from 'mongoose';
import Document, { ALLOWED_CATEGORIES } from '../models/Document.js';

/**
 * Escapes regular expression special characters to prevent regex injection
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Create a new document metadata record
 * @route POST /api/documents
 * @access Private
 */
export const createDocument = async (req, res, next) => {
  try {
    const {
      originalFileName,
      subject,
      semester,
      category,
      tags,
      fileType,
      mimeType,
      fileSize,
      s3Key
    } = req.body;

    // Validate required fields
    if (!originalFileName || typeof originalFileName !== 'string' || !originalFileName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Original file name is required'
      });
    }

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

    // Validate tags if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Tags must be an array of strings'
      });
    }

    // Clean and normalize tags
    const normalizedTags = Array.isArray(tags)
      ? [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))]
      : [];

    // Create document scoped to authenticated user
    const document = await Document.create({
      userId: req.userId,
      originalFileName: originalFileName.trim(),
      subject: subject.trim(),
      semester: semester.trim(),
      category,
      tags: normalizedTags,
      fileType: fileType ? String(fileType).trim().toLowerCase() : null,
      mimeType: mimeType ? String(mimeType).trim().toLowerCase() : null,
      fileSize: typeof fileSize === 'number' ? fileSize : null,
      s3Key: s3Key ? String(s3Key).trim() : null
    });

    return res.status(201).json({
      success: true,
      message: 'Document created successfully',
      data: {
        document
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List documents for the authenticated user with search, filter, and pagination
 * @route GET /api/documents
 * @access Private
 */
export const getDocuments = async (req, res, next) => {
  try {
    const { search, subject, semester, category, page = 1, limit = 10 } = req.query;

    // Strict ownership boundary: filter by req.userId
    const queryFilter = {
      userId: req.userId
    };

    // Filter by subject
    if (subject && typeof subject === 'string' && subject.trim()) {
      queryFilter.subject = new RegExp(`^${escapeRegex(subject.trim())}$`, 'i');
    }

    // Filter by semester
    if (semester && typeof semester === 'string' && semester.trim()) {
      queryFilter.semester = semester.trim();
    }

    // Filter by category
    if (category && typeof category === 'string' && category.trim()) {
      queryFilter.category = category.trim();
    }

    // Search query across originalFileName, subject, and tags
    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      queryFilter.$or = [
        { originalFileName: searchRegex },
        { subject: searchRegex },
        { tags: searchRegex }
      ];
    }

    // Parse and bound pagination parameters
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // Fetch total and paginated documents
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

    // Validate and apply allowed modifications
    if (originalFileName !== undefined) {
      if (typeof originalFileName !== 'string' || !originalFileName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Original file name cannot be empty'
        });
      }
      document.originalFileName = originalFileName.trim();
    }

    if (subject !== undefined) {
      if (typeof subject !== 'string' || !subject.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subject cannot be empty'
        });
      }
      document.subject = subject.trim();
    }

    if (semester !== undefined) {
      if (typeof semester !== 'string' || !semester.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Semester cannot be empty'
        });
      }
      document.semester = semester.trim();
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
      if (!Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          message: 'Tags must be an array of strings'
        });
      }
      document.tags = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))];
    }

    await document.save();

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
 * Delete a document metadata record
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

    const document = await Document.findOneAndDelete({
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
      message: 'Document deleted successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument
};
