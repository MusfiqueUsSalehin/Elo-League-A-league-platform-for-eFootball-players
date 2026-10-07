import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { isDbReady } from '../src/config/db.js';
import { buildTestApp } from './helpers/app.js';
import { startTestDb, stopTestDb } from './helpers/db.js';

describe('readiness against a real MongoDB connection', () => {
  before(startTestDb);
  after(stopTestDb);

  it('is ready while connected', async () => {
    const { app } = buildTestApp({ isReady: isDbReady });
    const res = await request(app).get('/api/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ready');
  });

  it('is unavailable once the connection is closed', async () => {
    const { app } = buildTestApp({ isReady: isDbReady });
    await mongoose.disconnect();
    const res = await request(app).get('/api/ready');

    assert.equal(res.status, 503);
  });
});
