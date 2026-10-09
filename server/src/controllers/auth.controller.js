import { z } from 'zod';
import User from '../models/User.js';
import { clearAuthCookie, setAuthCookie } from '../services/token.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { hashPassword, passwordSchema, verifyPassword } from '../utils/password.js';

// z.string() also stops query operators like {"$ne": null} from reaching the database.
export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your username or email').max(120),
  password: z.string().min(1, 'Enter your password').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: passwordSchema,
});

export function createAuthController({ env }) {
  // Compared against when no account matches, so response time does not reveal which names exist.
  const dummyHash = hashPassword('not-a-real-password-0', env.bcryptRounds);

  const login = asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { username: identifier.toLowerCase() };

    const user = await User.findOne(query).select('+passwordHash');
    const matches = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

    // One message for "no such account" and "wrong password".
    if (!user || !matches) throw ApiError.unauthorized('Wrong username or password');
    // Only someone who proved they know the password learns the account is deactivated.
    if (!user.isActive) throw ApiError.forbidden('This account is deactivated. Contact the admin.');

    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookie(res, user, env);
    res.json({ success: true, user });
  });

  const logout = (_req, res) => {
    clearAuthCookie(res, env);
    res.json({ success: true });
  };

  const me = (req, res) => {
    res.json({ success: true, user: req.user });
  };

  const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');

    // 400, not 401: a wrong current password must not look like an expired session.
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Your current password is not right');
    }
    if (currentPassword === newPassword) {
      throw ApiError.badRequest('The new password must be different from the current one');
    }

    user.passwordHash = await hashPassword(newPassword, env.bcryptRounds);
    user.mustChangePassword = false;
    user.tokenVersion += 1; // signs out every other device
    await user.save();

    setAuthCookie(res, user, env); // this device gets a fresh session
    res.json({ success: true, user });
  });

  return { login, logout, me, changePassword };
}
