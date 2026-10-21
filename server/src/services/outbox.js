import EmailOutbox from '../models/EmailOutbox.js';

export const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** How long to wait before the next try: 2, 4, 8, 16 minutes, never more than an hour. */
export const backoffMs = (attempts) => Math.min(2 ** attempts, 60) * MINUTE_MS;

export const enqueueEmail = (email) => EmailOutbox.create(email);

/**
 * Sends the emails that are due. Each one is claimed first by pushing its next attempt into the
 * future, so two workers (or two overlapping runs) can never send the same email twice.
 */
export async function processOutbox({ mailer, logger, now = new Date(), batchSize = 20 }) {
  const due = await EmailOutbox.find({ status: 'pending', nextAttemptAt: { $lte: now } })
    .sort({ nextAttemptAt: 1 })
    .limit(batchSize)
    .select('_id');

  const result = { sent: 0, retried: 0, failed: 0 };

  for (const { _id } of due) {
    const email = await EmailOutbox.findOneAndUpdate(
      { _id, status: 'pending', nextAttemptAt: { $lte: now } },
      { $set: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
      { new: true }
    );
    if (!email) continue; // someone else took it

    try {
      await mailer.send({
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      await EmailOutbox.updateOne(
        { _id },
        { $set: { status: 'sent', sentAt: new Date(), lastError: '' } }
      );
      result.sent += 1;
    } catch (err) {
      const lastError = String(err.message ?? err).slice(0, 300);
      const giveUp = email.attempts >= MAX_ATTEMPTS;

      await EmailOutbox.updateOne(
        { _id },
        {
          $set: giveUp
            ? { status: 'failed', lastError }
            : { nextAttemptAt: new Date(now.getTime() + backoffMs(email.attempts)), lastError },
        }
      );
      logger.warn({ emailId: String(_id), attempts: email.attempts, giveUp }, 'email not sent');
      if (giveUp) result.failed += 1;
      else result.retried += 1;
    }
  }

  return result;
}

/** Runs the outbox on a timer until the returned function is called. Never overlaps itself. */
export function startMailWorker({ mailer, logger, intervalMs = 30_000 }) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processOutbox({ mailer, logger });
      if (result.sent || result.retried || result.failed) logger.info(result, 'mail outbox run');
    } catch (err) {
      logger.error({ err }, 'mail outbox run failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
