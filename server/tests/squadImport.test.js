import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSquadText } from '../src/services/squadImport.js';

const names = (result) => result.entries.map((entry) => entry.name);

describe('parseSquadText', () => {
  it('reads comma separated lines', () => {
    const { entries, errors } = parseSquadText('Lionel Messi, RWF, 99\nKylian Mbappe, CF, 98');

    assert.deepEqual(errors, []);
    assert.deepEqual(
      entries.map(({ name, position, rating }) => ({ name, position, rating })),
      [
        { name: 'Lionel Messi', position: 'RWF', rating: 99 },
        { name: 'Kylian Mbappe', position: 'CF', rating: 98 },
      ]
    );
  });

  it('reads tabs, semicolons and pipes', () => {
    const result = parseSquadText('A One\tGK\t80\nB Two;CB;81\nC Three|LB|82');
    assert.deepEqual(names(result), ['A One', 'B Two', 'C Three']);
  });

  it('reads plain spaces, taking the last two words as position and rating', () => {
    const { entries } = parseSquadText('Lionel Andres Messi RWF 99');
    assert.equal(entries[0].name, 'Lionel Andres Messi');
    assert.equal(entries[0].position, 'RWF');
    assert.equal(entries[0].rating, 99);
  });

  it('accepts the rating before the position', () => {
    const { entries } = parseSquadText('Lionel Messi, 99, RWF');
    assert.equal(entries[0].position, 'RWF');
    assert.equal(entries[0].rating, 99);
  });

  it('accepts lower case positions', () => {
    assert.equal(parseSquadText('Joao Silva, cmf, 85').entries[0].position, 'CMF');
  });

  it('ignores blank lines and Windows line endings', () => {
    const result = parseSquadText('\r\nA One, GK, 80\r\n\r\n  \r\nB Two, CB, 81\r\n');
    assert.deepEqual(names(result), ['A One', 'B Two']);
    assert.equal(result.lineCount, 2);
  });

  it('skips a header row', () => {
    const result = parseSquadText('Name, Position, Rating\nA One, GK, 80');
    assert.deepEqual(names(result), ['A One']);
    assert.deepEqual(result.errors, []);
  });

  it('skips a header row written with spaces', () => {
    const result = parseSquadText('Name Position Rating\nA One GK 80');
    assert.deepEqual(names(result), ['A One']);
    assert.deepEqual(result.errors, []);
  });

  it('keeps real line numbers, counting the lines that were skipped', () => {
    const { errors } = parseSquadText('A One, GK, 80\n\nnonsense');
    assert.equal(errors[0].line, 3);
  });

  it('reports a line with too few fields', () => {
    const { entries, errors } = parseSquadText('Lionel Messi');
    assert.equal(entries.length, 0);
    assert.match(errors[0].reason, /Expected a name, a position and a rating/);
    assert.equal(errors[0].text, 'Lionel Messi');
  });

  it('reports a line with too many fields', () => {
    const { errors } = parseSquadText('A One, GK, 80, extra');
    assert.match(errors[0].reason, /Expected a name/);
  });

  it('reports an unknown position and lists the valid ones', () => {
    const { errors } = parseSquadText('A One, XYZ, 80');
    assert.match(errors[0].reason, /Unknown position "XYZ"/);
    assert.match(errors[0].reason, /GK, CB/);
  });

  it('reports a rating out of range', () => {
    assert.match(parseSquadText('A One, GK, 0').errors[0].reason, /rating must be/);
    assert.match(parseSquadText('A One, GK, 121').errors[0].reason, /rating must be/);
  });

  it('reports a decimal rating as an unknown position rather than guessing', () => {
    assert.equal(parseSquadText('A One, GK, 80.5').errors.length, 1);
  });

  it('reports a name that is too short or too long', () => {
    assert.match(parseSquadText('A, GK, 80').errors[0].reason, /name must be 2-40/);
    assert.match(parseSquadText(`${'x'.repeat(41)}, GK, 80`).errors[0].reason, /name must be 2-40/);
  });

  it('keeps good lines when others are bad', () => {
    const result = parseSquadText('A One, GK, 80\nbad line\nB Two, CB, 81');
    assert.deepEqual(names(result), ['A One', 'B Two']);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].line, 2);
  });

  it('returns nothing for empty text', () => {
    const result = parseSquadText('   \n\n');
    assert.deepEqual(result, { entries: [], errors: [], lineCount: 0 });
  });
});
