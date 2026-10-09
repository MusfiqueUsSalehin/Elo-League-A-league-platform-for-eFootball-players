import User from '../models/User.js';
import { hashPassword, passwordSchema } from '../utils/password.js';

/** Creates the first admin from the environment. Safe to run repeatedly. */
export async function ensureAdmin(env, logger = { info() {} }) {
  const { admin } = env;

  if (await User.exists({ role: 'admin' })) {
    logger.info('an admin account already exists, leaving it alone');
    return { created: false };
  }

  if (!admin.password) {
    throw new Error('ADMIN_PASSWORD is required to create the first admin. Set it in server/.env');
  }
  const check = passwordSchema.safeParse(admin.password);
  if (!check.success) {
    throw new Error(`ADMIN_PASSWORD is too weak: ${check.error.issues[0].message}`);
  }

  const user = await User.create({
    name: admin.name,
    username: admin.username,
    email: admin.email,
    role: 'admin',
    passwordHash: await hashPassword(admin.password, env.bcryptRounds),
    mustChangePassword: true,
  });

  return { created: true, user };
}
