import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { generateToken } from '../src/utils/jwt.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyvault_test';

describe('Authentication API Suite', () => {
  before(async () => {
    process.env.JWT_SECRET = 'studyvault_test_jwt_secret_key';
    process.env.JWT_EXPIRES_IN = '1d';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    test('successfully registers a new user and returns safe user data with token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          email: 'priti@example.com',
          password: 'StrongPassword123'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Registration successful');
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.name, 'Priti Ahire');
      assert.equal(res.body.data.user.email, 'priti@example.com');
      assert.equal(res.body.data.user.passwordHash, undefined);

      // Verify saved in DB
      const dbUser = await User.findOne({ email: 'priti@example.com' });
      assert.ok(dbUser);
      assert.notEqual(dbUser.passwordHash, 'StrongPassword123');
    });

    test('fails when name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'priti@example.com',
          password: 'StrongPassword123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Name is required');
    });

    test('fails when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          password: 'StrongPassword123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Email is required');
    });

    test('fails when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          email: 'invalid-email-format',
          password: 'StrongPassword123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Please provide a valid email address');
    });

    test('fails when password is missing or shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          email: 'priti@example.com',
          password: '123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Password must be at least 6 characters long');
    });

    test('fails when registering duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          email: 'priti@example.com',
          password: 'StrongPassword123'
        });

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Duplicate',
          email: 'priti@example.com',
          password: 'AnotherPassword456'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Email is already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          email: 'priti@example.com',
          password: 'StrongPassword123'
        });
    });

    test('successfully logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priti@example.com',
          password: 'StrongPassword123'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Login successful');
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.email, 'priti@example.com');
      assert.equal(res.body.data.user.passwordHash, undefined);
    });

    test('fails with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priti@example.com',
          password: 'WrongPassword999'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid email or password');
    });

    test('fails with unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'StrongPassword123'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid email or password');
    });

    test('fails when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priti@example.com'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Email and password are required');
    });
  });

  describe('GET /api/auth/me', () => {
    let validToken;
    let registeredUser;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priti Ahire',
          email: 'priti@example.com',
          password: 'StrongPassword123'
        });

      validToken = regRes.body.data.token;
      registeredUser = regRes.body.data.user;
    });

    test('successfully retrieves current user with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Current user retrieved successfully');
      assert.equal(res.body.data.user.id, registeredUser.id);
      assert.equal(res.body.data.user.name, 'Priti Ahire');
      assert.equal(res.body.data.user.email, 'priti@example.com');
      assert.equal(res.body.data.user.passwordHash, undefined);
    });

    test('fails with 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('fails with 401 when Bearer token is invalid or malformed', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Authentication required');
    });

    test('fails with 404 when token contains valid structure but user no longer exists', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      const orphanToken = generateToken(nonExistentUserId);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${orphanToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'User not found');
    });
  });
});
