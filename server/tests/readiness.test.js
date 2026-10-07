import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { buildTestApp } from './helpers/app.js';

describe('GET /api/ready', () => {
  it('returns 200 when every dependency is up', async () => {
    const { app } = buildTestApp({ isReady: async () => true });
    const res = await request(app).get('/api/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'ready');
  });

  it('returns 503 when a dependency is down', async () => {
    const { app } = buildTestApp({ isReady: async () => false });
    const res = await request(app).get('/api/ready');

    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'unavailable');
  });

  it('returns 503 when the readiness check itself fails', async () => {
    const { app } = buildTestApp({
      isReady: async () => {
        throw new Error('boom');
      },
    });
    const res = await request(app).get('/api/ready');

    assert.equal(res.status, 503);
  });
});
