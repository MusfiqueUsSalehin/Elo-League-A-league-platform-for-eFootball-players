import { formatDate } from './format.js';

export const FORMAT_LABELS = { league: 'League', knockout: 'Knockout cup' };

export const STATUS_LABELS = {
  draft: 'Draft',
  registration: 'Open for entries',
  active: 'In progress',
  completed: 'Finished',
  cancelled: 'Cancelled',
};

export const STATUS_TONES = {
  draft: 'neutral',
  registration: 'green',
  active: 'gold',
  completed: 'neutral',
  cancelled: 'red',
};

export const ENTRY_LABELS = {
  pending: 'Waiting',
  approved: 'In',
  rejected: 'Turned down',
  withdrawn: 'Withdrawn',
};

export function describeFormat(tournament) {
  if (tournament.format === 'knockout') return 'Knockout cup, one leg';
  return tournament.legs === 2 ? 'League, home and away' : 'League, played once';
}

export function teamsLabel({ entries, maxTeams }) {
  const waiting = entries.pending > 0 ? `, ${entries.pending} waiting` : '';
  return `${entries.approved} of ${maxTeams} places filled${waiting}`;
}

export const deadlineLabel = ({ registrationDeadline }) =>
  registrationDeadline ? `Entries close ${formatDate(registrationDeadline)}` : 'No entry deadline';

/** Can teams still enter right now? */
export const acceptsEntries = ({ status, registrationDeadline }) =>
  status === 'registration' &&
  !(registrationDeadline && new Date(registrationDeadline) < new Date());

const pad = (number) => String(number).padStart(2, '0');

/** An ISO date as the text a datetime-local input wants, in the person's own time zone. */
export function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The reverse: what a datetime-local input holds, as an ISO date, or null when empty. */
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);
