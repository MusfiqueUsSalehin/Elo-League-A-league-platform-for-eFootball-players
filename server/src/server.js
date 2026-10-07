import { createApp } from './app.js';
import { connectDB, disconnectDB, isDbReady } from './config/db.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { registerGracefulShutdown } from './utils/shutdown.js';

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

async function start() {
  await connectDB(env.mongoUri, logger);

  const state = { shuttingDown: false };
  const app = createApp({
    env,
    logger,
    isReady: async () => !state.shuttingDown && (await isDbReady()),
  });

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, environment: env.nodeEnv }, `${env.appName} API listening`);
  });

  server.on('error', (err) => {
    logger.fatal({ err }, 'http server error');
    process.exit(1);
  });

  registerGracefulShutdown({ server, logger, state, onShutdown: disconnectDB });
}

start().catch((err) => {
  logger.fatal({ err }, 'server failed to start');
  process.exit(1);
});
