import { z } from 'zod';
import {
  MAX_IMPORT_CHARS,
  MAX_IMPORT_LINES,
  MAX_SQUAD_SIZE,
  RATING_MAX,
  RATING_MIN,
} from '../config/limits.js';
import Footballer, { POSITIONS } from '../models/Footballer.js';
import { parseSquadText } from '../services/squadImport.js';
import { loadTeam } from '../services/teamAccess.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { onDuplicate } from '../utils/duplicates.js';
import { NOTHING_TO_CHANGE, atLeastOne, objectId } from '../utils/schemas.js';

const name = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(40, 'Use at most 40 characters');
const position = z.enum(POSITIONS);
const rating = z
  .number({ invalid_type_error: 'Rating must be a number' })
  .int('Rating must be a whole number')
  .min(RATING_MIN)
  .max(RATING_MAX);

export const squadParams = z.object({ id: objectId, playerId: objectId });

export const footballerSchema = z.object({ name, position, rating });

export const updateFootballerSchema = z
  .object({ name: name.optional(), position: position.optional(), rating: rating.optional() })
  .refine(atLeastOne, NOTHING_TO_CHANGE);

export const importSchema = z.object({ text: z.string().max(MAX_IMPORT_CHARS) });

const DUPLICATE = 'That player is already in the squad';

async function findFootballer(team, id) {
  const footballer = await Footballer.findOne({ _id: id, team: team._id });
  if (!footballer) throw ApiError.notFound('No such player in this squad');
  return footballer;
}

export const addFootballer = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });

  if ((await Footballer.countDocuments({ team: team._id })) >= MAX_SQUAD_SIZE) {
    throw ApiError.conflict(`A squad can hold at most ${MAX_SQUAD_SIZE} players`);
  }
  const footballer = await Footballer.create({ team: team._id, ...req.body }).catch(
    onDuplicate(DUPLICATE)
  );

  res.status(201).json({ success: true, footballer });
});

export const updateFootballer = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });
  const footballer = await findFootballer(team, req.params.playerId);

  footballer.set(req.body);
  await footballer.save().catch(onDuplicate(DUPLICATE));

  res.json({ success: true, footballer });
});

export const deleteFootballer = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });
  const footballer = await findFootballer(team, req.params.playerId);

  await footballer.deleteOne();

  // A player who has left the squad cannot stay in the starting XI.
  const remaining = team.lineup.filter(
    (starter) => String(starter.footballer) !== String(footballer._id)
  );
  if (remaining.length !== team.lineup.length) {
    team.lineup = remaining;
    await team.save();
  }

  res.json({ success: true });
});

export const importSquad = asyncHandler(async (req, res) => {
  const team = await loadTeam(req, { write: true });

  const { entries, errors, lineCount } = parseSquadText(req.body.text);
  if (lineCount === 0) throw ApiError.badRequest('Paste at least one player');
  if (lineCount > MAX_IMPORT_LINES) {
    throw ApiError.badRequest(`Paste at most ${MAX_IMPORT_LINES} players at a time`);
  }

  const existing = await Footballer.find({ team: team._id }).select('nameKey');
  const taken = new Set(existing.map((footballer) => footballer.nameKey));
  let room = MAX_SQUAD_SIZE - existing.length;

  const toAdd = [];
  const skipped = [...errors];
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    const skip = (reason) => skipped.push({ line: entry.line, text: entry.text, reason });

    if (taken.has(key)) skip('Already in the squad');
    else if (room <= 0) skip('The squad is full');
    else {
      taken.add(key);
      room -= 1;
      toAdd.push({
        team: team._id,
        name: entry.name,
        position: entry.position,
        rating: entry.rating,
      });
    }
  }

  const added = toAdd.length > 0 ? await Footballer.insertMany(toAdd) : [];
  skipped.sort((a, b) => a.line - b.line);

  res.status(201).json({ success: true, added, skipped });
});
