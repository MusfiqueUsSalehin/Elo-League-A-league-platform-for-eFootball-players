import { z } from 'zod';
import { MAX_TEAMS_PER_OWNER } from '../config/limits.js';
import Footballer from '../models/Footballer.js';
import Team, { FORMATION_KEYS } from '../models/Team.js';
import User from '../models/User.js';
import { loadTeam } from '../services/teamAccess.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { onDuplicate } from '../utils/duplicates.js';
import { escapeRegex } from '../utils/query.js';
import { NOTHING_TO_CHANGE, atLeastOne, objectId } from '../utils/schemas.js';

const teamName = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(40, 'Use at most 40 characters');
const formation = z.enum(FORMATION_KEYS);

// zod drops keys that are not listed, so a request can never set `owner`, `lineup` and the like.
export const idParams = z.object({ id: objectId });

export const listQuery = z.object({
  q: z.string().trim().max(40).optional(),
  mine: z.enum(['true', 'false']).optional(),
  owner: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTeamSchema = z.object({
  name: teamName,
  formation: formation.optional(),
  ownerId: objectId.optional(),
});

export const updateTeamSchema = z
  .object({ name: teamName.optional(), formation: formation.optional() })
  .refine(atLeastOne, NOTHING_TO_CHANGE);

export const lineupSchema = z.object({
  formation,
  starters: z
    .array(
      z.object({
        slot: z.number().int().min(0).max(10),
        footballer: objectId,
      })
    )
    .max(11),
});

const DUPLICATE_NAME = 'You already have a team with that name';

/**
 * Squad size and average rating for a set of teams, in one query. A squad holds at most 40
 * players, so adding the ratings up here is cheaper than it looks and easy to follow.
 */
async function squadStats(teamIds) {
  const members = await Footballer.find({ team: { $in: teamIds } })
    .select('team rating')
    .lean();

  const totals = new Map();
  for (const { team, rating } of members) {
    const entry = totals.get(String(team)) ?? { size: 0, total: 0 };
    entry.size += 1;
    entry.total += rating;
    totals.set(String(team), entry);
  }

  return new Map(
    [...totals].map(([id, { size, total }]) => [
      id,
      { squadSize: size, squadRating: Math.round((total / size) * 10) / 10 },
    ])
  );
}

const withStats = (team, stats) => ({
  ...team.toJSON(),
  squadSize: stats?.squadSize ?? 0,
  squadRating: stats?.squadRating ?? 0,
});

export const listTeams = asyncHandler(async (req, res) => {
  const { q, mine, owner, page, limit } = req.query;
  const filter = {};
  if (mine === 'true') filter.owner = req.user._id;
  else if (owner) filter.owner = owner;
  if (q) filter.nameKey = new RegExp(escapeRegex(q.toLowerCase()));

  const [teams, total] = await Promise.all([
    Team.find(filter)
      .sort({ nameKey: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'name username'),
    Team.countDocuments(filter),
  ]);
  const stats = await squadStats(teams.map((team) => team._id));

  res.json({
    success: true,
    items: teams.map((team) => withStats(team, stats.get(String(team._id)))),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

export const createTeam = asyncHandler(async (req, res) => {
  const { name, formation: chosenFormation, ownerId } = req.body;

  let owner = req.user;
  if (ownerId && ownerId !== String(req.user._id)) {
    if (req.user.role !== 'admin') {
      throw ApiError.forbidden('Only an admin can create a team for someone else');
    }
    owner = await User.findById(ownerId);
    if (!owner?.isActive) throw ApiError.notFound('No such active player');
  }

  if ((await Team.countDocuments({ owner: owner._id })) >= MAX_TEAMS_PER_OWNER) {
    throw ApiError.conflict(`A player can have at most ${MAX_TEAMS_PER_OWNER} teams`);
  }

  const team = await Team.create({
    owner: owner._id,
    name,
    ...(chosenFormation && { formation: chosenFormation }),
  }).catch(onDuplicate(DUPLICATE_NAME));
  await team.populate('owner', 'name username');

  res.status(201).json({ success: true, team: withStats(team) });
});

export const getTeam = asyncHandler(async (req, res) => {
  const team = await loadTeam(req);
  const squad = await Footballer.find({ team: team._id }).sort({ rating: -1, nameKey: 1 });
  const stats = await squadStats([team._id]);

  res.json({ success: true, team: withStats(team, stats.get(String(team._id))), squad });
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });
  team.set(req.body);
  await team.save().catch(onDuplicate(DUPLICATE_NAME));

  res.json({ success: true, team: withStats(team) });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });
  // Squad first: if this stops halfway, the team is still there and can be deleted again.
  await Footballer.deleteMany({ team: team._id });
  await team.deleteOne();

  res.json({ success: true });
});

export const setLineup = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });
  const { formation: chosenFormation, starters } = req.body;

  if (new Set(starters.map((starter) => starter.slot)).size !== starters.length) {
    throw ApiError.badRequest('Each position can hold only one player');
  }
  const ids = [...new Set(starters.map((starter) => starter.footballer))];
  if (ids.length !== starters.length) throw ApiError.badRequest('A player can only start once');

  const inSquad = await Footballer.countDocuments({ team: team._id, _id: { $in: ids } });
  if (inSquad !== ids.length) {
    throw ApiError.badRequest('Every starter must be in this team\u2019s squad');
  }

  team.formation = chosenFormation;
  team.lineup = [...starters].sort((a, b) => a.slot - b.slot);
  await team.save();

  res.json({ success: true, team: withStats(team) });
});
