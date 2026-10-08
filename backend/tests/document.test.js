import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import { setS3Mock, generateS3Key } from '../src/services/s3Service.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyvault_test';

describe('Document CRUD and AWS S3 File Storage Suite', () => {
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

    // Configure realistic in-memory S3 mock for automated test environment
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
        return `https://studyvault-test-bucket.s3.ap-south-1.amazonaws.com/${s3Key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mockSignature123`;
      }
    });

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  after(async () => {
    setS3Mock(null);
    if (mongoose.connection.readyState !== 0) {
      await Document.deleteMany({});
      await User.deleteMany({});
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    mockS3Storage.clear();
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

  describe('POST /api/documents (Multipart File Upload)', () => {
    test('authenticated user can upload valid PDF file and save S3 metadata', async () => {
      const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy pdf document content');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', dummyPdfBuffer, {
          filename: 'DBMS_Unit_3_Notes.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Notes')
        .field('tags', 'mongodb,sql,normalization');

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Document uploaded successfully');
      assert.ok(res.body.data.document.id);
      assert.equal(res.body.data.document.originalFileName, 'DBMS_Unit_3_Notes.pdf');
      assert.equal(res.body.data.document.subject, 'DBMS');
      assert.equal(res.body.data.document.semester, '3');
      assert.equal(res.body.data.document.category, 'Notes');
      assert.deepEqual(res.body.data.document.tags, ['mongodb', 'sql', 'normalization']);
      assert.equal(res.body.data.document.fileType, 'pdf');
      assert.equal(res.body.data.document.mimeType, 'application/pdf');
      assert.equal(res.body.data.document.fileSize, dummyPdfBuffer.length);
      assert.equal(res.body.data.document.userId, userAId);

      // Verify S3 key structure: users/{userId}/{uuid}.pdf
      const s3Key = res.body.data.document.s3Key;
      assert.ok(s3Key.startsWith(`users/${userAId}/`));
      assert.ok(s3Key.endsWith('.pdf'));

      // Verify object exists in mock S3 storage
      assert.ok(mockS3Storage.has(s3Key));
    });

    test('fails with 400 when file is missing in multipart upload', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Notes');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'File is required');
    });

    test('fails with 400 when file type is unsupported (.exe)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('binary-code'), {
          filename: 'malicious_script.exe',
          contentType: 'application/x-msdownload'
        })
        .field('subject', 'Security')
        .field('semester', '5')
        .field('category', 'Other');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('File type not supported'));
    });

    test('fails with 400 when file exceeds the 10 MB limit', async () => {
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', oversizedBuffer, {
          filename: 'giant_archive.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Notes');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'File size exceeds the 10 MB limit');
    });

    test('fails with 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/documents')
        .attach('file', Buffer.from('test content'), {
          filename: 'Notes.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Notes');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('fails with 400 when subject is missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('test pdf'), {
          filename: 'Notes.pdf',
          contentType: 'application/pdf'
        })
        .field('semester', '3')
        .field('category', 'Notes');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Subject is required');
    });

    test('fails with 400 when category is invalid', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('test pdf'), {
          filename: 'Notes.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'InvalidCategory');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Category is required'));
    });

    test('handles S3 failure gracefully without creating MongoDB document', async () => {
      // Temporarily simulate S3 network failure
      const originalMock = setS3Mock({
        uploadFile: async () => {
          throw new Error('S3 Connection Timeout');
        }
      });

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('test pdf'), {
          filename: 'Fail_Doc.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Notes');

      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'File upload to storage failed');

      // Verify no document was saved in database
      const count = await Document.countDocuments({ originalFileName: 'Fail_Doc.pdf' });
      assert.equal(count, 0);

      // Restore working mock
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
          return `https://studyvault-test-bucket.s3.ap-south-1.amazonaws.com/${s3Key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mockSignature123`;
        }
      });
    });
  });

  describe('GET /api/documents (List, Search, Filter, Pagination)', () => {
    beforeEach(async () => {
      // Seed User A documents with file uploads
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('dbms unit 1'), {
          filename: 'DBMS_Notes_Unit1.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Notes')
        .field('tags', 'sql,relational');

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('os practical'), {
          filename: 'OS_Practical_Guide.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'Operating Systems')
        .field('semester', '4')
        .field('category', 'Practical')
        .field('tags', 'linux,bash');

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('dbms assignment'), {
          filename: 'DBMS_Assignment_1.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Assignment')
        .field('tags', 'queries,joins');

      // Seed User B document
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userBToken}`)
        .attach('file', Buffer.from('user b paper'), {
          filename: 'UserB_Private_Paper.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'DBMS')
        .field('semester', '3')
        .field('category', 'Question Paper')
        .field('tags', 'exam');
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

    test('combined filters and search work together', async () => {
      const res = await request(app)
        .get('/api/documents?search=queries&subject=DBMS&semester=3&category=Assignment')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.documents.length, 1);
      assert.equal(res.body.data.documents[0].originalFileName, 'DBMS_Assignment_1.docx');
    });

    test('pagination returns correct slice of documents', async () => {
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
        .attach('file', Buffer.from('test pdf content'), {
          filename: 'UserA_Doc.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'Math')
        .field('semester', '1')
        .field('category', 'Notes');

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
  });

  describe('GET /api/documents/:id/download (Presigned S3 URL)', () => {
    let docAId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('download test content'), {
          filename: 'Download_Doc.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'Networks')
        .field('semester', '5')
        .field('category', 'Notes');

      docAId = res.body.data.document.id;
    });

    test('owner can generate presigned download URL', async () => {
      const res = await request(app)
        .get(`/api/documents/${docAId}/download`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Download URL generated successfully');
      assert.ok(res.body.data.downloadUrl);
      assert.ok(res.body.data.downloadUrl.includes('https://'));
      assert.equal(res.body.data.expiresIn, 300);
    });

    test('fails with 401 when unauthenticated', async () => {
      const res = await request(app).get(`/api/documents/${docAId}/download`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('User B cannot download User A document (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/documents/${docAId}/download`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Document not found');
    });
  });

  describe('PUT /api/documents/:id (Update Metadata)', () => {
    let docAId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('update test content'), {
          filename: 'Old_Name.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'Old Subject')
        .field('semester', '1')
        .field('category', 'Notes')
        .field('tags', 'old');

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
          userId: userBId, // Attempted ownership theft
          s3Key: 'hacked-key',
          fileSize: 999999
        });

      assert.equal(res.status, 200);

      const updatedDoc = await Document.findById(docAId);
      assert.equal(updatedDoc.userId.toString(), userAId);
      assert.equal(updatedDoc.s3Key, originalDoc.s3Key);
      assert.equal(updatedDoc.fileSize, originalDoc.fileSize);
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
  });

  describe('DELETE /api/documents/:id (Delete Metadata and S3 File)', () => {
    let docAId;
    let docAS3Key;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('delete test file content'), {
          filename: 'Doc_To_Delete.pdf',
          contentType: 'application/pdf'
        })
        .field('subject', 'Algorithms')
        .field('semester', '5')
        .field('category', 'Notes');

      docAId = res.body.data.document.id;
      docAS3Key = res.body.data.document.s3Key;
    });

    test('owner can delete document (removes S3 object and MongoDB metadata)', async () => {
      assert.ok(mockS3Storage.has(docAS3Key));

      const res = await request(app)
        .delete(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Document deleted successfully');

      // Verify MongoDB document is removed
      const foundInDb = await Document.findById(docAId);
      assert.equal(foundInDb, null);

      // Verify S3 storage object is removed
      assert.equal(mockS3Storage.has(docAS3Key), false);
    });

    test('User B cannot delete User A document (returns 404 and S3 file preserved)', async () => {
      assert.ok(mockS3Storage.has(docAS3Key));

      const res = await request(app)
        .delete(`/api/documents/${docAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Document not found');

      // Verify still intact
      const foundInDb = await Document.findById(docAId);
      assert.ok(foundInDb);
      assert.ok(mockS3Storage.has(docAS3Key));
    });

    test('fails with 401 when unauthenticated', async () => {
      const res = await request(app).delete(`/api/documents/${docAId}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });
  });
});
