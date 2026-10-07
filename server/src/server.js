import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';

function loadEnvOrExit() {
  try {
    return loadEnv();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const env = loadEnvOrExit();
const logger = createLogger(env);
const app = createApp({ env, logger });

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, environment: env.nodeEnv }, `${env.appName} API listening`);
});

server.on('error', (err) => {
  logger.fatal({ err }, 'http server error');
  process.exit(1);
});
