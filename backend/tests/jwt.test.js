import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, verifyToken } from '../src/utils/jwt.js';

describe('JWT Utilities', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  });

  test('generateToken produces a valid JWT and verifyToken extracts userId', () => {
    const userId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const token = generateToken(userId);

    assert.equal(typeof token, 'string');
    assert.ok(token.length > 20);

    const decoded = verifyToken(token);
    assert.equal(decoded.userId, userId);
  });

  test('verifyToken throws on invalid token', () => {
    assert.throws(() => {
      verifyToken('invalid.token.here');
    });
  });
});
