import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import EmailOutbox from '../src/models/EmailOutbox.js';
import Notification from '../src/models/Notification.js';
import NotificationPreference from '../src/models/NotificationPreference.js';
import { createNotifier } from '../src/services/notifier.js';
import { buildTestEnv } from './helpers/app.js';
import { createTestUser } from './helpers/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';
import { fakeMailer, recordingLogger } from './helpers/mail.js';

describe('the notifier', () => {
  const env = buildTestEnv();
  let rahim;
  let sadia;
  let logger;

  const notifierWith = (mailer = fakeMailer()) => createNotifier({ env, logger, mailer });
  const message = {
    type: 'match',
    title: 'Match ready',
    body: 'Kick-off soon',
    link: '/matches/1',
  };

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    logger = recordingLogger();
    rahim = await createTestUser({ username: 'rahim', email: 'rahim@example.com' });
    sadia = await createTestUser({ username: 'sadia', email: 'sadia@example.com' });
  });

  it('adds a notification for each person, once, and queues their emails', async () => {
    const result = await notifierWith()([rahim._id, sadia.id, rahim.id], message);

    assert.deepEqual(result, { notified: 2, emailed: 2 });
    const notifications = await Notification.find();
    assert.equal(notifications.length, 2);
    assert.ok(notifications.every((n) => n.readAt === null && n.title === 'Match ready'));
    const emails = await EmailOutbox.find().sort({ to: 1 });
    assert.deepEqual(
      emails.map((e) => e.to),
      ['rahim@example.com', 'sadia@example.com']
    );
    assert.equal(emails[0].subject, 'Match ready');
    assert.match(emails[0].text, /http:\/\/localhost:5173\/matches\/1/);
    assert.equal(emails[0].status, 'pending');
  });

  it('skips deactivated accounts', async () => {
    const gone = await createTestUser({ username: 'gone', isActive: false });
    const result = await notifierWith()([rahim._id, gone._id], message);

    assert.deepEqual(result, { notified: 1, emailed: 1 });
    assert.equal(await Notification.countDocuments({ user: gone._id }), 0);
  });

  it('respects a person who turned that kind of email off', async () => {
    await NotificationPreference.create({ user: sadia._id, email: { match: false } });

    const result = await notifierWith()([rahim._id, sadia._id], message);

    assert.deepEqual(result, { notified: 2, emailed: 1 });
    assert.equal(await Notification.countDocuments({ user: sadia._id }), 1);
    assert.deepEqual(
      (await EmailOutbox.find()).map((e) => e.to),
      ['rahim@example.com']
    );
  });

  it('still emails other kinds of notification to that person', async () => {
    await NotificationPreference.create({ user: sadia._id, email: { match: false } });

    const result = await notifierWith()([sadia._id], { ...message, type: 'result' });

    assert.equal(result.emailed, 1);
  });

  it('can skip email for one notification', async () => {
    const result = await notifierWith()([rahim._id], { ...message, email: false });

    assert.deepEqual(result, { notified: 1, emailed: 0 });
    assert.equal(await EmailOutbox.countDocuments(), 0);
  });

  it('sends only in-app notifications when email is off', async () => {
    const result = await notifierWith(fakeMailer({ mode: 'off' }))([rahim._id], message);

    assert.deepEqual(result, { notified: 1, emailed: 0 });
    assert.equal(await EmailOutbox.countDocuments(), 0);
  });

  it('does nothing for an empty list', async () => {
    assert.deepEqual(await notifierWith()([], message), { notified: 0, emailed: 0 });
  });

  it('never throws, and logs the problem instead', async () => {
    const result = await notifierWith()([rahim._id], { ...message, type: 'not-a-type' });

    assert.deepEqual(result, { notified: 0, emailed: 0 });
    assert.equal(logger.lines.error.length, 1);
    assert.equal(await Notification.countDocuments(), 0);
  });

  it('refuses a link that points outside the app', async () => {
    const result = await notifierWith()([rahim._id], { ...message, link: 'https://evil.example' });

    assert.deepEqual(result, { notified: 0, emailed: 0 });
    assert.equal(logger.lines.error.length, 1);
  });
});
