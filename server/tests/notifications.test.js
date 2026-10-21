import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import Notification from '../src/models/Notification.js';
import NotificationPreference from '../src/models/NotificationPreference.js';
import { createTestUser, loginAgent } from './helpers/auth.js';
import { buildTestApp } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';

describe('notifications', () => {
  const { app } = buildTestApp();
  let rahim;
  let sadia;
  let rahimAgent;
  let sadiaAgent;

  const note = (user, overrides = {}) =>
    Notification.create({ user: user._id, type: 'match', title: 'Match ready', ...overrides });

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    rahim = await createTestUser({ username: 'rahim' });
    sadia = await createTestUser({ username: 'sadia' });
    rahimAgent = await loginAgent(app, 'rahim');
    sadiaAgent = await loginAgent(app, 'sadia');
  });

  describe('access', () => {
    it('requires a session', async () => {
      assert.equal((await request(app).get('/api/notifications')).status, 401);
    });

    it('blocks an account that still has a temporary password', async () => {
      await createTestUser({ username: 'fresh', mustChangePassword: true });
      const agent = await loginAgent(app, 'fresh');
      const res = await agent.get('/api/notifications');

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
    });
  });

  describe('GET /api/notifications', () => {
    it('lists only my notifications, newest first, with the unread count', async () => {
      await note(rahim, { title: 'First' });
      await note(rahim, { title: 'Second', readAt: new Date() });
      await note(rahim, { title: 'Third' });
      await note(sadia, { title: 'Not mine' });

      const res = await rahimAgent.get('/api/notifications');

      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.items.map((n) => n.title),
        ['Third', 'Second', 'First']
      );
      assert.equal(res.body.total, 3);
      assert.equal(res.body.unread, 2);
    });

    it('can show only unread ones', async () => {
      await note(rahim, { title: 'Read', readAt: new Date() });
      await note(rahim, { title: 'Unread' });

      const res = await rahimAgent.get('/api/notifications').query({ unread: 'true' });

      assert.deepEqual(
        res.body.items.map((n) => n.title),
        ['Unread']
      );
    });

    it('paginates', async () => {
      for (let i = 1; i <= 3; i++) await note(rahim, { title: `N${i}` });

      const res = await rahimAgent.get('/api/notifications').query({ limit: 2, page: 2 });

      assert.deepEqual(
        res.body.items.map((n) => n.title),
        ['N1']
      );
      assert.equal(res.body.pages, 2);
    });

    it('rejects a limit that is too large', async () => {
      assert.equal((await rahimAgent.get('/api/notifications').query({ limit: 500 })).status, 400);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('counts my unread notifications only', async () => {
      await note(rahim);
      await note(rahim, { readAt: new Date() });
      await note(sadia);

      const res = await rahimAgent.get('/api/notifications/unread-count');
      assert.equal(res.body.count, 1);
    });
  });

  describe('POST /api/notifications/:id/read', () => {
    it('marks a notification read, and keeps the first read time', async () => {
      const n = await note(rahim);

      const first = await rahimAgent.post(`/api/notifications/${n.id}/read`);
      assert.equal(first.status, 200);
      assert.ok(first.body.notification.readAt);

      const again = await rahimAgent.post(`/api/notifications/${n.id}/read`);
      assert.equal(again.body.notification.readAt, first.body.notification.readAt);
    });

    it('treats somebody else’s notification as not found', async () => {
      const n = await note(sadia);

      assert.equal((await rahimAgent.post(`/api/notifications/${n.id}/read`)).status, 404);
      assert.equal((await Notification.findById(n._id)).readAt, null);
    });

    it('rejects a malformed id and reports an unknown one', async () => {
      assert.equal((await rahimAgent.post('/api/notifications/nope/read')).status, 400);
      assert.equal(
        (await rahimAgent.post(`/api/notifications/${'f'.repeat(24)}/read`)).status,
        404
      );
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('marks all of mine read and leaves other people’s alone', async () => {
      await note(rahim);
      await note(rahim);
      await note(rahim, { readAt: new Date() });
      await note(sadia);

      const res = await rahimAgent.post('/api/notifications/read-all');

      assert.equal(res.body.updated, 2);
      assert.equal(await Notification.countDocuments({ user: rahim._id, readAt: null }), 0);
      assert.equal(await Notification.countDocuments({ user: sadia._id, readAt: null }), 1);
    });
  });

  describe('email preferences', () => {
    it('start with every kind of email on', async () => {
      const res = await rahimAgent.get('/api/notifications/preferences');

      assert.equal(res.status, 200);
      assert.equal(res.body.email.match, true);
      assert.equal(
        Object.values(res.body.email).every((on) => on === true),
        true
      );
      assert.equal(Object.keys(res.body.email).length, 7);
    });

    it('can be changed one kind at a time and are remembered', async () => {
      const put = await rahimAgent
        .put('/api/notifications/preferences')
        .send({ email: { match: false } });
      assert.equal(put.status, 200);
      assert.equal(put.body.email.match, false);
      assert.equal(put.body.email.result, true);

      await rahimAgent.put('/api/notifications/preferences').send({ email: { reminder: false } });
      const res = await rahimAgent.get('/api/notifications/preferences');

      assert.equal(res.body.email.match, false);
      assert.equal(res.body.email.reminder, false);
      assert.equal(res.body.email.announcement, true);
      assert.equal(await NotificationPreference.countDocuments({ user: rahim._id }), 1);
    });

    it('belong to each person separately', async () => {
      await rahimAgent.put('/api/notifications/preferences').send({ email: { match: false } });

      const res = await sadiaAgent.get('/api/notifications/preferences');
      assert.equal(res.body.email.match, true);
    });

    it('reject unknown kinds, wrong types and empty updates', async () => {
      const put = (body) => rahimAgent.put('/api/notifications/preferences').send(body);

      assert.equal((await put({ email: { gossip: false } })).status, 400);
      assert.equal((await put({ email: { match: 'no' } })).status, 400);
      assert.equal((await put({ email: {} })).status, 400);
      assert.equal((await put({})).status, 400);
    });
  });
});
