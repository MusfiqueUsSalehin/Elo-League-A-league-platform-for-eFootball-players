import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import request from 'supertest';
import User from '../src/models/User.js';
import { TEST_PASSWORD, createTestUser, loginAgent } from './helpers/auth.js';
import { buildTestApp, buildTestEnv } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';

describe('authentication', () => {
  const { app } = buildTestApp();

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);

  const login = (identifier, password = TEST_PASSWORD) =>
    request(app).post('/api/auth/login').send({ identifier, password });

  describe('POST /api/auth/login', () => {
    it('signs in with a username and sets an httpOnly session cookie', async () => {
      await createTestUser({ username: 'rahim' });
      const res = await login('rahim');

      assert.equal(res.status, 200);
      assert.equal(res.body.user.username, 'rahim');
      const [cookie] = res.headers['set-cookie'];
      assert.match(cookie, /^elo_token=/);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
    });

    it('signs in with an email in any letter case', async () => {
      await createTestUser({ email: 'rahim@example.com' });
      const res = await login('Rahim@Example.COM');
      assert.equal(res.status, 200);
    });

    it('never returns secrets', async () => {
      await createTestUser({ username: 'rahim' });
      const res = await login('rahim');

      assert.equal(res.body.user.passwordHash, undefined);
      assert.equal(res.body.user.tokenVersion, undefined);
    });

    it('gives the same answer for an unknown account and a wrong password', async () => {
      await createTestUser({ username: 'rahim' });
      const wrongPassword = await login('rahim', 'Wrong-Password-1');
      const unknownUser = await login('nobody', 'Wrong-Password-1');

      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownUser.status, 401);
      assert.equal(wrongPassword.body.message, unknownUser.body.message);
    });

    it('reveals a deactivated account only to someone who knows the password', async () => {
      await createTestUser({ username: 'rahim', isActive: false });

      assert.equal((await login('rahim')).status, 403);
      assert.equal((await login('rahim', 'Wrong-Password-1')).status, 401);
    });

    it('records the last sign-in time', async () => {
      const user = await createTestUser({ username: 'rahim' });
      await login('rahim');

      const stored = await User.findById(user._id);
      assert.ok(stored.lastLoginAt instanceof Date);
    });

    it('rejects a query operator in place of a string', async () => {
      await createTestUser({ username: 'rahim' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: { $ne: null }, password: TEST_PASSWORD });

      assert.equal(res.status, 400);
    });

    it('rejects a missing password', async () => {
      const res = await request(app).post('/api/auth/login').send({ identifier: 'rahim' });
      assert.equal(res.status, 400);
    });
  });

  describe('sessions', () => {
    it('refuses requests without a cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.equal(res.status, 401);
    });

    it('refuses a forged cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'elo_token=not-a-real-token');
      assert.equal(res.status, 401);
    });

    it('returns the signed-in user', async () => {
      await createTestUser({ username: 'rahim' });
      const agent = await loginAgent(app, 'rahim');
      const res = await agent.get('/api/auth/me');

      assert.equal(res.status, 200);
      assert.equal(res.body.user.username, 'rahim');
    });

    it('ends the session on logout', async () => {
      await createTestUser({ username: 'rahim' });
      const agent = await loginAgent(app, 'rahim');

      assert.equal((await agent.post('/api/auth/logout')).status, 200);
      assert.equal((await agent.get('/api/auth/me')).status, 401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    const NEW_PASSWORD = 'Brand-New-Pass-7';

    it('rejects a wrong current password', async () => {
      await createTestUser({ username: 'rahim' });
      const agent = await loginAgent(app, 'rahim');
      const res = await agent
        .post('/api/auth/change-password')
        .send({ currentPassword: 'Wrong-Password-1', newPassword: NEW_PASSWORD });

      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Your current password is not right');
    });

    it('rejects a weak new password', async () => {
      await createTestUser({ username: 'rahim' });
      const agent = await loginAgent(app, 'rahim');
      const res = await agent
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'short1' });

      assert.equal(res.status, 400);
      assert.ok(res.body.details.length > 0);
    });

    it('rejects reusing the current password', async () => {
      await createTestUser({ username: 'rahim' });
      const agent = await loginAgent(app, 'rahim');
      const res = await agent
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

      assert.equal(res.status, 400);
    });

    it('changes the password, clears the forced-change flag and keeps this session', async () => {
      await createTestUser({ username: 'rahim', mustChangePassword: true });
      const agent = await loginAgent(app, 'rahim');
      const res = await agent
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.mustChangePassword, false);
      assert.ok(res.headers['set-cookie']);
      assert.equal((await agent.get('/api/auth/me')).status, 200);
      assert.equal((await login('rahim', TEST_PASSWORD)).status, 401);
      assert.equal((await login('rahim', NEW_PASSWORD)).status, 200);
    });

    it('signs out every other session', async () => {
      await createTestUser({ username: 'rahim' });
      const laptop = await loginAgent(app, 'rahim');
      const phone = await loginAgent(app, 'rahim');

      await laptop
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

      assert.equal((await laptop.get('/api/auth/me')).status, 200);
      assert.equal((await phone.get('/api/auth/me')).status, 401);
    });
  });

  describe('login rate limit', () => {
    const limited = (max) => buildTestApp({ env: buildTestEnv({ LOGIN_RATE_LIMIT_MAX: max }) }).app;
    const attempt = (target, password) =>
      request(target).post('/api/auth/login').send({ identifier: 'rahim', password });

    it('blocks an address after repeated failures', async () => {
      const target = limited('3');
      await createTestUser({ username: 'rahim' });

      for (let i = 0; i < 3; i++) {
        assert.equal((await attempt(target, 'Wrong-Password-1')).status, 401);
      }
      const blocked = await attempt(target, 'Wrong-Password-1');
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.success, false);
    });

    it('does not count successful sign-ins', async () => {
      const target = limited('2');
      await createTestUser({ username: 'rahim' });

      for (let i = 0; i < 5; i++) {
        assert.equal((await attempt(target, TEST_PASSWORD)).status, 200);
      }
    });
  });
});
