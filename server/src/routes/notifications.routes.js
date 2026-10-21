import { Router } from 'express';
import {
  getPreferences,
  idParams,
  listNotifications,
  listQuery,
  markAllRead,
  markRead,
  preferencesSchema,
  unreadCount,
  updatePreferences,
} from '../controllers/notifications.controller.js';
import { validate } from '../middleware/validate.js';

export function createNotificationRoutes({ auth }) {
  const router = Router();
  router.use(auth.protect);

  router.get('/', validate(listQuery, 'query'), listNotifications);
  // Fixed paths go before /:id so they are not read as an id.
  router.get('/unread-count', unreadCount);
  router.post('/read-all', markAllRead);
  router.get('/preferences', getPreferences);
  router.put('/preferences', validate(preferencesSchema), updatePreferences);
  router.post('/:id/read', validate(idParams, 'params'), markRead);

  return router;
}
