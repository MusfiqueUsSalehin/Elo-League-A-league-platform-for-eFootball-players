import { describe, expect, it } from 'vitest';
import {
  assignToSlot,
  clearSlot,
  isComplete,
  lineupFromTeam,
  orderForSlot,
  sameLineup,
  startersFrom,
  startingIds,
} from './lineup.js';

describe('lineup helpers', () => {
  it('reads a line-up from the server shape', () => {
    const team = {
      lineup: [
        { slot: 0, footballer: 'a' },
        { slot: 3, footballer: 'b' },
      ],
    };
    expect(lineupFromTeam(team)).toEqual({ 0: 'a', 3: 'b' });
    expect(lineupFromTeam({})).toEqual({});
  });

  it('turns a line-up back into sorted starters', () => {
    expect(startersFrom({ 5: 'x', 0: 'g', 2: 'y' })).toEqual([
      { slot: 0, footballer: 'g' },
      { slot: 2, footballer: 'y' },
      { slot: 5, footballer: 'x' },
    ]);
  });

  it('assigns a player to an empty slot', () => {
    expect(assignToSlot({}, 4, 'a')).toEqual({ 4: 'a' });
  });

  it('replaces whoever held the slot', () => {
    expect(assignToSlot({ 4: 'a' }, 4, 'b')).toEqual({ 4: 'b' });
  });

  it('moves a player who already starts instead of duplicating them', () => {
    expect(assignToSlot({ 1: 'a', 2: 'b' }, 5, 'a')).toEqual({ 2: 'b', 5: 'a' });
  });

  it('does not change the line-up it was given', () => {
    const before = { 1: 'a' };
    assignToSlot(before, 2, 'b');
    clearSlot(before, 1);
    expect(before).toEqual({ 1: 'a' });
  });

  it('clears a slot', () => {
    expect(clearSlot({ 1: 'a', 2: 'b' }, 1)).toEqual({ 2: 'b' });
    expect(clearSlot({ 1: 'a' }, 9)).toEqual({ 1: 'a' });
  });

  it('knows who is starting and whether the XI is complete', () => {
    expect(startingIds({ 0: 'a', 1: 'b' })).toEqual(new Set(['a', 'b']));
    const eleven = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, `p${i}`]));
    expect(isComplete(eleven)).toBe(true);
    expect(isComplete({ 0: 'a' })).toBe(false);
  });

  it('compares line-ups', () => {
    expect(sameLineup({ 0: 'a' }, { 0: 'a' })).toBe(true);
    expect(sameLineup({ 0: 'a' }, { 0: 'b' })).toBe(false);
    expect(sameLineup({ 0: 'a' }, { 0: 'a', 1: 'b' })).toBe(false);
    expect(sameLineup({}, {})).toBe(true);
  });

  it('orders the squad with the natural position first, then by rating', () => {
    const squad = [
      { name: 'Low CB', position: 'CB', rating: 70 },
      { name: 'Star CF', position: 'CF', rating: 95 },
      { name: 'High CB', position: 'CB', rating: 85 },
      { name: 'Mid CF', position: 'CF', rating: 80 },
    ];

    expect(orderForSlot(squad, 'CB').map((p) => p.name)).toEqual([
      'High CB',
      'Low CB',
      'Star CF',
      'Mid CF',
    ]);
  });
});
