import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';

const DAY_MS = 24 * 60 * 60 * 1000;

export function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const placeIn = (entry, side) => ({ [`${side}Team`]: entry.team, [`${side}User`]: entry.owner });
const pair = (home, away) => ({ ...placeIn(home, 'home'), ...placeIn(away, 'away') });

/** Circle method. Returns rounds of [home, away] pairs; an odd number of teams gets a bye. */
export function roundRobin(ids) {
  const list = [...ids];
  if (list.length % 2 !== 0) list.push(null);
  const n = list.length;
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()); // rotate everyone except the first
  }
  return rounds;
}

/** Seed order of a bracket: 1 meets the lowest seed, and 1 and 2 can only meet in the final. */
export function bracketOrder(size) {
  let order = [1];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

const roundName = (teams) =>
  ({ 2: 'Final', 4: 'Semi-finals', 8: 'Quarter-finals' })[teams] ?? `Round of ${teams}`;

/** `entries` are { team, owner } objects. The draw is random. */
export function buildLeague(entries, { legs = 1, shuffle = shuffled } = {}) {
  const byTeam = new Map(entries.map((entry) => [String(entry.team), entry]));
  const rounds = roundRobin(shuffle(entries.map((entry) => String(entry.team))));
  const matches = [];
  let round = 0;
  let number = 0;

  for (let leg = 1; leg <= legs; leg++) {
    for (const pairs of rounds) {
      round += 1;
      for (const [a, b] of pairs) {
        const [home, away] = leg === 1 ? [a, b] : [b, a];
        matches.push({
          round,
          roundName: `Matchday ${round}`,
          leg,
          number: (number += 1),
          ...pair(byTeam.get(home), byTeam.get(away)),
        });
      }
    }
  }
  return matches;
}

/**
 * `entries` must already be in seed order (best first). The bracket is padded to a power of
 * two; a team drawn against an empty slot gets a bye and starts in round two.
 */
export function buildKnockout(entries) {
  const size = 2 ** Math.ceil(Math.log2(entries.length));
  const totalRounds = Math.log2(size);
  const slots = bracketOrder(size).map((seed) => entries[seed - 1] ?? null);

  const rounds = [];
  for (let round = 1; round <= totalRounds; round++) {
    const count = size / 2 ** round;
    rounds.push(
      Array.from({ length: count }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        round,
        roundName: roundName(count * 2),
        leg: 1,
        number: i + 1,
        homeTeam: null,
        homeUser: null,
        awayTeam: null,
        awayUser: null,
        nextMatch: null,
        nextSlot: null,
      }))
    );
  }

  rounds.forEach((matches, r) => {
    if (r === totalRounds - 1) return;
    matches.forEach((match, i) => {
      match.nextMatch = rounds[r + 1][Math.floor(i / 2)]._id;
      match.nextSlot = i % 2 === 0 ? 'home' : 'away';
    });
  });

  const skipped = new Set();
  rounds[0].forEach((match, i) => {
    const a = slots[2 * i];
    const b = slots[2 * i + 1];
    if (a && b) {
      Object.assign(match, pair(a, b));
      return;
    }
    // A bye: the team goes straight into its round-two slot and this match is not played.
    const next = rounds[1].find((m) => String(m._id) === String(match.nextMatch));
    Object.assign(next, placeIn(a ?? b, match.nextSlot));
    skipped.add(match);
  });

  return rounds.flat().filter((match) => !skipped.has(match));
}

/** Round 1 kicks off at `start`; each later round follows `intervalDays` after the last. */
export const withDates = (matches, start, intervalDays) =>
  matches.map((match) => ({
    ...match,
    scheduledAt: new Date(start.getTime() + (match.round - 1) * intervalDays * DAY_MS),
  }));
