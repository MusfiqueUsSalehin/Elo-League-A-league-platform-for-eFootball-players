import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import EmailOutbox from '../src/models/EmailOutbox.js';
import {
  MAX_ATTEMPTS,
  backoffMs,
  enqueueEmail,
  processOutbox,
  startMailWorker,
} from '../src/services/outbox.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';
import { fakeMailer, recordingLogger } from './helpers/mail.js';

const email = (overrides = {}) => ({
  to: 'rahim@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
  ...overrides,
});

describe('backoffMs', () => {
  it('doubles the wait each time, up to an hour', () => {
    assert.equal(backoffMs(1), 2 * 60_000);
    assert.equal(backoffMs(2), 4 * 60_000);
    assert.equal(backoffMs(4), 16 * 60_000);
    assert.equal(backoffMs(10), 60 * 60_000);
  });
});

describe('the email outbox', () => {
  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);

  it('sends the emails that are due and marks them sent', async () => {
    const mailer = fakeMailer();
    await enqueueEmail(email());
    await enqueueEmail(email({ to: 'sadia@example.com', subject: 'Second' }));

    const result = await processOutbox({ mailer, logger: recordingLogger() });

    assert.deepEqual(result, { sent: 2, retried: 0, failed: 0 });
    assert.deepEqual(mailer.sent.map((m) => m.to).sort(), [
      'rahim@example.com',
      'sadia@example.com',
    ]);
    assert.deepEqual(Object.keys(mailer.sent[0]).sort(), ['html', 'subject', 'text', 'to']);
    const stored = await EmailOutbox.find();
    assert.ok(stored.every((row) => row.status === 'sent' && row.sentAt instanceof Date));
  });

  it('leaves emails that are not due yet', async () => {
    const mailer = fakeMailer();
    await enqueueEmail(email({ nextAttemptAt: new Date(Date.now() + 3_600_000) }));

    const result = await processOutbox({ mailer, logger: recordingLogger() });

    assert.equal(result.sent, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('does not send the same email twice', async () => {
    const mailer = fakeMailer();
    await enqueueEmail(email());

    await processOutbox({ mailer, logger: recordingLogger() });
    await processOutbox({ mailer, logger: recordingLogger() });

    assert.equal(mailer.sent.length, 1);
  });

  it('does not let two overlapping runs send the same email', async () => {
    const mailer = fakeMailer();
    for (let i = 0; i < 5; i++) await enqueueEmail(email({ to: `p${i}@example.com` }));

    await Promise.all([
      processOutbox({ mailer, logger: recordingLogger() }),
      processOutbox({ mailer, logger: recordingLogger() }),
    ]);

    assert.equal(mailer.sent.length, 5);
    assert.equal(new Set(mailer.sent.map((m) => m.to)).size, 5);
  });

  it('keeps a failed email and tries again later with a longer wait', async () => {
    const logger = recordingLogger();
    const now = new Date(Date.now() + 1000);
    await enqueueEmail(email());

    const result = await processOutbox({
      mailer: fakeMailer({ failWith: 'connection refused' }),
      logger,
      now,
    });

    assert.deepEqual(result, { sent: 0, retried: 1, failed: 0 });
    const [row] = await EmailOutbox.find();
    assert.equal(row.status, 'pending');
    assert.equal(row.attempts, 1);
    assert.equal(row.lastError, 'connection refused');
    assert.equal(row.nextAttemptAt.getTime(), now.getTime() + backoffMs(1));
    assert.equal(logger.lines.warn.length, 1);
  });

  it('delivers an email that failed before once the mail server recovers', async () => {
    const now = new Date(Date.now() + 1000);
    await enqueueEmail(email());
    await processOutbox({
      mailer: fakeMailer({ failWith: 'down' }),
      logger: recordingLogger(),
      now,
    });

    const mailer = fakeMailer();
    const later = new Date(now.getTime() + backoffMs(1) + 1000);
    const result = await processOutbox({ mailer, logger: recordingLogger(), now: later });

    assert.equal(result.sent, 1);
    const [row] = await EmailOutbox.find();
    assert.equal(row.status, 'sent');
    assert.equal(row.attempts, 2);
    assert.equal(row.lastError, '');
  });

  it('gives up after the last attempt', async () => {
    await enqueueEmail(email({ attempts: MAX_ATTEMPTS - 1 }));

    const result = await processOutbox({
      mailer: fakeMailer({ failWith: 'still down' }),
      logger: recordingLogger(),
    });

    assert.deepEqual(result, { sent: 0, retried: 0, failed: 1 });
    const [row] = await EmailOutbox.find();
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, MAX_ATTEMPTS);
  });

  it('never sends a failed email again', async () => {
    const mailer = fakeMailer();
    await enqueueEmail(email({ status: 'failed', attempts: MAX_ATTEMPTS }));

    await processOutbox({
      mailer,
      logger: recordingLogger(),
      now: new Date(Date.now() + 86_400_000),
    });

    assert.equal(mailer.sent.length, 0);
  });

  it('works through a limited batch at a time', async () => {
    const mailer = fakeMailer();
    for (let i = 0; i < 5; i++) await enqueueEmail(email({ to: `p${i}@example.com` }));

    const result = await processOutbox({ mailer, logger: recordingLogger(), batchSize: 2 });

    assert.equal(result.sent, 2);
    assert.equal(await EmailOutbox.countDocuments({ status: 'pending' }), 3);
  });

  it('sends in the background and stops when told to', async () => {
    const mailer = fakeMailer();
    await enqueueEmail(email());

    const stop = startMailWorker({ mailer, logger: recordingLogger(), intervalMs: 20 });
    const deadline = Date.now() + 3000;
    while (mailer.sent.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    stop();

    assert.equal(mailer.sent.length, 1);
    await enqueueEmail(email({ to: 'later@example.com' }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(mailer.sent.length, 1);
  });
});
