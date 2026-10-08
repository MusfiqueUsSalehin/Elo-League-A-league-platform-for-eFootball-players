import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { buildTestApp } from './helpers/app.js';

describe('GET /api/health', () => {
  it('reports that the process is alive', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.name, 'Elo League');
    assert.equal(res.headers['cache-control'], 'no-store');
  });
});
