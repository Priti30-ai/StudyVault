import { Router } from 'express';
import {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument
} from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce authentication on all document routes
router.use(authMiddleware);

/**
 * @route   POST /api/documents
 * @desc    Create a new document metadata record
 * @access  Private
 */
router.post('/', createDocument);

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
 * @route   PUT /api/documents/:id
 * @desc    Update document metadata
 * @access  Private
 */
router.put('/:id', updateDocument);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document metadata record
 * @access  Private
 */
router.delete('/:id', deleteDocument);

export default router;
