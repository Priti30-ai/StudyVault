import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce JWT authentication on all dashboard routes
router.use(authMiddleware);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get aggregated dashboard metrics and analytics for authenticated student
 * @access  Private
 */
router.get('/stats', getDashboardStats);

export default router;
