import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyvault_test';

describe('Document CRUD and Ownership Suite', () => {
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
      await Document.deleteMany({});
      await User.deleteMany({});
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
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

  describe('POST /api/documents (Create)', () => {
    test('authenticated user can create document metadata', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'DBMS_Unit_3_Notes.pdf',
          subject: 'DBMS',
          semester: '3',
          category: 'Notes',
          tags: ['mongodb', 'sql', 'normalization'],
          fileType: 'pdf',
          mimeType: 'application/pdf',
          fileSize: 524288
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Document created successfully');
      assert.ok(res.body.data.document.id);
      assert.equal(res.body.data.document.originalFileName, 'DBMS_Unit_3_Notes.pdf');
      assert.equal(res.body.data.document.subject, 'DBMS');
      assert.equal(res.body.data.document.semester, '3');
      assert.equal(res.body.data.document.category, 'Notes');
      assert.deepEqual(res.body.data.document.tags, ['mongodb', 'sql', 'normalization']);
      assert.equal(res.body.data.document.userId, userAId);
    });

    test('ignores spoofed userId in request body and forces authenticated userId', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'Spoofed_Doc.pdf',
          subject: 'Security',
          semester: '4',
          category: 'Notes',
          userId: userBId // Attempt to assign to User B
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.document.userId, userAId);
      assert.notEqual(res.body.data.document.userId, userBId);
    });

    test('fails with 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({
          originalFileName: 'Unauth.pdf',
          subject: 'DBMS',
          semester: '3',
          category: 'Notes'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('fails with 400 when originalFileName is missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          subject: 'DBMS',
          semester: '3',
          category: 'Notes'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Original file name is required');
    });

    test('fails with 400 when subject is missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'Notes.pdf',
          semester: '3',
          category: 'Notes'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Subject is required');
    });

    test('fails with 400 when semester is missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'Notes.pdf',
          subject: 'DBMS',
          category: 'Notes'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Semester is required');
    });

    test('fails with 400 when category is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'Notes.pdf',
          subject: 'DBMS',
          semester: '3',
          category: 'InvalidCategoryName'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Category is required'));
    });
  });

  describe('GET /api/documents (List, Search, Filter, Pagination)', () => {
    beforeEach(async () => {
      // Seed User A documents
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'DBMS_Notes_Unit1.pdf',
          subject: 'DBMS',
          semester: '3',
          category: 'Notes',
          tags: ['sql', 'relational']
        });

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'OS_Practical_Guide.pdf',
          subject: 'Operating Systems',
          semester: '4',
          category: 'Practical',
          tags: ['linux', 'bash']
        });

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'DBMS_Assignment_1.docx',
          subject: 'DBMS',
          semester: '3',
          category: 'Assignment',
          tags: ['queries', 'joins']
        });

      // Seed User B document
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          originalFileName: 'UserB_Private_Paper.pdf',
          subject: 'DBMS',
          semester: '3',
          category: 'Question Paper',
          tags: ['exam']
        });
    });

    test('authenticated user receives only their own documents (User B doc excluded)', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.documents.length, 3);
      assert.equal(res.body.data.pagination.total, 3);

      const hasUserBDoc = res.body.data.documents.some(
        (doc) => doc.originalFileName === 'UserB_Private_Paper.pdf'
      );
      assert.equal(hasUserBDoc, false);
    });

    test('search filters documents across file name, subject, or tags', async () => {
      const res = await request(app)
        .get('/api/documents?search=linux')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 1);
      assert.equal(res.body.data.documents[0].originalFileName, 'OS_Practical_Guide.pdf');
    });

    test('subject filter works correctly', async () => {
      const res = await request(app)
        .get('/api/documents?subject=DBMS')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 2);
    });

    test('semester filter works correctly', async () => {
      const res = await request(app)
        .get('/api/documents?semester=4')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 1);
      assert.equal(res.body.data.documents[0].subject, 'Operating Systems');
    });

    test('category filter works correctly', async () => {
      const res = await request(app)
        .get('/api/documents?category=Assignment')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 1);
      assert.equal(res.body.data.documents[0].originalFileName, 'DBMS_Assignment_1.docx');
    });

    test('combined filters and search work together', async () => {
      const res = await request(app)
        .get('/api/documents?search=queries&subject=DBMS&semester=3&category=Assignment')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 1);
      assert.equal(res.body.data.documents[0].originalFileName, 'DBMS_Assignment_1.docx');
    });

    test('pagination returns correct page, limit, and slice of items', async () => {
      const res = await request(app)
        .get('/api/documents?page=1&limit=2')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 2);
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 2);
      assert.equal(res.body.data.pagination.total, 3);
      assert.equal(res.body.data.pagination.totalPages, 2);
    });
  });

  describe('GET /api/documents/:id (Single Document)', () => {
    let docAId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'UserA_Doc.pdf',
          subject: 'Math',
          semester: '1',
          category: 'Notes'
        });
      docAId = res.body.data.document.id;
    });

    test('owner can retrieve their document', async () => {
      const res = await request(app)
        .get(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.document.id, docAId);
      assert.equal(res.body.data.document.originalFileName, 'UserA_Doc.pdf');
    });

    test('User B cannot retrieve User A document (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Document not found');
    });

    test('returns 404 for invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/documents/invalid-id')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Document not found');
    });
  });

  describe('PUT /api/documents/:id (Update)', () => {
    let docAId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'Old_Name.pdf',
          subject: 'Old Subject',
          semester: '1',
          category: 'Notes',
          tags: ['old']
        });
      docAId = res.body.data.document.id;
    });

    test('owner can update allowed metadata fields', async () => {
      const res = await request(app)
        .put(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'New_Name.pdf',
          subject: 'New Subject',
          semester: '2',
          category: 'Reference',
          tags: ['new', 'updated']
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.document.originalFileName, 'New_Name.pdf');
      assert.equal(res.body.data.document.subject, 'New Subject');
      assert.equal(res.body.data.document.semester, '2');
      assert.equal(res.body.data.document.category, 'Reference');
      assert.deepEqual(res.body.data.document.tags, ['new', 'updated']);
    });

    test('protected fields cannot be modified via update', async () => {
      const originalDoc = await Document.findById(docAId);

      const res = await request(app)
        .put(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          userId: userBId, // Attempted ownership change
          s3Key: 'hacked-key',
          uploadedAt: new Date('2020-01-01')
        });

      assert.equal(res.status, 200);

      const updatedDoc = await Document.findById(docAId);
      assert.equal(updatedDoc.userId.toString(), userAId);
      assert.equal(updatedDoc.s3Key, null);
      assert.equal(
        new Date(updatedDoc.uploadedAt).toISOString(),
        new Date(originalDoc.uploadedAt).toISOString()
      );
    });

    test('User B cannot update User A document (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          originalFileName: 'Hacked_By_B.pdf'
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Document not found');
    });

    test('fails with 400 when updating category to invalid value', async () => {
      const res = await request(app)
        .put(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'NotACategory'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe('DELETE /api/documents/:id (Delete)', () => {
    let docAId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          originalFileName: 'Doc_To_Delete.pdf',
          subject: 'Algorithms',
          semester: '5',
          category: 'Notes'
        });
      docAId = res.body.data.document.id;
    });

    test('owner can delete document metadata', async () => {
      const res = await request(app)
        .delete(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Document deleted successfully');

      const found = await Document.findById(docAId);
      assert.equal(found, null);
    });

    test('User B cannot delete User A document (returns 404 and document remains)', async () => {
      const res = await request(app)
        .delete(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Document not found');

      const stillExists = await Document.findById(docAId);
      assert.ok(stillExists);
    });

    test('fails with 401 when unauthenticated', async () => {
      const res = await request(app).delete(`/api/documents/${docAId}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });
  });
});
