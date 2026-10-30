import { Router } from 'express';
import {
  changeStatus,
  createTournament,
  createTournamentSchema,
  deleteTournament,
  getTournament,
  idParams,
  listQuery,
  listTournaments,
  statusSchema,
  updateTournament,
  updateTournamentSchema,
} from '../controllers/tournaments.controller.js';
import {
  createEntriesController,
  decisionSchema,
  enterSchema,
  entryParams,
  seedsSchema,
  tournamentParams,
} from '../controllers/tournamentEntries.controller.js';
import { validate } from '../middleware/validate.js';

export function createTournamentRoutes({ auth, notify }) {
  const router = Router();
  const entries = createEntriesController({ notify });
  router.use(auth.protect);

  // Everyone signed in can look; only an admin can change anything.
  router.get('/', validate(listQuery, 'query'), listTournaments);
  router.get('/:id', validate(idParams, 'params'), getTournament);

  router.post('/', auth.requireAdmin, validate(createTournamentSchema), createTournament);
  router.patch(
    '/:id',
    auth.requireAdmin,
    validate(idParams, 'params'),
    validate(updateTournamentSchema),
    updateTournament
  );
  router.post(
    '/:id/status',
    auth.requireAdmin,
    validate(idParams, 'params'),
    validate(statusSchema),
    changeStatus
  );
  router.delete('/:id', auth.requireAdmin, validate(idParams, 'params'), deleteTournament);

  // Entries: anyone can see who is in; managers enter their own team; admins decide and seed.
  router.get('/:id/entries', validate(tournamentParams, 'params'), entries.list);
  router.post(
    '/:id/entries',
    validate(tournamentParams, 'params'),
    validate(enterSchema),
    entries.enter
  );
  router.patch(
    '/:id/entries/:entryId',
    auth.requireAdmin,
    validate(entryParams, 'params'),
    validate(decisionSchema),
    entries.decide
  );
  router.delete('/:id/entries/:entryId', validate(entryParams, 'params'), entries.withdraw);
  router.put(
    '/:id/seeds',
    auth.requireAdmin,
    validate(tournamentParams, 'params'),
    validate(seedsSchema),
    entries.setSeeds
  );

  return router;
}
