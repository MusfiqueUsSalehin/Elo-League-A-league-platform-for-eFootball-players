import { createApp } from './app.js';
import { connectDB, disconnectDB, isDbReady } from './config/db.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { loadMailConfig } from './config/mail.js';
import { createMailer } from './services/mailer.js';
import { createNotifier } from './services/notifier.js';
import { startMailWorker } from './services/outbox.js';
import { registerGracefulShutdown } from './utils/shutdown.js';

function loadConfigOrExit() {
  try {
    const env = loadEnv();
    return { env, mail: loadMailConfig(env) };
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const { env, mail } = loadConfigOrExit();
const logger = createLogger(env);

async function start() {
  await connectDB(env.mongoUri, logger);

  // Email: `notify` adds notifications and queues emails; the worker sends the queue.
  const mailer = createMailer(mail, logger);
  logger.info({ mode: mailer.mode }, 'email mode');
  const notify = createNotifier({ env, logger, mailer });
  const stopMailWorker = mailer.mode === 'off' ? () => {} : startMailWorker({ mailer, logger });

  const state = { shuttingDown: false };
  const app = createApp({
    env,
    logger,
    notify,
    isReady: async () => !state.shuttingDown && (await isDbReady()),
  });

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, environment: env.nodeEnv }, `${env.appName} API listening`);
  });

  server.on('error', (err) => {
    logger.fatal({ err }, 'http server error');
    process.exit(1);
  });

  registerGracefulShutdown({
    server,
    logger,
    state,
    onShutdown: async () => {
      stopMailWorker();
      await disconnectDB();
    },
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'server failed to start');
  process.exit(1);
});
