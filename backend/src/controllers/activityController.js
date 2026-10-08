import Activity, { ALLOWED_ACTIONS } from '../models/Activity.js';

/**
 * Get user activity history with pagination and optional action filtering
 * @route GET /api/activity
 * @access Private
 */
export const getActivity = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, action } = req.query;

    const queryFilter = {
      userId: req.userId
    };

    if (action !== undefined) {
      const normalizedAction = String(action).trim().toUpperCase();
      if (!ALLOWED_ACTIONS.includes(normalizedAction)) {
        return res.status(400).json({
          success: false,
          message: `Invalid action filter. Allowed actions: ${ALLOWED_ACTIONS.join(', ')}`
        });
      }
      queryFilter.action = normalizedAction;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await Activity.countDocuments(queryFilter);
    const activities = await Activity.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const pages = total === 0 ? 0 : Math.ceil(total / parsedLimit);

    return res.status(200).json({
      success: true,
      message: 'Activity fetched successfully',
      data: {
        activities,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          pages,
          totalPages: pages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getActivity
};
