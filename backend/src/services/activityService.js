import Activity, { ALLOWED_ACTIONS } from '../models/Activity.js';

/**
 * Creates an activity log entry for a user action.
 * Gracefully catches errors to avoid failing the main business operation.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - Authenticated user ID
 * @param {string|mongoose.Types.ObjectId} params.documentId - Document ID
 * @param {string} params.action - Activity action type (UPLOAD, DOWNLOAD, etc.)
 * @param {string} [params.fileName] - Original document file name
 * @returns {Promise<Activity|null>}
 */
export const createActivity = async ({ userId, documentId, action, fileName }) => {
  try {
    if (!ALLOWED_ACTIONS.includes(action)) {
      console.warn(`[ActivityService] Invalid activity action: ${action}`);
      return null;
    }

    const activity = await Activity.create({
      userId,
      documentId,
      action,
      fileName: fileName || null
    });

    return activity;
  } catch (error) {
    console.error(`[ActivityService] Failed to record ${action} activity:`, error.message);
    // Non-blocking: Do not disrupt primary operation
    return null;
  }
};

export default {
  createActivity
};
