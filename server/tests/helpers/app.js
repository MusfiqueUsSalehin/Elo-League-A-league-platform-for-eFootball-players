import { createApp } from '../../src/app.js';
import { loadEnv } from '../../src/config/env.js';
import { createLogger } from '../../src/config/logger.js';

export function buildTestEnv(overrides = {}) {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    BCRYPT_ROUNDS: '4', // fast hashing; production enforces 10 or more
    LOGIN_RATE_LIMIT_MAX: '1000', // tests that exercise the limiter lower it
    ...overrides,
  });
}

export function buildTestApp({ env = buildTestEnv(), isReady = async () => true } = {}) {
  const logger = createLogger(env);
  return { app: createApp({ env, logger, isReady }), env, logger };
}
