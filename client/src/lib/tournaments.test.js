import { describe, expect, it } from 'vitest';
import {
  acceptsEntries,
  deadlineLabel,
  describeFormat,
  fromLocalInput,
  teamsLabel,
  toLocalInput,
} from './tournaments.js';

describe('describeFormat', () => {
  it('says how a competition is played', () => {
    expect(describeFormat({ format: 'knockout', legs: 1 })).toBe('Knockout cup, one leg');
    expect(describeFormat({ format: 'league', legs: 1 })).toBe('League, played once');
    expect(describeFormat({ format: 'league', legs: 2 })).toBe('League, home and away');
  });
});

describe('teamsLabel', () => {
  it('counts places filled and mentions teams that are waiting', () => {
    expect(teamsLabel({ entries: { approved: 3, pending: 0 }, maxTeams: 8 })).toBe(
      '3 of 8 places filled'
    );
    expect(teamsLabel({ entries: { approved: 3, pending: 2 }, maxTeams: 8 })).toBe(
      '3 of 8 places filled, 2 waiting'
    );
  });
});

describe('deadlineLabel', () => {
  it('shows the closing date, or says there is none', () => {
    expect(deadlineLabel({ registrationDeadline: '2026-11-01T12:00:00.000Z' })).toBe(
      'Entries close 1 Nov 2026'
    );
    expect(deadlineLabel({ registrationDeadline: null })).toBe('No entry deadline');
  });
});

describe('acceptsEntries', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it('is true only while registration is open and the deadline has not passed', () => {
    expect(acceptsEntries({ status: 'registration', registrationDeadline: null })).toBe(true);
    expect(acceptsEntries({ status: 'registration', registrationDeadline: future })).toBe(true);
    expect(acceptsEntries({ status: 'registration', registrationDeadline: past })).toBe(false);
    expect(acceptsEntries({ status: 'draft', registrationDeadline: null })).toBe(false);
    expect(acceptsEntries({ status: 'active', registrationDeadline: null })).toBe(false);
  });
});

describe('date input helpers', () => {
  it('turn an empty input into null and back into an empty string', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });

  it('round-trip a local date and time in any time zone', () => {
    expect(toLocalInput(fromLocalInput('2026-11-01T18:30'))).toBe('2026-11-01T18:30');
  });
});
