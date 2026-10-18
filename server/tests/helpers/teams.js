import Footballer from '../../src/models/Footballer.js';
import Team from '../../src/models/Team.js';

let counter = 0;

/** Inserts a team directly, owned by `owner`. */
export function createTeam(owner, overrides = {}) {
  const n = ++counter;
  return Team.create({ owner: owner._id, name: `Team ${n}`, ...overrides });
}

/** Inserts a squad member directly. */
export function createFootballer(team, overrides = {}) {
  const n = ++counter;
  return Footballer.create({
    team: team._id,
    name: `Footballer ${n}`,
    position: 'CMF',
    rating: 80,
    ...overrides,
  });
}

/** Fills a squad with `count` players, quickly. */
export function fillSquad(team, count) {
  return Footballer.insertMany(
    Array.from({ length: count }, (_, i) => ({
      team: team._id,
      name: `Filler ${i + 1}`,
      nameKey: `filler ${i + 1}`,
      position: 'CMF',
      rating: 70,
    }))
  );
}
