import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import Activity from '../src/models/Activity.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyvault_test';

describe('Dashboard Analytics Suite', () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'studyvault_test_jwt_secret_key';
    process.env.JWT_EXPIRES_IN = '1d';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Activity.deleteMany({});
      await Document.deleteMany({});
      await User.deleteMany({});
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Activity.deleteMany({});
    await Document.deleteMany({});
    await User.deleteMany({});

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dashboard User Alpha',
        email: 'dash_alpha@example.com',
        password: 'Password123'
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dashboard User Beta',
        email: 'dash_beta@example.com',
        password: 'Password123'
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user.id;
  });

  describe('Authentication', () => {
    test('unauthenticated request to GET /api/dashboard/stats returns 401', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  describe('Empty User Dashboard', () => {
    test('newly registered user receives zeroed overview metrics and empty arrays', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Dashboard statistics fetched successfully');

      const { overview, byCategory, bySubject, bySemester, recentDocuments, recentActivity } =
        res.body.data;

      assert.deepEqual(overview, {
        totalDocuments: 0,
        totalStorageBytes: 0,
        totalFavorites: 0
      });
      assert.deepEqual(byCategory, []);
      assert.deepEqual(bySubject, []);
      assert.deepEqual(bySemester, []);
      assert.deepEqual(recentDocuments, []);
      assert.deepEqual(recentActivity, []);
    });
  });

  describe('Overview Metrics & Storage Aggregation', () => {
    test('calculates correct totalDocuments, totalStorageBytes, and totalFavorites', async () => {
      // Create 3 documents for User A with varying sizes and favorite statuses
      await Document.create([
        {
          userId: userAId,
          originalFileName: 'Doc1.pdf',
          s3Key: 'users/1/doc1.pdf',
          fileSize: 1000,
          subject: 'DBMS',
          semester: '3',
          category: 'Notes',
          isFavorite: true
        },
        {
          userId: userAId,
          originalFileName: 'Doc2.pdf',
          s3Key: 'users/1/doc2.pdf',
          fileSize: 2000,
          subject: 'OS',
          semester: '4',
          category: 'Assignment',
          isFavorite: false
        },
        {
          userId: userAId,
          originalFileName: 'Doc3.pdf',
          s3Key: 'users/1/doc3.pdf',
          fileSize: 3000,
          subject: 'CN',
          semester: '5',
          category: 'Notes',
          isFavorite: true
        }
      ]);

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const { overview } = res.body.data;

      assert.equal(overview.totalDocuments, 3);
      assert.equal(overview.totalStorageBytes, 6000);
      assert.equal(overview.totalFavorites, 2);
    });

    test('treats missing or null fileSize as 0 in totalStorageBytes', async () => {
      await Document.create({
        userId: userAId,
        originalFileName: 'DocNoSize.pdf',
        s3Key: 'users/1/nosize.pdf',
        fileSize: null,
        subject: 'Algorithms',
        semester: '3',
        category: 'Notes'
      });

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.overview.totalDocuments, 1);
      assert.equal(res.body.data.overview.totalStorageBytes, 0);
    });
  });

  describe('Category, Subject, and Semester Analytics', () => {
    beforeEach(async () => {
      // Seed User A data
      await Document.create([
        {
          userId: userAId,
          originalFileName: 'Notes1.pdf',
          s3Key: 'users/1/n1.pdf',
          fileSize: 500,
          subject: 'DBMS',
          semester: '3',
          category: 'Notes'
        },
        {
          userId: userAId,
          originalFileName: 'Notes2.pdf',
          s3Key: 'users/1/n2.pdf',
          fileSize: 600,
          subject: 'DBMS',
          semester: '3',
          category: 'Notes'
        },
        {
          userId: userAId,
          originalFileName: 'Assign1.pdf',
          s3Key: 'users/1/a1.pdf',
          fileSize: 700,
          subject: 'OS',
          semester: '4',
          category: 'Assignment'
        }
      ]);

      // Seed User B data (should NOT bleed into User A)
      await Document.create([
        {
          userId: userBId,
          originalFileName: 'UserB_Notes.pdf',
          s3Key: 'users/2/b.pdf',
          fileSize: 9999,
          subject: 'Physics',
          semester: '1',
          category: 'Practical'
        }
      ]);
    });

    test('groups categories sorted descending without User B categories', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const { byCategory } = res.body.data;

      assert.equal(byCategory.length, 2);
      assert.deepEqual(byCategory[0], { category: 'Notes', count: 2 });
      assert.deepEqual(byCategory[1], { category: 'Assignment', count: 1 });
    });

    test('groups subjects sorted descending without User B subjects', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const { bySubject } = res.body.data;

      assert.equal(bySubject.length, 2);
      assert.deepEqual(bySubject[0], { subject: 'DBMS', count: 2 });
      assert.deepEqual(bySubject[1], { subject: 'OS', count: 1 });
    });

    test('groups semesters sorted descending without User B semesters', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const { bySemester } = res.body.data;

      assert.equal(bySemester.length, 2);
      assert.deepEqual(bySemester[0], { semester: '3', count: 2 });
      assert.deepEqual(bySemester[1], { semester: '4', count: 1 });
    });
  });

  describe('Recent Documents', () => {
    test('returns up to 5 newest documents, sorted descending, excluding s3Key', async () => {
      const docs = [];
      for (let i = 1; i <= 7; i++) {
        docs.push({
          userId: userAId,
          originalFileName: `Doc_${i}.pdf`,
          s3Key: `users/1/secret_key_${i}.pdf`,
          fileSize: 100 * i,
          mimeType: 'application/pdf',
          subject: 'Mathematics',
          semester: '1',
          category: 'Notes',
          isFavorite: i % 2 === 0,
          uploadedAt: new Date(Date.now() + i * 1000)
        });
      }
      await Document.create(docs);

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const { recentDocuments } = res.body.data;

      assert.equal(recentDocuments.length, 5);
      // Newest first: Doc_7, Doc_6, Doc_5, Doc_4, Doc_3
      assert.equal(recentDocuments[0].originalFileName, 'Doc_7.pdf');
      assert.equal(recentDocuments[1].originalFileName, 'Doc_6.pdf');
      assert.equal(recentDocuments[4].originalFileName, 'Doc_3.pdf');

      // Security: verify s3Key is NEVER exposed
      recentDocuments.forEach((doc) => {
        assert.ok(doc.id, 'Document must have id');
        assert.ok(doc.originalFileName, 'Document must have originalFileName');
        assert.equal(doc.s3Key, undefined, 's3Key must NOT be exposed in dashboard response');
      });
    });
  });

  describe('Recent Activity', () => {
    test('returns up to 5 newest activities, sorted descending, isolated to user', async () => {
      // Create 6 activities for User A
      const actsA = [];
      const actions = ['UPLOAD', 'DOWNLOAD', 'FAVORITE', 'UPDATE', 'UNFAVORITE', 'DELETE'];
      for (let i = 0; i < 6; i++) {
        actsA.push({
          userId: userAId,
          documentId: new mongoose.Types.ObjectId(),
          fileName: `File_${i}.pdf`,
          action: actions[i],
          createdAt: new Date(Date.now() + i * 2000)
        });
      }
      await Activity.create(actsA);

      // Create activity for User B
      await Activity.create({
        userId: userBId,
        documentId: new mongoose.Types.ObjectId(),
        fileName: 'UserB_File.pdf',
        action: 'UPLOAD',
        createdAt: new Date(Date.now() + 50000)
      });

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const { recentActivity } = res.body.data;

      assert.equal(recentActivity.length, 5);
      // Newest first: File_5 (DELETE), File_4 (UNFAVORITE)...
      assert.equal(recentActivity[0].fileName, 'File_5.pdf');
      assert.equal(recentActivity[0].action, 'DELETE');
      assert.equal(recentActivity[1].fileName, 'File_4.pdf');

      // Ensure User B's activity is not present
      recentActivity.forEach((act) => {
        assert.notEqual(act.fileName, 'UserB_File.pdf');
        assert.ok(act.id);
        assert.ok(act.action);
      });
    });
  });

  describe('Multi-User Multi-Tenant Isolation', () => {
    test('strictly isolates all metrics between User A and User B', async () => {
      // User A: 5 documents, 2 favorites, total 10000 bytes
      await Document.create([
        {
          userId: userAId,
          originalFileName: 'A1.pdf',
          s3Key: 'a1',
          fileSize: 2000,
          subject: 'DBMS',
          semester: '3',
          category: 'Notes',
          isFavorite: true
        },
        {
          userId: userAId,
          originalFileName: 'A2.pdf',
          s3Key: 'a2',
          fileSize: 2000,
          subject: 'DBMS',
          semester: '3',
          category: 'Notes',
          isFavorite: true
        },
        {
          userId: userAId,
          originalFileName: 'A3.pdf',
          s3Key: 'a3',
          fileSize: 2000,
          subject: 'OS',
          semester: '4',
          category: 'Assignment',
          isFavorite: false
        },
        {
          userId: userAId,
          originalFileName: 'A4.pdf',
          s3Key: 'a4',
          fileSize: 2000,
          subject: 'OS',
          semester: '4',
          category: 'Assignment',
          isFavorite: false
        },
        {
          userId: userAId,
          originalFileName: 'A5.pdf',
          s3Key: 'a5',
          fileSize: 2000,
          subject: 'CN',
          semester: '5',
          category: 'Reference',
          isFavorite: false
        }
      ]);

      // User B: 2 documents, 1 favorite, total 5000 bytes
      await Document.create([
        {
          userId: userBId,
          originalFileName: 'B1.pdf',
          s3Key: 'b1',
          fileSize: 2500,
          subject: 'AI',
          semester: '6',
          category: 'PPT',
          isFavorite: true
        },
        {
          userId: userBId,
          originalFileName: 'B2.pdf',
          s3Key: 'b2',
          fileSize: 2500,
          subject: 'ML',
          semester: '6',
          category: 'Notes',
          isFavorite: false
        }
      ]);

      // Query User A dashboard
      const resA = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(resA.status, 200);
      assert.equal(resA.body.data.overview.totalDocuments, 5);
      assert.equal(resA.body.data.overview.totalFavorites, 2);
      assert.equal(resA.body.data.overview.totalStorageBytes, 10000);
      assert.equal(resA.body.data.byCategory.length, 3);
      assert.equal(resA.body.data.bySubject.length, 3);
      assert.equal(resA.body.data.bySemester.length, 3);

      // Query User B dashboard
      const resB = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(resB.status, 200);
      assert.equal(resB.body.data.overview.totalDocuments, 2);
      assert.equal(resB.body.data.overview.totalFavorites, 1);
      assert.equal(resB.body.data.overview.totalStorageBytes, 5000);
      assert.equal(resB.body.data.byCategory.length, 2);
      assert.equal(resB.body.data.bySubject.length, 2);
      assert.equal(resB.body.data.bySemester.length, 1);
    });
  });
});
