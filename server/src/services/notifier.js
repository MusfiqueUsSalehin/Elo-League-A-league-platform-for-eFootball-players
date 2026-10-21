import EmailOutbox from '../models/EmailOutbox.js';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import { renderEmail } from './emailTemplate.js';

/**
 * Returns `notify(userIds, { type, title, body, link, email })`.
 * It adds an in-app notification for each active user and, unless the person turned that kind
 * of email off, queues an email for the outbox worker to send. It never throws: a problem with
 * notifications must not make the action that caused them fail, so errors are logged instead.
 */
export function createNotifier({ env, logger, mailer }) {
  return async function notify(userIds, { type, title, body = '', link = '', email = true }) {
    try {
      const ids = [...new Set(userIds.map(String))];
      if (ids.length === 0) return { notified: 0, emailed: 0 };

      const users = await User.find({ _id: { $in: ids }, isActive: true }).select('email');
      if (users.length === 0) return { notified: 0, emailed: 0 };

      await Notification.insertMany(
        users.map((user) => ({ user: user._id, type, title, body, link }))
      );

      let emailed = 0;
      if (email && mailer.mode !== 'off') {
        const preferences = await NotificationPreference.find({
          user: { $in: users.map((user) => user._id) },
        });
        const optedOut = new Set(
          preferences
            .filter((pref) => pref.email?.[type] === false)
            .map((pref) => String(pref.user))
        );

        const message = renderEmail({
          appName: env.appName,
          clientUrl: env.clientUrl,
          title,
          body,
          link,
        });
        const rows = users
          .filter((user) => !optedOut.has(String(user._id)))
          .map((user) => ({ user: user._id, to: user.email, ...message }));

        if (rows.length > 0) {
          await EmailOutbox.insertMany(rows);
          emailed = rows.length;
        }
      }

      return { notified: users.length, emailed };
    } catch (err) {
      logger.error({ err, type }, 'could not create notifications');
      return { notified: 0, emailed: 0 };
    }
  };
}
