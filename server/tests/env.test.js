import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  const production = {
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://db:27017/elo',
    JWT_SECRET: 'x'.repeat(40),
  };

  it('applies development defaults', () => {
    const env = loadEnv({});
    assert.equal(env.nodeEnv, 'development');
    assert.equal(env.isDev, true);
    assert.equal(env.isProd, false);
    assert.equal(env.port, 5000);
    assert.equal(env.logLevel, 'info');
    assert.equal(env.mongoUri, 'mongodb://127.0.0.1:27017/elo_league');
  });

  it('coerces numeric values', () => {
    assert.equal(loadEnv({ PORT: '8080' }).port, 8080);
  });

  it('treats empty strings as unset', () => {
    const env = loadEnv({ PORT: '', MONGO_URI: '' });
    assert.equal(env.port, 5000);
    assert.equal(env.mongoUri, 'mongodb://127.0.0.1:27017/elo_league');
  });

  it('normalises the client url to an origin', () => {
    assert.equal(
      loadEnv({ CLIENT_URL: 'http://localhost:5173/' }).clientUrl,
      'http://localhost:5173'
    );
  });

  it('rejects an invalid port', () => {
    assert.throws(() => loadEnv({ PORT: 'abc' }), /PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    assert.throws(() => loadEnv({ NODE_ENV: 'staging' }), /NODE_ENV/);
  });

  it('requires MONGO_URI in production', () => {
    assert.throws(() => loadEnv({ ...production, MONGO_URI: undefined }), /MONGO_URI/);
  });

  it('accepts a complete production config', () => {
    const env = loadEnv(production);
    assert.equal(env.isProd, true);
    assert.equal(env.mongoUri, 'mongodb://db:27017/elo');
    assert.equal(env.jwtSecret.length, 40);
  });

  it('requires JWT_SECRET in production', () => {
    assert.throws(() => loadEnv({ ...production, JWT_SECRET: undefined }), /JWT_SECRET/);
  });

  it('rejects a short JWT_SECRET', () => {
    assert.throws(() => loadEnv({ JWT_SECRET: 'short' }), /JWT_SECRET/);
  });

  it('rejects weak password hashing in production', () => {
    assert.throws(() => loadEnv({ ...production, BCRYPT_ROUNDS: '4' }), /BCRYPT_ROUNDS/);
  });

  it('falls back to a development secret outside production', () => {
    assert.ok(loadEnv({}).jwtSecret.length >= 32);
  });

  it('reads and normalises the first admin settings', () => {
    const env = loadEnv({
      ADMIN_USERNAME: 'Boss',
      ADMIN_EMAIL: 'Boss@Example.com',
      ADMIN_PASSWORD: 'x',
    });
    assert.equal(env.admin.username, 'boss');
    assert.equal(env.admin.email, 'boss@example.com');
    assert.equal(env.admin.password, 'x');
  });

  it('reports every problem at once', () => {
    assert.throws(
      () => loadEnv({ PORT: 'abc', LOG_LEVEL: 'loud' }),
      (err) => err.message.includes('PORT') && err.message.includes('LOG_LEVEL')
    );
  });
});
