import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Activity from '../models/Activity.js';

/**
 * Fetch aggregated dashboard statistics for the authenticated student
 * @route GET /api/dashboard/stats
 * @access Private
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    // 1. Overview metrics: totalDocuments, totalStorageBytes, totalFavorites
    const overviewPromise = Document.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalStorageBytes: { $sum: { $ifNull: ['$fileSize', 0] } },
          totalFavorites: {
            $sum: {
              $cond: [{ $eq: ['$isFavorite', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    // 2. Category analytics: group by category, sorted descending
    const byCategoryPromise = Document.aggregate([
      {
        $match: {
          userId: userObjectId,
          category: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1
        }
      }
    ]);

    // 3. Subject analytics: group by subject, sorted descending
    const bySubjectPromise = Document.aggregate([
      {
        $match: {
          userId: userObjectId,
          subject: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          count: 1
        }
      }
    ]);

    // 4. Semester analytics: group by semester, sorted descending
    const bySemesterPromise = Document.aggregate([
      {
        $match: {
          userId: userObjectId,
          semester: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$semester',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          semester: '$_id',
          count: 1
        }
      }
    ]);

    // 5. Recent documents: top 5 latest uploaded documents (excluding s3Key)
    const recentDocumentsPromise = Document.find({ userId: userObjectId })
      .sort({ uploadedAt: -1 })
      .limit(5)
      .select('originalFileName subject semester category fileSize mimeType isFavorite uploadedAt')
      .lean();

    // 6. Recent activity: top 5 latest actions
    const recentActivityPromise = Activity.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('documentId fileName action createdAt')
      .lean();

    // Execute queries concurrently
    const [
      overviewResult,
      byCategory,
      bySubject,
      bySemester,
      recentDocs,
      recentActs
    ] = await Promise.all([
      overviewPromise,
      byCategoryPromise,
      bySubjectPromise,
      bySemesterPromise,
      recentDocumentsPromise,
      recentActivityPromise
    ]);

    // Format overview values
    const overview = {
      totalDocuments: overviewResult[0]?.totalDocuments || 0,
      totalStorageBytes: overviewResult[0]?.totalStorageBytes || 0,
      totalFavorites: overviewResult[0]?.totalFavorites || 0
    };

    // Format recent documents
    const recentDocuments = recentDocs.map((doc) => ({
      id: doc._id.toString(),
      originalFileName: doc.originalFileName,
      subject: doc.subject,
      semester: doc.semester,
      category: doc.category,
      fileSize: doc.fileSize ?? 0,
      mimeType: doc.mimeType,
      isFavorite: doc.isFavorite,
      uploadedAt: doc.uploadedAt
    }));

    // Format recent activities
    const recentActivity = recentActs.map((act) => ({
      id: act._id.toString(),
      documentId: act.documentId ? act.documentId.toString() : null,
      fileName: act.fileName,
      action: act.action,
      createdAt: act.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Dashboard statistics fetched successfully',
      data: {
        overview,
        byCategory: byCategory || [],
        bySubject: bySubject || [],
        bySemester: bySemester || [],
        recentDocuments,
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getDashboardStats
};
