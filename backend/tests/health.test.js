import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

describe('Health and Fallback Routes', () => {
  test('GET /api/health returns 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'StudyVault API is healthy');
  });

  test('GET /api/nonexistent-route returns 404 route not found', async () => {
    const res = await request(app).get('/api/nonexistent-route');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Route not found');
  });
});
