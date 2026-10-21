import { formatDate } from './format.js';

// The kinds of notification the server sends. The keys must match NOTIFICATION_TYPES there.
export const NOTIFICATION_TYPES = [
  { key: 'account', label: 'Account', hint: 'Changes to your account' },
  { key: 'tournament', label: 'Tournaments', hint: 'Entries, draws and news about a competition' },
  { key: 'match', label: 'Matches', hint: 'New fixtures and changes to them' },
  { key: 'result', label: 'Results', hint: 'Scores to confirm and confirmed results' },
  { key: 'reminder', label: 'Reminders', hint: 'Matches that are about to start' },
  { key: 'announcement', label: 'Announcements', hint: 'Messages from the league admin' },
  { key: 'system', label: 'System', hint: 'Anything else the app needs to tell you' },
];

export const typeLabel = (key) => NOTIFICATION_TYPES.find((type) => type.key === key)?.label ?? key;

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date for anything older than a week. */
export function timeAgo(value, now = new Date()) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(value);
}
