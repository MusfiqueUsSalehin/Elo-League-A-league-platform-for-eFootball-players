// Where each formation puts its eleven players. The order of `slots` matters: the server
// stores a starter as "slot number + player", so slot 0 is always the goalkeeper and the
// numbers run from the back of the pitch to the front. The list of names must match
// FORMATION_KEYS on the server (a test there checks it).

const spread = (count, index) => Math.round(((index + 1) / (count + 1)) * 100);

/** Turns rows of position labels (goalkeeper first) into slots with pitch coordinates. */
function build(rows) {
  const last = rows.length - 1;
  return rows.flatMap((labels, row) =>
    labels.map((label, index) => ({
      label,
      x: spread(labels.length, index), // percent from the left
      y: Math.round(90 - (row * 75) / last), // percent from the top; goalkeeper at the bottom
    }))
  );
}

export const FORMATIONS = {
  '4-3-3': build([['GK'], ['LB', 'CB', 'CB', 'RB'], ['CMF', 'DMF', 'CMF'], ['LWF', 'CF', 'RWF']]),
  '4-4-2': build([['GK'], ['LB', 'CB', 'CB', 'RB'], ['LMF', 'CMF', 'CMF', 'RMF'], ['CF', 'CF']]),
  '4-2-3-1': build([
    ['GK'],
    ['LB', 'CB', 'CB', 'RB'],
    ['DMF', 'DMF'],
    ['LMF', 'AMF', 'RMF'],
    ['CF'],
  ]),
  '3-5-2': build([['GK'], ['CB', 'CB', 'CB'], ['LMF', 'CMF', 'DMF', 'CMF', 'RMF'], ['CF', 'CF']]),
  '4-1-4-1': build([
    ['GK'],
    ['LB', 'CB', 'CB', 'RB'],
    ['DMF'],
    ['LMF', 'CMF', 'CMF', 'RMF'],
    ['CF'],
  ]),
  '5-3-2': build([['GK'], ['LB', 'CB', 'CB', 'CB', 'RB'], ['CMF', 'CMF', 'CMF'], ['CF', 'CF']]),
  '3-4-3': build([['GK'], ['CB', 'CB', 'CB'], ['LMF', 'CMF', 'CMF', 'RMF'], ['LWF', 'CF', 'RWF']]),
  '4-3-2-1': build([
    ['GK'],
    ['LB', 'CB', 'CB', 'RB'],
    ['CMF', 'DMF', 'CMF'],
    ['AMF', 'AMF'],
    ['CF'],
  ]),
};

export const FORMATION_KEYS = Object.keys(FORMATIONS);
export const DEFAULT_FORMATION = '4-3-3';
