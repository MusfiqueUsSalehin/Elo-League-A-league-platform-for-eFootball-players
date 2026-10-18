import { jsonResponse, player } from './fakeApi.js';

export const keeper = { _id: 'f1', team: 't1', name: 'David Raya', position: 'GK', rating: 85 };
export const defender = {
  _id: 'f2',
  team: 't1',
  name: 'William Saliba',
  position: 'CB',
  rating: 88,
};
export const winger = { _id: 'f3', team: 't1', name: 'Bukayo Saka', position: 'RWF', rating: 90 };
export const striker = {
  _id: 'f4',
  team: 't1',
  name: 'Erling Haaland',
  position: 'CF',
  rating: 95,
};

/** Best rated first, as the server sends it. */
export const squad = [striker, winger, defender, keeper];

const rahim = { _id: player._id, name: player.name, username: player.username };

/** A team owned by the signed-in `player` fixture. */
export const arsenal = {
  _id: 't1',
  name: 'Arsenal',
  formation: '4-3-3',
  owner: rahim,
  lineup: [],
  squadSize: 4,
  squadRating: 89.5,
  updatedAt: '2026-10-10T10:00:00.000Z',
};

/** A team owned by somebody else. */
export const chelsea = {
  _id: 't2',
  name: 'Chelsea',
  formation: '4-2-3-1',
  owner: { _id: 'u9', name: 'Sadia Rahman', username: 'sadia' },
  lineup: [],
  squadSize: 0,
  squadRating: 0,
  updatedAt: '2026-10-10T10:00:00.000Z',
};

export const teamList = (items, extra = {}) =>
  jsonResponse(200, { success: true, items, total: items.length, page: 1, pages: 1, ...extra });

export const teamDetail = (team, members = squad) =>
  jsonResponse(200, { success: true, team, squad: members });
