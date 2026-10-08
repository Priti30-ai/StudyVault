import { Router } from 'express';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Service health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StudyVault API is healthy'
  });
});

export default router;
