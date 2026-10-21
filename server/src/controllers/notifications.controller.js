import { z } from 'zod';
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js';
import NotificationPreference, {
  defaultEmailPreferences,
} from '../models/NotificationPreference.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { objectId } from '../utils/schemas.js';

export const idParams = z.object({ id: objectId });

export const listQuery = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// `.strict()` turns an unknown kind of notification into a clear error instead of ignoring it.
export const preferencesSchema = z.object({
  email: z
    .object(Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, z.boolean().optional()])))
    .strict()
    .refine((value) => Object.keys(value).length > 0, 'Send at least one setting'),
});

const unreadCountFor = (user) => Notification.countDocuments({ user: user._id, readAt: null });

export const listNotifications = asyncHandler(async (req, res) => {
  const { unread, page, limit } = req.query;
  const filter = { user: req.user._id };
  if (unread === 'true') filter.readAt = null;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    unreadCountFor(req.user),
  ]);

  res.json({
    success: true,
    items,
    total,
    unread: unreadCount,
    page,
    pages: Math.ceil(total / limit),
  });
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ success: true, count: await unreadCountFor(req.user) });
});

export const markRead = asyncHandler(async (req, res) => {
  // Someone else's notification looks exactly like one that does not exist.
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw ApiError.notFound('No such notification');

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.json({ success: true, notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ success: true, updated: result.modifiedCount });
});

async function currentEmailPreferences(user) {
  const saved = await NotificationPreference.findOne({ user: user._id });
  return { ...defaultEmailPreferences(), ...(saved?.email?.toObject?.() ?? {}) };
}

export const getPreferences = asyncHandler(async (req, res) => {
  res.json({ success: true, email: await currentEmailPreferences(req.user) });
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const email = { ...(await currentEmailPreferences(req.user)), ...req.body.email };
  await NotificationPreference.findOneAndUpdate(
    { user: req.user._id },
    { $set: { email } },
    { upsert: true }
  );
  res.json({ success: true, email });
});
