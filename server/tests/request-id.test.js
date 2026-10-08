import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { buildTestApp } from './helpers/app.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('request ids', () => {
  const { app } = buildTestApp();

  it('generates an id when the caller sends none', async () => {
    const res = await request(app).get('/api/health');
    assert.match(res.headers['x-request-id'], UUID);
  });

  it('reuses a well-formed id from the caller', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'test-request-1234');
    assert.equal(res.headers['x-request-id'], 'test-request-1234');
  });

  it('replaces a malformed id', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'x');
    assert.match(res.headers['x-request-id'], UUID);
  });
});
