import { describe, expect, it } from 'vitest';
import { formatDate } from './format.js';

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-10-10T12:00:00.000Z')).toBe('10 Oct 2026');
  });

  it('always writes September as Sep', () => {
    expect(formatDate('2026-09-01T12:00:00.000Z')).toBe('1 Sep 2026');
  });

  it('shows a dash when there is no date', () => {
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('shows a dash for something that is not a date', () => {
    expect(formatDate('not a date')).toBe('—');
  });
});
