import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import Activity from '../src/models/Activity.js';
import { setS3Mock, generateS3Key } from '../src/services/s3Service.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyvault_test';

describe('Activity Tracking and Document Favorites Suite', () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  const mockS3Storage = new Map();

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'studyvault_test_jwt_secret_key';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.AWS_S3_BUCKET = 'studyvault-test-bucket';

    // Configure S3 mock for automated test environment
    setS3Mock({
      uploadFile: async ({ fileBuffer, originalFileName, mimeType, userId }) => {
        const s3Key = generateS3Key(userId, originalFileName);
        mockS3Storage.set(s3Key, { fileBuffer, mimeType, originalFileName });
        return { s3Key, bucket: 'studyvault-test-bucket' };
      },
      deleteFile: async (s3Key) => {
        mockS3Storage.delete(s3Key);
        return { success: true };
      },
      generateDownloadUrl: async (s3Key, expiresIn = 300) => {
        return `https://studyvault-test-bucket.s3.ap-south-1.amazonaws.com/${s3Key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mockSig`;
      }
    });

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  after(async () => {
    setS3Mock(null);
    if (mongoose.connection.readyState !== 0) {
      await Activity.deleteMany({});
      await Document.deleteMany({});
      await User.deleteMany({});
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    mockS3Storage.clear();
    await Activity.deleteMany({});
    await Document.deleteMany({});
    await User.deleteMany({});

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Alpha',
        email: 'alpha@example.com',
        password: 'Password123'
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Beta',
        email: 'beta@example.com',
        password: 'Password123'
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user.id;
  });

  // Helper to create a document for User A
  const uploadDocForUserA = async (fileName = 'Operating_Systems_Notes.pdf') => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('subject', 'OS')
      .field('semester', '4')
      .field('category', 'Notes')
      .field('tags', 'kernel,scheduling')
      .attach('file', Buffer.from('%PDF-1.4 test os content'), {
        filename: fileName,
        contentType: 'application/pdf'
      });
    return res.body.data.document;
  };

  describe('Activity Model Unit Tests', () => {
    test('valid activity creation succeeds with all required fields', async () => {
      const activity = await Activity.create({
        userId: userAId,
        documentId: new mongoose.Types.ObjectId(),
        action: 'UPLOAD',
        fileName: 'test.pdf'
      });

      assert.ok(activity._id);
      assert.equal(activity.action, 'UPLOAD');
      assert.equal(activity.fileName, 'test.pdf');
      assert.ok(activity.createdAt instanceof Date);
    });

    test('invalid action is rejected by Mongoose schema validation', async () => {
      await assert.rejects(
        async () => {
          await Activity.create({
            userId: userAId,
            documentId: new mongoose.Types.ObjectId(),
            action: 'INVALID_ACTION',
            fileName: 'test.pdf'
          });
        },
        /is not a valid activity action/
      );
    });

    test('VIEW or LOGIN actions are rejected as unallowed enum values', async () => {
      await assert.rejects(
        async () => {
          await Activity.create({
            userId: userAId,
            documentId: new mongoose.Types.ObjectId(),
            action: 'VIEW',
            fileName: 'test.pdf'
          });
        },
        /is not a valid activity action/
      );
    });
  });

  describe('Document Favorite / Unfavorite API', () => {
    test('authenticated user can favorite and then unfavorite a document', async () => {
      const doc = await uploadDocForUserA();
      assert.equal(doc.isFavorite, false);

      // 1. Favorite the document
      const favRes = await request(app)
        .patch(`/api/documents/${doc.id}/favorite`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(favRes.status, 200);
      assert.equal(favRes.body.success, true);
      assert.equal(favRes.body.message, 'Document favorited successfully');
      assert.equal(favRes.body.data.document.isFavorite, true);

      // Verify FAVORITE activity was recorded
      const favActivity = await Activity.findOne({
        userId: userAId,
        documentId: doc.id,
        action: 'FAVORITE'
      });
      assert.ok(favActivity, 'FAVORITE activity should exist');
      assert.equal(favActivity.fileName, 'Operating_Systems_Notes.pdf');

      // 2. Unfavorite the document
      const unfavRes = await request(app)
        .patch(`/api/documents/${doc.id}/favorite`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(unfavRes.status, 200);
      assert.equal(unfavRes.body.success, true);
      assert.equal(unfavRes.body.message, 'Document unfavorited successfully');
      assert.equal(unfavRes.body.data.document.isFavorite, false);

      // Verify UNFAVORITE activity was recorded
      const unfavActivity = await Activity.findOne({
        userId: userAId,
        documentId: doc.id,
        action: 'UNFAVORITE'
      });
      assert.ok(unfavActivity, 'UNFAVORITE activity should exist');
    });

    test('unauthenticated favorite request is rejected with 401', async () => {
      const doc = await uploadDocForUserA();

      const res = await request(app)
        .patch(`/api/documents/${doc.id}/favorite`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('invalid document ID format returns 404', async () => {
      const res = await request(app)
        .patch('/api/documents/invalid-mongo-id/favorite')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');
    });

    test('User B cannot favorite User A document (returns 404, no activity created)', async () => {
      const doc = await uploadDocForUserA();

      const res = await request(app)
        .patch(`/api/documents/${doc.id}/favorite`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');

      // Verify no activity was logged for User B
      const userBActivities = await Activity.find({ userId: userBId });
      assert.equal(userBActivities.length, 0);

      // Verify document is still not favorite
      const freshDoc = await Document.findById(doc.id);
      assert.equal(freshDoc.isFavorite, false);
    });

    test('documents can be filtered by favorite query parameter in GET /api/documents', async () => {
      const doc1 = await uploadDocForUserA('Doc1.pdf');
      await uploadDocForUserA('Doc2.pdf');

      // Favorite Doc 1
      await request(app)
        .patch(`/api/documents/${doc1.id}/favorite`)
        .set('Authorization', `Bearer ${userAToken}`);

      const res = await request(app)
        .get('/api/documents?favorite=true')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 1);
      assert.equal(res.body.data.documents[0].originalFileName, 'Doc1.pdf');
    });
  });

  describe('Document Action Activity Generation', () => {
    test('successful upload creates an UPLOAD activity', async () => {
      const doc = await uploadDocForUserA('Network_Security.pdf');

      const activity = await Activity.findOne({
        userId: userAId,
        documentId: doc.id,
        action: 'UPLOAD'
      });

      assert.ok(activity);
      assert.equal(activity.fileName, 'Network_Security.pdf');
      assert.equal(activity.action, 'UPLOAD');
    });

    test('failed upload does not create an activity', async () => {
      // Attempt upload without required subject
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('semester', '4')
        .field('category', 'Notes')
        .attach('file', Buffer.from('%PDF-1.4 test content'), 'test.pdf');

      assert.equal(res.status, 400);

      const activityCount = await Activity.countDocuments({ userId: userAId });
      assert.equal(activityCount, 0);
    });

    test('successful download URL generation creates a DOWNLOAD activity', async () => {
      const doc = await uploadDocForUserA();

      const res = await request(app)
        .get(`/api/documents/${doc.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);

      const downloadActivity = await Activity.findOne({
        userId: userAId,
        documentId: doc.id,
        action: 'DOWNLOAD'
      });

      assert.ok(downloadActivity);
      assert.equal(downloadActivity.fileName, 'Operating_Systems_Notes.pdf');
    });

    test('unauthorized download attempt does not create an activity', async () => {
      const doc = await uploadDocForUserA();

      // User B tries to download User A's document
      const res = await request(app)
        .get(`/api/documents/${doc.id}/download`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);

      const downloadActivity = await Activity.findOne({
        userId: userBId,
        action: 'DOWNLOAD'
      });
      assert.equal(downloadActivity, null);
    });

    test('successful metadata update creates an UPDATE activity', async () => {
      const doc = await uploadDocForUserA();

      const res = await request(app)
        .put(`/api/documents/${doc.id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          subject: 'Advanced OS',
          category: 'Reference'
        });

      assert.equal(res.status, 200);

      const updateActivity = await Activity.findOne({
        userId: userAId,
        documentId: doc.id,
        action: 'UPDATE'
      });

      assert.ok(updateActivity);
      assert.equal(updateActivity.fileName, 'Operating_Systems_Notes.pdf');
    });

    test('failed metadata update does not create an activity', async () => {
      const doc = await uploadDocForUserA();

      // Send invalid category
      const res = await request(app)
        .put(`/api/documents/${doc.id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'NonExistentCategory'
        });

      assert.equal(res.status, 400);

      const updateActivity = await Activity.findOne({
        userId: userAId,
        action: 'UPDATE'
      });
      assert.equal(updateActivity, null);
    });

    test('successful deletion creates a DELETE activity and activity remains after Document is deleted', async () => {
      const doc = await uploadDocForUserA('Compiler_Design.pdf');

      const delRes = await request(app)
        .delete(`/api/documents/${doc.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(delRes.status, 200);

      // Ensure MongoDB document is deleted
      const docInDb = await Document.findById(doc.id);
      assert.equal(docInDb, null);

      // Verify DELETE activity exists and persists
      const deleteActivity = await Activity.findOne({
        userId: userAId,
        documentId: doc.id,
        action: 'DELETE'
      });

      assert.ok(deleteActivity);
      assert.equal(deleteActivity.fileName, 'Compiler_Design.pdf');
      assert.equal(deleteActivity.action, 'DELETE');
    });

    test('failed deletion does not create a DELETE activity', async () => {
      const doc = await uploadDocForUserA();

      // User B attempts to delete User A doc
      const delRes = await request(app)
        .delete(`/api/documents/${doc.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(delRes.status, 404);

      const deleteActivity = await Activity.findOne({
        userId: userBId,
        action: 'DELETE'
      });
      assert.equal(deleteActivity, null);
    });
  });

  describe('Activity History API (GET /api/activity)', () => {
    test('returns authenticated user activities sorted newest first with pagination', async () => {
      const doc = await uploadDocForUserA('Maths_Module.pdf');

      // Trigger DOWNLOAD
      await request(app)
        .get(`/api/documents/${doc.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Trigger FAVORITE
      await request(app)
        .patch(`/api/documents/${doc.id}/favorite`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Fetch activity
      const res = await request(app)
        .get('/api/activity?page=1&limit=10')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Activity fetched successfully');
      assert.ok(Array.isArray(res.body.data.activities));
      assert.equal(res.body.data.activities.length, 3); // UPLOAD, DOWNLOAD, FAVORITE

      // Ensure newest first
      assert.equal(res.body.data.activities[0].action, 'FAVORITE');
      assert.equal(res.body.data.activities[1].action, 'DOWNLOAD');
      assert.equal(res.body.data.activities[2].action, 'UPLOAD');

      // Verify pagination object
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 10);
      assert.equal(res.body.data.pagination.total, 3);
      assert.equal(res.body.data.pagination.pages, 1);
    });

    test('pagination slice works as expected', async () => {
      const doc = await uploadDocForUserA('Algo_Notes.pdf');

      await request(app)
        .get(`/api/documents/${doc.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);

      await request(app)
        .patch(`/api/documents/${doc.id}/favorite`)
        .set('Authorization', `Bearer ${userAToken}`);

      const res = await request(app)
        .get('/api/activity?page=1&limit=2')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.activities.length, 2);
      assert.equal(res.body.data.pagination.total, 3);
      assert.equal(res.body.data.pagination.pages, 2);
    });

    test('User B never sees User A activities', async () => {
      await uploadDocForUserA('Secret_Paper.pdf');

      const resB = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(resB.status, 200);
      assert.equal(resB.body.data.activities.length, 0);
      assert.equal(resB.body.data.pagination.total, 0);
    });

    test('action query filter returns only activities with matching action', async () => {
      const doc = await uploadDocForUserA('Database_Lab.pdf');

      await request(app)
        .get(`/api/documents/${doc.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);

      const res = await request(app)
        .get('/api/activity?action=DOWNLOAD')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.activities.length, 1);
      assert.equal(res.body.data.activities[0].action, 'DOWNLOAD');
      assert.equal(res.body.data.activities[0].fileName, 'Database_Lab.pdf');
    });

    test('invalid action query filter returns 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/activity?action=NOT_AN_ACTION')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid action filter/);
    });

    test('unauthenticated request to /api/activity returns 401', async () => {
      const res = await request(app).get('/api/activity');
      assert.equal(res.status, 401);
    });
  });
});
