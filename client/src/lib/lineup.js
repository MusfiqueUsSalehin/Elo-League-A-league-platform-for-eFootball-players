// A line-up is kept as an object of slot number -> squad player id while it is being edited.
// The server stores the same thing as a list of { slot, footballer }.

export const STARTERS_NEEDED = 11;

export const lineupFromTeam = (team) =>
  Object.fromEntries((team.lineup ?? []).map(({ slot, footballer }) => [slot, footballer]));

export const startersFrom = (lineup) =>
  Object.entries(lineup)
    .map(([slot, footballer]) => ({ slot: Number(slot), footballer }))
    .sort((a, b) => a.slot - b.slot);

/** Puts a player in a slot. A player can only start once, so they leave any slot they held. */
export function assignToSlot(lineup, slot, footballerId) {
  const next = Object.fromEntries(
    Object.entries(lineup).filter(([, existing]) => existing !== footballerId)
  );
  next[slot] = footballerId;
  return next;
}

export function clearSlot(lineup, slot) {
  const next = { ...lineup };
  delete next[slot];
  return next;
}

export const startingIds = (lineup) => new Set(Object.values(lineup));

export const isComplete = (lineup) => Object.keys(lineup).length === STARTERS_NEEDED;

export function sameLineup(a, b) {
  const left = Object.entries(a);
  return left.length === Object.keys(b).length && left.every(([slot, id]) => b[slot] === id);
}

/** Squad players ordered for picking into a slot: the natural position first, then by rating. */
export function orderForSlot(squad, label) {
  return [...squad].sort((a, b) => {
    const natural = Number(b.position === label) - Number(a.position === label);
    return natural || b.rating - a.rating || a.name.localeCompare(b.name);
  });
}
