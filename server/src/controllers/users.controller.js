import { z } from 'zod';
import User, { PLATFORMS, ROLES } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generatePassword, hashPassword, passwordSchema } from '../utils/password.js';
import { escapeRegex } from '../utils/query.js';

const name = z.string().trim().min(2).max(60);
const username = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]{3,30}$/i, 'Use 3-30 letters, numbers, dots, dashes or underscores');
const email = z.string().trim().toLowerCase().email().max(120);
const konamiId = z.string().trim().max(40);
const platform = z.enum(PLATFORMS);
const phone = z.string().trim().max(30);

const atLeastOne = (value) => Object.keys(value).length > 0;
const NOTHING_TO_CHANGE = 'Send at least one field to change';

// zod drops keys that are not listed, so a request can never set elo, tokenVersion and the like.
export const createUserSchema = z.object({
  name,
  username,
  email,
  role: z.enum(ROLES).default('user'),
  konamiId: konamiId.optional(),
  platform: platform.optional(),
  phone: phone.optional(),
  password: passwordSchema.optional(),
});

export const updateUserSchema = z
  .object({
    name: name.optional(),
    username: username.optional(),
    email: email.optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    konamiId: konamiId.optional(),
    platform: platform.optional(),
    phone: phone.optional(),
  })
  .refine(atLeastOne, NOTHING_TO_CHANGE);

export const profileSchema = z
  .object({
    name: name.optional(),
    konamiId: konamiId.optional(),
    platform: platform.optional(),
    phone: phone.optional(),
  })
  .refine(atLeastOne, NOTHING_TO_CHANGE);

export const resetPasswordSchema = z.object({ password: passwordSchema.optional() });

export const idParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
});

export const listQuery = z.object({
  q: z.string().trim().max(50).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const sameUser = (a, b) => String(a) === String(b);

async function findUser(id) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('No such user');
  return user;
}

export function createUsersController({ env }) {
  const listUsers = asyncHandler(async (req, res) => {
    const { q, role, status, page, limit } = req.query;
    const filter = {};
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: pattern }, { username: pattern }, { email: pattern }];
    }
    if (role) filter.role = role;
    if (status) filter.isActive = status === 'active';

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
  });

  const createUser = asyncHandler(async (req, res) => {
    const { password, ...data } = req.body;
    const temporaryPassword = password ?? generatePassword();

    // Duplicate usernames and emails are caught by the unique indexes and become a 409.
    const user = await User.create({
      ...data,
      passwordHash: await hashPassword(temporaryPassword, env.bcryptRounds),
      mustChangePassword: true,
      createdBy: req.user._id,
    });

    // Shown once so the admin can hand it over. It is never stored in plain text.
    res.status(201).json({ success: true, user, temporaryPassword });
  });

  const getUser = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && !sameUser(req.params.id, req.user._id)) {
      throw ApiError.forbidden('You can only view your own account');
    }
    res.json({ success: true, user: await findUser(req.params.id) });
  });

  const updateUser = asyncHandler(async (req, res) => {
    const user = await findUser(req.params.id);
    const { isActive, role } = req.body;

    // Whoever is acting always stays an active admin, so the league cannot lock itself out.
    if (sameUser(user._id, req.user._id) && (isActive === false || (role && role !== 'admin'))) {
      throw ApiError.badRequest('You cannot deactivate or demote your own account');
    }
    if (isActive !== undefined && isActive !== user.isActive) user.tokenVersion += 1;

    user.set(req.body);
    await user.save();
    res.json({ success: true, user });
  });

  const resetPassword = asyncHandler(async (req, res) => {
    const user = await findUser(req.params.id);
    if (sameUser(user._id, req.user._id)) {
      throw ApiError.badRequest('Use change password to update your own password');
    }

    const temporaryPassword = req.body.password ?? generatePassword();
    user.passwordHash = await hashPassword(temporaryPassword, env.bcryptRounds);
    user.mustChangePassword = true;
    user.tokenVersion += 1;
    await user.save();

    res.json({ success: true, temporaryPassword });
  });

  const updateProfile = asyncHandler(async (req, res) => {
    const user = await findUser(req.user._id);
    user.set(req.body);
    await user.save();
    res.json({ success: true, user });
  });

  return { listUsers, createUser, getUser, updateUser, resetPassword, updateProfile };
}
