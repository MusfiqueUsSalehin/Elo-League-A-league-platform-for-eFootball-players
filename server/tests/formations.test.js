import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FORMATIONS as CLIENT_FORMATIONS,
  FORMATION_KEYS as CLIENT_KEYS,
} from '../../client/src/lib/formations.js';
import { FORMATION_KEYS } from '../src/models/Team.js';

// The server accepts a list of formation names and the client draws them. If the two lists
// drift apart, a manager could pick a formation the server then refuses, or the reverse.
describe('formation lists', () => {
  it('match between the server and the client', () => {
    assert.deepEqual([...FORMATION_KEYS].sort(), [...CLIENT_KEYS].sort());
  });

  it('give every formation eleven slots, the first being the goalkeeper', () => {
    for (const key of FORMATION_KEYS) {
      assert.equal(CLIENT_FORMATIONS[key].length, 11, key);
      assert.equal(CLIENT_FORMATIONS[key][0].label, 'GK', key);
    }
  });
});
