import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bracketOrder,
  buildKnockout,
  buildLeague,
  roundRobin,
  withDates,
} from '../src/services/fixtures.js';

const teams = (n) =>
  Array.from({ length: n }, (_, i) => ({ team: `t${i + 1}`, owner: `u${i + 1}` }));
const keep = (items) => items;
const pairKey = (a, b) => [a, b].sort().join('-');

describe('roundRobin', () => {
  it('makes every team meet every other team exactly once', () => {
    const rounds = roundRobin(['a', 'b', 'c', 'd']);
    assert.equal(rounds.length, 3);
    assert.ok(rounds.every((pairs) => pairs.length === 2));
    const meetings = rounds.flat().map(([x, y]) => pairKey(x, y));
    assert.equal(new Set(meetings).size, 6);
  });

  it('gives each team a bye when the number of teams is odd', () => {
    const rounds = roundRobin(['a', 'b', 'c', 'd', 'e']);
    assert.equal(rounds.length, 5);
    assert.ok(rounds.every((pairs) => pairs.length === 2));
    assert.equal(rounds.flat().length, 10);
  });
});

describe('buildLeague', () => {
  it('plays home and away over two legs', () => {
    const matches = buildLeague(teams(4), { legs: 2, shuffle: keep });
    assert.equal(matches.length, 12);
    assert.equal(Math.max(...matches.map((m) => m.round)), 6);
    for (const first of matches.filter((m) => m.leg === 1)) {
      assert.ok(
        matches.some(
          (m) => m.leg === 2 && m.homeTeam === first.awayTeam && m.awayTeam === first.homeTeam
        )
      );
    }
  });

  it('carries each team with its manager', () => {
    const [match] = buildLeague(teams(2), { shuffle: keep });
    assert.equal(match.homeUser, match.homeTeam.replace('t', 'u'));
  });
});

describe('buildKnockout', () => {
  it('orders the bracket so the top seeds meet late', () => {
    assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('builds a full bracket of eight', () => {
    const matches = buildKnockout(teams(8));
    const perRound = [1, 2, 3].map((r) => matches.filter((m) => m.round === r).length);
    assert.deepEqual(perRound, [4, 2, 1]);
    assert.equal(matches.find((m) => m.round === 3).roundName, 'Final');

    const ids = new Set(matches.map((m) => String(m._id)));
    for (const match of matches.filter((m) => m.round < 3)) {
      assert.ok(ids.has(String(match.nextMatch)));
      assert.ok(['home', 'away'].includes(match.nextSlot));
    }
    assert.equal(matches.find((m) => m.round === 3).nextMatch, null);
  });

  it('gives the top seeds a bye when the field is not a power of two', () => {
    const matches = buildKnockout(teams(6));
    assert.equal(matches.length, 5);

    const roundOne = matches.filter((m) => m.round === 1);
    assert.equal(roundOne.length, 2);
    assert.ok(roundOne.every((m) => m.homeTeam && m.awayTeam));
    const playingFirst = roundOne.flatMap((m) => [m.homeTeam, m.awayTeam]);
    assert.ok(!playingFirst.includes('t1') && !playingFirst.includes('t2'));

    const roundTwo = matches.filter((m) => m.round === 2).flatMap((m) => [m.homeTeam, m.awayTeam]);
    assert.ok(roundTwo.includes('t1') && roundTwo.includes('t2'));
  });

  it('draws a single final for two teams', () => {
    const matches = buildKnockout(teams(2));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].roundName, 'Final');
  });
});

describe('withDates', () => {
  it('spaces rounds by the interval', () => {
    const start = new Date('2026-12-01T18:00:00Z');
    const [first, second] = withDates([{ round: 1 }, { round: 2 }], start, 3);
    assert.equal(first.scheduledAt.toISOString(), '2026-12-01T18:00:00.000Z');
    assert.equal(second.scheduledAt.toISOString(), '2026-12-04T18:00:00.000Z');
  });
});
