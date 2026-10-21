import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES, timeAgo, typeLabel } from './notifications.js';

const now = new Date('2026-10-20T12:00:00.000Z');
const ago = (ms) => new Date(now.getTime() - ms).toISOString();

describe('timeAgo', () => {
  it('says "just now" for the last minute, and for a clock that is slightly ahead', () => {
    expect(timeAgo(ago(30_000), now)).toBe('just now');
    expect(timeAgo(ago(-5_000), now)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5 min ago');
    expect(timeAgo(ago(3 * 3_600_000), now)).toBe('3 h ago');
    expect(timeAgo(ago(2 * 86_400_000), now)).toBe('2 d ago');
  });

  it('switches to a date after a week', () => {
    expect(timeAgo('2026-10-01T12:00:00.000Z', now)).toBe('1 Oct 2026');
  });

  it('shows nothing for something that is not a date', () => {
    expect(timeAgo('not a date', now)).toBe('');
  });
});

describe('notification kinds', () => {
  it('lists the seven kinds the server knows', () => {
    expect(NOTIFICATION_TYPES.map((type) => type.key)).toEqual([
      'account',
      'tournament',
      'match',
      'result',
      'reminder',
      'announcement',
      'system',
    ]);
  });

  it('gives each kind a readable label', () => {
    expect(typeLabel('match')).toBe('Matches');
    expect(typeLabel('something-new')).toBe('something-new');
  });
});
