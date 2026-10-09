import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { errorHandler, notFound } from '../src/middleware/error.js';
import ApiError from '../src/utils/ApiError.js';

const app = express();
app.get('/coded', (_req, _res, next) =>
  next(ApiError.forbidden('Change your password first', 'PASSWORD_CHANGE_REQUIRED'))
);
app.get('/plain', (_req, _res, next) => next(ApiError.forbidden()));
app.get('/mongo-duplicate', () => {
  const err = new Error('E11000 duplicate key');
  err.code = 11000;
  err.keyValue = { email: 'a@example.com' };
  throw err;
});
app.use(notFound);
app.use(errorHandler({ isProd: true }));

describe('error codes', () => {
  it('includes the code of an ApiError that has one', async () => {
    const res = await request(app).get('/coded');
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
  });

  it('omits the code when there is none', async () => {
    const res = await request(app).get('/plain');
    assert.equal(res.body.code, undefined);
  });

  it('does not leak a database error code', async () => {
    const res = await request(app).get('/mongo-duplicate');
    assert.equal(res.status, 409);
    assert.equal(res.body.code, undefined);
  });
});
