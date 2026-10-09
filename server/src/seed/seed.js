import { connectDB, disconnectDB } from '../config/db.js';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { ensureAdmin } from './admin.js';

async function main() {
  const env = loadEnv();
  const logger = createLogger(env);

  await connectDB(env.mongoUri, logger);
  try {
    const { created, user } = await ensureAdmin(env, logger);
    if (created) {
      logger.info(
        { username: user.username },
        'admin created. Sign in with ADMIN_PASSWORD, then choose a new password.'
      );
    }
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
