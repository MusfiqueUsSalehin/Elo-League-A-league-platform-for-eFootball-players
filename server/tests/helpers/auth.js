import assert from 'node:assert/strict';
import request from 'supertest';
import User from '../../src/models/User.js';
import { hashPassword } from '../../src/utils/password.js';

export const TEST_PASSWORD = 'Correct-Horse-42';

let counter = 0;

/** Inserts a user directly. Defaults to a settled account (no forced password change). */
export async function createTestUser(overrides = {}) {
  const { password = TEST_PASSWORD, ...rest } = overrides;
  const n = ++counter;
  return User.create({
    name: `Test User ${n}`,
    username: `user${n}`,
    email: `user${n}@example.com`,
    passwordHash: await hashPassword(password, 4),
    mustChangePassword: false,
    ...rest,
  });
}

/** Signs in and returns a supertest agent that carries the session cookie. */
export async function loginAgent(app, identifier, password = TEST_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ identifier, password });
  assert.equal(res.status, 200, `login as ${identifier} failed: ${res.body.message}`);
  return agent;
}
