import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler, notFound } from '../src/middleware/error.js';
import { validate } from '../src/middleware/validate.js';
import ApiError from '../src/utils/ApiError.js';
import asyncHandler from '../src/utils/asyncHandler.js';
import { buildTestApp } from './helpers/app.js';

const bodySchema = z.object({
  name: z.string().min(2),
  age: z.coerce.number().int().min(0).optional(),
});

/** A tiny app that exercises the middleware on its own, one route per behaviour. */
function miniApp({ isProd = false } = {}) {
  const app = express();
  app.use((req, _res, next) => {
    req.log = { error() {} }; // keep expected 500s out of the test output
    next();
  });
  app.use(express.json());

  app.post('/echo', validate(bodySchema), (req, res) => res.json(req.body));
  app.get('/forbidden', () => {
    throw ApiError.forbidden();
  });
  app.get(
    '/boom',
    asyncHandler(async () => {
      throw new Error('database password is hunter2');
    })
  );
  app.get('/duplicate', () => {
    const err = new Error('E11000 duplicate key');
    err.code = 11000;
    err.keyValue = { email: 'a@example.com' };
    throw err;
  });

  app.use(notFound);
  app.use(errorHandler({ isProd }));
  return app;
}

describe('validate middleware', () => {
  it('rejects invalid input with a list of problems', async () => {
    const res = await request(miniApp()).post('/echo').send({ name: 'x' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Some fields need fixing');
    assert.ok(res.body.details.some((d) => d.startsWith('name:')));
  });

  it('passes the parsed, coerced value to the handler', async () => {
    const res = await request(miniApp()).post('/echo').send({ name: 'Rahim', age: '24' });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { name: 'Rahim', age: 24 });
  });
});

describe('error handler', () => {
  it('uses the status of an ApiError', async () => {
    const res = await request(miniApp()).get('/forbidden');

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'You do not have access to this');
  });

  it('maps a duplicate key error to 409', async () => {
    const res = await request(miniApp()).get('/duplicate');

    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'email is already taken');
  });

  it('shows the real message and a stack outside production', async () => {
    const res = await request(miniApp({ isProd: false })).get('/boom');

    assert.equal(res.status, 500);
    assert.equal(res.body.message, 'database password is hunter2');
    assert.ok(res.body.stack);
  });

  it('hides internals in production', async () => {
    const res = await request(miniApp({ isProd: true })).get('/boom');

    assert.equal(res.status, 500);
    assert.equal(res.body.message, 'Something went wrong on the server');
    assert.equal(res.body.stack, undefined);
    assert.ok(!JSON.stringify(res.body).includes('hunter2'));
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await request(miniApp()).get('/nothing');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});

describe('error handling in the full app', () => {
  const { app } = buildTestApp();

  it('returns a JSON 404 that carries the request id', async () => {
    const res = await request(app).get('/api/nope');

    assert.equal(res.status, 404);
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });

  it('turns malformed JSON into a 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad');

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'The request body is not valid JSON');
  });
});
