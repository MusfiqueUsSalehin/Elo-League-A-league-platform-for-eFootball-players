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
import { validate } from '../middleware/validate.js';

export function createTournamentRoutes({ auth }) {
  const router = Router();
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

  return router;
}
