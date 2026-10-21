import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMailer } from '../src/services/mailer.js';

const message = { to: 'rahim@example.com', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' };
const from = { name: 'Elo League', address: 'no-reply@eloleague.local' };

describe('createMailer', () => {
  it('hands the message to the mail server in smtp mode', async () => {
    const calls = [];
    let transportOptions;
    const mailer = createMailer(
      { mode: 'smtp', smtp: { host: 'smtp.example.com', port: 587 }, from },
      { info() {} },
      {
        createTransport: (options) => {
          transportOptions = options;
          return { sendMail: async (mail) => calls.push(mail) };
        },
      }
    );

    await mailer.send(message);

    assert.equal(mailer.mode, 'smtp');
    assert.deepEqual(transportOptions, { host: 'smtp.example.com', port: 587 });
    assert.deepEqual(calls, [{ from, ...message }]);
  });

  it('lets a mail server failure reach the caller so it can retry', async () => {
    const mailer = createMailer(
      { mode: 'smtp', smtp: {}, from },
      { info() {} },
      {
        createTransport: () => ({
          sendMail: async () => {
            throw new Error('connection refused');
          },
        }),
      }
    );

    await assert.rejects(() => mailer.send(message), /connection refused/);
  });

  it('writes the email to the log in console mode', async () => {
    const logged = [];
    const mailer = createMailer(
      { mode: 'console', smtp: null, from },
      { info: (...args) => logged.push(args) }
    );

    await mailer.send(message);

    assert.equal(mailer.mode, 'console');
    assert.equal(logged.length, 1);
    assert.deepEqual(logged[0][0], { to: 'rahim@example.com', subject: 'Hello' });
    assert.match(logged[0][1], /Hi/);
  });

  it('refuses to send when email is off', async () => {
    const mailer = createMailer({ mode: 'off', smtp: null, from }, { info() {} });

    assert.equal(mailer.mode, 'off');
    await assert.rejects(() => mailer.send(message), /turned off/);
  });
});
