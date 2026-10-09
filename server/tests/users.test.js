import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import User from '../src/models/User.js';
import { passwordSchema, verifyPassword } from '../src/utils/password.js';
import { TEST_PASSWORD, createTestUser, loginAgent } from './helpers/auth.js';
import { buildTestApp } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';

const newPlayer = (overrides = {}) => ({
  name: 'Arman Hossain',
  username: 'arman',
  email: 'arman@example.com',
  ...overrides,
});

describe('user accounts', () => {
  const { app } = buildTestApp();
  let admin;
  let member;
  let adminAgent;
  let memberAgent;

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    admin = await createTestUser({ role: 'admin', username: 'boss' });
    member = await createTestUser({ username: 'member' });
    adminAgent = await loginAgent(app, 'boss');
    memberAgent = await loginAgent(app, 'member');
  });

  const signIn = (identifier, password) =>
    request(app).post('/api/auth/login').send({ identifier, password });

  describe('access control', () => {
    it('requires a session', async () => {
      assert.equal((await request(app).get('/api/users')).status, 401);
    });

    it('keeps account management away from players', async () => {
      assert.equal((await memberAgent.get('/api/users')).status, 403);
      assert.equal((await memberAgent.post('/api/users').send(newPlayer())).status, 403);
    });

    it('keeps authenticated responses out of caches', async () => {
      const res = await adminAgent.get('/api/users');
      assert.equal(res.headers['cache-control'], 'no-store');
    });

    it('blocks every route except the password change until it is done', async () => {
      const fresh = await createTestUser({ username: 'fresh', mustChangePassword: true });
      const agent = await loginAgent(app, 'fresh');

      const blocked = await agent.patch('/api/users/profile').send({ name: 'Fresh Player' });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');

      const readOwn = await agent.get(`/api/users/${fresh.id}`);
      assert.equal(readOwn.body.code, 'PASSWORD_CHANGE_REQUIRED');

      assert.equal((await agent.get('/api/auth/me')).status, 200);

      await agent
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'Brand-New-Pass-7' });
      const allowed = await agent.patch('/api/users/profile').send({ name: 'Fresh Player' });
      assert.equal(allowed.status, 200);
    });
  });

  describe('POST /api/users', () => {
    it('creates an account with a generated temporary password', async () => {
      const res = await adminAgent.post('/api/users').send(newPlayer());

      assert.equal(res.status, 201);
      assert.equal(passwordSchema.safeParse(res.body.temporaryPassword).success, true);
      assert.equal(res.body.user.passwordHash, undefined);
      assert.equal(res.body.user.mustChangePassword, true);
      assert.equal(res.body.user.role, 'user');

      const stored = await User.findOne({ username: 'arman' }).select('+passwordHash');
      assert.notEqual(stored.passwordHash, res.body.temporaryPassword);
      assert.equal(await verifyPassword(res.body.temporaryPassword, stored.passwordHash), true);

      const signedIn = await signIn('arman', res.body.temporaryPassword);
      assert.equal(signedIn.status, 200);
      assert.equal(signedIn.body.user.mustChangePassword, true);
    });

    it('accepts an admin-chosen password that meets the policy', async () => {
      const res = await adminAgent
        .post('/api/users')
        .send(newPlayer({ password: 'Chosen-Pass-77' }));

      assert.equal(res.status, 201);
      assert.equal((await signIn('arman', 'Chosen-Pass-77')).status, 200);
    });

    it('rejects a weak password', async () => {
      const res = await adminAgent.post('/api/users').send(newPlayer({ password: 'weak' }));
      assert.equal(res.status, 400);
    });

    it('ignores fields a caller must not set', async () => {
      await adminAgent
        .post('/api/users')
        .send(newPlayer({ elo: 3000, tokenVersion: 9, isActive: false }));

      const stored = await User.findOne({ username: 'arman' });
      assert.equal(stored.elo, 1200);
      assert.equal(stored.tokenVersion, 0);
      assert.equal(stored.isActive, true);
    });

    it('rejects duplicate usernames and emails', async () => {
      await adminAgent.post('/api/users').send(newPlayer());

      const sameUsername = await adminAgent
        .post('/api/users')
        .send(newPlayer({ email: 'other@example.com' }));
      assert.equal(sameUsername.status, 409);
      assert.equal(sameUsername.body.message, 'username is already taken');

      const sameEmail = await adminAgent
        .post('/api/users')
        .send(newPlayer({ username: 'other', email: 'ARMAN@example.com' }));
      assert.equal(sameEmail.status, 409);
      assert.equal(sameEmail.body.message, 'email is already taken');
    });

    it('rejects invalid input', async () => {
      assert.equal(
        (await adminAgent.post('/api/users').send(newPlayer({ username: 'a b' }))).status,
        400
      );
      assert.equal(
        (await adminAgent.post('/api/users').send({ name: 'No Email', username: 'noemail' }))
          .status,
        400
      );
    });
  });

  describe('GET /api/users', () => {
    it('paginates', async () => {
      for (const username of ['alpha', 'bravo', 'charlie']) {
        await createTestUser({ username });
      }
      const res = await adminAgent.get('/api/users').query({ limit: 2 });

      assert.equal(res.body.items.length, 2);
      assert.equal(res.body.total, 5);
      assert.equal(res.body.pages, 3);
      assert.equal(res.body.page, 1);
    });

    it('treats search text literally', async () => {
      await createTestUser({ username: 'alpha' });
      await createTestUser({ username: 'bravo' });

      const wildcard = await adminAgent.get('/api/users').query({ q: '.*' });
      assert.equal(wildcard.body.total, 0);

      const partial = await adminAgent.get('/api/users').query({ q: 'alph' });
      assert.equal(partial.body.total, 1);
      assert.equal(partial.body.items[0].username, 'alpha');
    });

    it('filters by role and status', async () => {
      await User.updateOne({ _id: member._id }, { isActive: false });

      const inactive = await adminAgent.get('/api/users').query({ status: 'inactive' });
      assert.deepEqual(
        inactive.body.items.map((u) => u.username),
        ['member']
      );

      const admins = await adminAgent.get('/api/users').query({ role: 'admin' });
      assert.deepEqual(
        admins.body.items.map((u) => u.username),
        ['boss']
      );
    });

    it('never includes secrets', async () => {
      const res = await adminAgent.get('/api/users');
      for (const user of res.body.items) {
        assert.equal(user.passwordHash, undefined);
        assert.equal(user.tokenVersion, undefined);
      }
    });
  });

  describe('GET /api/users/:id', () => {
    it('lets a player read their own account', async () => {
      assert.equal((await memberAgent.get(`/api/users/${member.id}`)).status, 200);
    });

    it('stops a player reading someone else', async () => {
      assert.equal((await memberAgent.get(`/api/users/${admin.id}`)).status, 403);
    });

    it('lets an admin read any account', async () => {
      const res = await adminAgent.get(`/api/users/${member.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.username, 'member');
    });

    it('rejects a malformed id and reports an unknown one', async () => {
      assert.equal((await adminAgent.get('/api/users/not-an-id')).status, 400);
      assert.equal((await adminAgent.get(`/api/users/${'f'.repeat(24)}`)).status, 404);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('lets an admin edit an account', async () => {
      const res = await adminAgent
        .patch(`/api/users/${member.id}`)
        .send({ name: 'Renamed Player', role: 'admin' });

      assert.equal(res.status, 200);
      const stored = await User.findById(member._id);
      assert.equal(stored.name, 'Renamed Player');
      assert.equal(stored.role, 'admin');
    });

    it('rejects an update that changes nothing', async () => {
      assert.equal((await adminAgent.patch(`/api/users/${member.id}`).send({})).status, 400);
    });

    it('stops an admin deactivating or demoting themselves', async () => {
      const deactivate = await adminAgent.patch(`/api/users/${admin.id}`).send({ isActive: false });
      const demote = await adminAgent.patch(`/api/users/${admin.id}`).send({ role: 'user' });

      assert.equal(deactivate.status, 400);
      assert.equal(demote.status, 400);
    });

    it('deactivates an account and ends its sessions for good', async () => {
      await adminAgent.patch(`/api/users/${member.id}`).send({ isActive: false });

      assert.equal((await memberAgent.get('/api/auth/me')).status, 403);
      assert.equal((await signIn('member', TEST_PASSWORD)).status, 403);

      await adminAgent.patch(`/api/users/${member.id}`).send({ isActive: true });

      // The old session stays dead after reactivation; the player has to sign in again.
      assert.equal((await memberAgent.get('/api/auth/me')).status, 401);
      assert.equal((await signIn('member', TEST_PASSWORD)).status, 200);
    });
  });

  describe('POST /api/users/:id/reset-password', () => {
    it('resets the password, forces a change and ends old sessions', async () => {
      const res = await adminAgent.post(`/api/users/${member.id}/reset-password`);

      assert.equal(res.status, 200);
      assert.equal(passwordSchema.safeParse(res.body.temporaryPassword).success, true);
      assert.equal((await memberAgent.get('/api/auth/me')).status, 401);
      assert.equal((await signIn('member', TEST_PASSWORD)).status, 401);

      const fresh = await signIn('member', res.body.temporaryPassword);
      assert.equal(fresh.status, 200);
      assert.equal(fresh.body.user.mustChangePassword, true);
    });

    it('is admin only', async () => {
      const res = await memberAgent.post(`/api/users/${admin.id}/reset-password`);
      assert.equal(res.status, 403);
    });

    it('refuses to reset the acting admin', async () => {
      const res = await adminAgent.post(`/api/users/${admin.id}/reset-password`);
      assert.equal(res.status, 400);
    });
  });

  describe('PATCH /api/users/profile', () => {
    it('lets a player edit their own details', async () => {
      const res = await memberAgent
        .patch('/api/users/profile')
        .send({ name: 'New Name', platform: 'PS5' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.name, 'New Name');
      assert.equal(res.body.user.platform, 'PS5');
    });

    it('ignores attempts to change protected fields', async () => {
      const res = await memberAgent
        .patch('/api/users/profile')
        .send({ name: 'Still Me', role: 'admin', elo: 5000, isActive: false });

      assert.equal(res.status, 200);
      const stored = await User.findById(member._id);
      assert.equal(stored.role, 'user');
      assert.equal(stored.elo, 1200);
      assert.equal(stored.isActive, true);
    });

    it('rejects an update that changes nothing allowed', async () => {
      const res = await memberAgent.patch('/api/users/profile').send({ role: 'admin' });
      assert.equal(res.status, 400);
    });
  });
});
