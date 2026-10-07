import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
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
    assert.throws(() => loadEnv({ NODE_ENV: 'production' }), /MONGO_URI/);
  });

  it('accepts a complete production config', () => {
    const env = loadEnv({ NODE_ENV: 'production', MONGO_URI: 'mongodb://db:27017/elo' });
    assert.equal(env.isProd, true);
    assert.equal(env.mongoUri, 'mongodb://db:27017/elo');
  });

  it('reports every problem at once', () => {
    assert.throws(
      () => loadEnv({ PORT: 'abc', LOG_LEVEL: 'loud' }),
      (err) => err.message.includes('PORT') && err.message.includes('LOG_LEVEL')
    );
  });
});
