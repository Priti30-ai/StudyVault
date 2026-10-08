import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import Activity from '../src/models/Activity.js';
import { setS3Mock, generateS3Key } from '../src/services/s3Service.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyvault_test';

describe('Security Hardening & IDOR Regression Suite', () => {
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
        name: 'Sec User Alpha',
        email: 'sec_alpha@example.com',
        password: 'Password123'
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sec User Beta',
        email: 'sec_beta@example.com',
        password: 'Password123'
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user.id;
  });

  describe('Security Headers & CORS Protection', () => {
    test('responses include protective Helmet headers and hide X-Powered-By', async () => {
      const res = await request(app).get('/api/health');

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'DENY');
      assert.equal(res.headers['x-powered-by'], undefined);
    });

    test('allowed origin receives appropriate CORS headers', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });
  });

  describe('Authentication Security & Anti-Enumeration', () => {
    test('non-existent email returns generic 401 without revealing account existence', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent_user_999@example.com',
          password: 'Password123'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid email or password');
    });

    test('incorrect password returns identical generic 401 error message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sec_alpha@example.com',
          password: 'WrongPassword456'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid email or password');
    });

    test('sensitive password hashes are never exposed in any authentication response', async () => {
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.data.user.password, undefined);
      assert.equal(meRes.body.data.user.passwordHash, undefined);
    });

    test('NoSQL injection attempts in login payload are rejected safely', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $gt: '' },
          password: 'Password123'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  describe('JWT Security & Token Tampering Resistance', () => {
    test('expired JWT is rejected with 401 Authentication required', async () => {
      // Craft an expired token
      const expiredToken = jwt.sign(
        { userId: userAId },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('JWT signed with incorrect secret is rejected with 401', async () => {
      const forgedToken = jwt.sign(
        { userId: userAId },
        'an_attacker_forged_secret_key',
        { expiresIn: '1d' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('token with manipulated algorithm or malformed Bearer format is rejected', async () => {
      const res1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      assert.equal(res1.status, 401);

      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      assert.equal(res2.status, 401);

      const res3 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');
      assert.equal(res3.status, 401);
    });
  });

  describe('IDOR & Cross-User Isolation Enforcement', () => {
    let userADoc;

    beforeEach(async () => {
      // Upload a test document owned by User A
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('subject', 'Security Analysis')
        .field('semester', '7')
        .field('category', 'Notes')
        .field('tags', 'crypto,idor')
        .attach('file', Buffer.from('%PDF-1.4 secret user A document content'), {
          filename: 'Confidential_Research.pdf',
          contentType: 'application/pdf'
        });
      userADoc = res.body.data.document;
    });

    test('IDOR: User B cannot retrieve User A document details (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/documents/${userADoc.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');
    });

    test('IDOR: User B cannot generate download URL for User A document (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/documents/${userADoc.id}/download`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');
    });

    test('IDOR: User B cannot update User A document (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/documents/${userADoc.id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ subject: 'Hijacked Subject' });

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');

      // Verify User A document is unchanged
      const freshDoc = await Document.findById(userADoc.id);
      assert.equal(freshDoc.subject, 'Security Analysis');
    });

    test('IDOR: User B cannot delete User A document (returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/documents/${userADoc.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');

      // Verify document still exists in DB
      const freshDoc = await Document.findById(userADoc.id);
      assert.ok(freshDoc);
    });

    test('IDOR: User B cannot toggle favorite on User A document (returns 404)', async () => {
      const res = await request(app)
        .patch(`/api/documents/${userADoc.id}/favorite`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Document not found');
    });

    test('Ownership tampering: sending another userId in PUT body cannot reassign document owner', async () => {
      const res = await request(app)
        .put(`/api/documents/${userADoc.id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          userId: userBId,
          subject: 'Legitimate Updated Subject'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.document.subject, 'Legitimate Updated Subject');

      // Verify userId remained User A
      const freshDoc = await Document.findById(userADoc.id);
      assert.equal(freshDoc.userId.toString(), userAId);
    });

    test('User B cannot see User A activity in GET /api/activity', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.activities.length, 0);
    });

    test('User B dashboard does not leak User A storage or document count', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.overview.totalDocuments, 0);
      assert.equal(res.body.data.overview.totalStorageBytes, 0);
    });
  });

  describe('File Upload Security & Path Traversal Resistance', () => {
    test('path traversal in uploaded filename is safely stripped by path.basename', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('subject', 'Path Test')
        .field('semester', '5')
        .field('category', 'Notes')
        .attach('file', Buffer.from('%PDF-1.4 test safe content'), {
          filename: '../../../../etc/passwd.pdf',
          contentType: 'application/pdf'
        });

      assert.equal(res.status, 201);
      const doc = res.body.data.document;

      // Ensure path traversal was stripped to base filename
      assert.equal(doc.originalFileName, 'passwd.pdf');

      // Verify S3 key structure is clean and scoped: users/{userId}/{uuid}.pdf
      const dbDoc = await Document.findById(doc.id);
      assert.ok(dbDoc.s3Key.startsWith(`users/${userAId}/`));
      assert.ok(!dbDoc.s3Key.includes('..'));
      assert.ok(dbDoc.s3Key.endsWith('.pdf'));
    });

    test('null byte in filename is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('subject', 'Null Byte Test')
        .field('semester', '5')
        .field('category', 'Notes')
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'exploit.php\0.pdf',
          contentType: 'application/pdf'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('internal s3Key is not exposed in dashboard response', async () => {
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('subject', 'Dashboard Leak Check')
        .field('semester', '1')
        .field('category', 'Notes')
        .attach('file', Buffer.from('%PDF-1.4 test file'), {
          filename: 'Notes.pdf',
          contentType: 'application/pdf'
        });

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      const recentDocs = res.body.data.recentDocuments;
      assert.ok(recentDocs.length > 0);
      recentDocs.forEach((d) => {
        assert.equal(d.s3Key, undefined);
      });
    });
  });

  describe('Pagination Boundaries & ReDoS Resistance', () => {
    test('special regex characters in search parameter do not crash or cause ReDoS', async () => {
      const specialCharacters = '.*+?^${}()|[]\\';

      const res = await request(app)
        .get(`/api/documents?search=${encodeURIComponent(specialCharacters)}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.documents));
    });

    test('negative page or zero limit are handled safely without crashing', async () => {
      const res = await request(app)
        .get('/api/documents?page=-5&limit=0')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 10);
    });

    test('excessive limit is safely capped at 50', async () => {
      const res = await request(app)
        .get('/api/documents?limit=99999')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.pagination.limit, 50);
    });

    test('NoSQL query injection in query parameters is safely treated as string or rejected', async () => {
      // In Express with qs parser, ?action[$gt]= becomes an object. activityController checks typeof action === 'string'
      const res = await request(app)
        .get('/api/activity?action[$gt]=')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });
});
