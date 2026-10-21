import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMailConfig } from '../src/config/mail.js';

const dev = { isProd: false, appName: 'Elo League' };
const prod = { isProd: true, appName: 'Elo League' };

describe('loadMailConfig', () => {
  it('writes emails to the log in development when no mail server is set', () => {
    const config = loadMailConfig(dev, {});
    assert.equal(config.mode, 'console');
    assert.equal(config.smtp, null);
  });

  it('sends nothing in production when no mail server is set', () => {
    assert.equal(loadMailConfig(prod, {}).mode, 'off');
  });

  it('uses smtp as soon as a host is set, with sensible defaults', () => {
    const config = loadMailConfig(prod, { SMTP_HOST: 'smtp.example.com' });

    assert.equal(config.mode, 'smtp');
    assert.deepEqual(config.smtp, { host: 'smtp.example.com', port: 587, secure: false });
  });

  it('reads port, security and login', () => {
    const config = loadMailConfig(dev, {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'me',
      SMTP_PASS: 'secret',
    });

    assert.deepEqual(config.smtp, {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'me', pass: 'secret' },
    });
  });

  it('lets MAIL_MODE override the guess', () => {
    assert.equal(
      loadMailConfig(dev, { SMTP_HOST: 'smtp.example.com', MAIL_MODE: 'off' }).mode,
      'off'
    );
    assert.equal(loadMailConfig(prod, { MAIL_MODE: 'console' }).mode, 'console');
  });

  it('names the sender after the app unless told otherwise', () => {
    assert.deepEqual(loadMailConfig(dev, {}).from, {
      name: 'Elo League',
      address: 'no-reply@eloleague.local',
    });
    const custom = loadMailConfig(dev, {
      MAIL_FROM_NAME: 'Matchday',
      MAIL_FROM_EMAIL: 'hi@club.test',
    });
    assert.deepEqual(custom.from, { name: 'Matchday', address: 'hi@club.test' });
  });

  it('treats empty values as unset', () => {
    assert.equal(loadMailConfig(dev, { SMTP_HOST: '', SMTP_PORT: '' }).mode, 'console');
  });

  it('refuses smtp mode without a host', () => {
    assert.throws(() => loadMailConfig(dev, { MAIL_MODE: 'smtp' }), /SMTP_HOST/);
  });

  it('refuses a login without a password, or the reverse', () => {
    assert.throws(
      () => loadMailConfig(dev, { SMTP_HOST: 'h', SMTP_USER: 'me' }),
      /both or neither/
    );
    assert.throws(() => loadMailConfig(dev, { SMTP_HOST: 'h', SMTP_PASS: 'x' }), /both or neither/);
  });

  it('rejects bad values and reports every problem', () => {
    assert.throws(
      () => loadMailConfig(dev, { SMTP_PORT: 'abc', MAIL_FROM_EMAIL: 'nope' }),
      (err) => err.message.includes('SMTP_PORT') && err.message.includes('MAIL_FROM_EMAIL')
    );
  });
});
