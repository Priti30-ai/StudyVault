import { Router } from 'express';
import {
  createDocument,
  getDocuments,
  getDocumentById,
  getDownloadUrl,
  updateDocument,
  deleteDocument,
  toggleFavorite
} from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

// Enforce authentication on all document routes
router.use(authMiddleware);

/**
 * @route   POST /api/documents
 * @desc    Upload document file to S3 and save metadata in MongoDB
 * @access  Private
 */
router.post('/', upload.single('file'), createDocument);

/**
 * @route   GET /api/documents
 * @desc    Get user documents with search, filters, and pagination
 * @access  Private
 */
router.get('/', getDocuments);

/**
 * @route   GET /api/documents/:id
 * @desc    Get a single document by ID
 * @access  Private
 */
router.get('/:id', getDocumentById);

/**
 * @route   GET /api/documents/:id/download
 * @desc    Generate a presigned S3 download URL
 * @access  Private
 */
router.get('/:id/download', getDownloadUrl);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document metadata
 * @access  Private
 */
router.put('/:id', updateDocument);

/**
 * @route   PATCH /api/documents/:id/favorite
 * @desc    Toggle document favorite status
 * @access  Private
 */
router.patch('/:id/favorite', toggleFavorite);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document from MongoDB and S3
 * @access  Private
 */
router.delete('/:id', deleteDocument);

export default router;
