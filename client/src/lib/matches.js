import { formatDate } from './format.js';

export const MATCH_STATUS_LABELS = {
  scheduled: 'Scheduled',
  live: 'Live',
  awaiting_confirmation: 'Awaiting confirmation',
  completed: 'Full time',
  cancelled: 'Cancelled',
};

export const MATCH_STATUS_TONES = {
  scheduled: 'neutral',
  live: 'gold',
  awaiting_confirmation: 'gold',
  completed: 'green',
  cancelled: 'red',
};

export const teamName = (team) => team?.name ?? 'To be decided';

export const scoreLabel = ({ score }) =>
  Number.isInteger(score?.home) && Number.isInteger(score?.away)
    ? `${score.home} – ${score.away}`
    : 'v';

const pad = (number) => String(number).padStart(2, '0');

export function kickoffLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(value)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Matches grouped by round, in round order: [{ round, name, matches }]. */
export function groupByRound(matches) {
  const groups = new Map();
  for (const match of matches) {
    if (!groups.has(match.round)) {
      groups.set(match.round, { round: match.round, name: match.roundName, matches: [] });
    }
    groups.get(match.round).matches.push(match);
  }
  return [...groups.values()].sort((a, b) => a.round - b.round);
}
