import { Router } from 'express';
import { getActivity } from '../controllers/activityController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce JWT authentication on all activity routes
router.use(authMiddleware);

/**
 * @route   GET /api/activity
 * @desc    Get user activity log with pagination and optional action filtering
 * @access  Private
 */
router.get('/', getActivity);

export default router;
