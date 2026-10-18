import { Router } from 'express';
import {
  addFootballer,
  deleteFootballer,
  footballerSchema,
  importSchema,
  importSquad,
  squadParams,
  updateFootballer,
  updateFootballerSchema,
} from '../controllers/squad.controller.js';
import {
  createTeam,
  createTeamSchema,
  deleteTeam,
  getTeam,
  idParams,
  lineupSchema,
  listQuery,
  listTeams,
  setLineup,
  updateTeam,
  updateTeamSchema,
} from '../controllers/teams.controller.js';
import { validate } from '../middleware/validate.js';

export function createTeamRoutes({ auth }) {
  const router = Router();
  router.use(auth.protect);

  router.get('/', validate(listQuery, 'query'), listTeams);
  router.post('/', validate(createTeamSchema), createTeam);

  router.get('/:id', validate(idParams, 'params'), getTeam);
  router.patch('/:id', validate(idParams, 'params'), validate(updateTeamSchema), updateTeam);
  router.delete('/:id', validate(idParams, 'params'), deleteTeam);
  router.put('/:id/lineup', validate(idParams, 'params'), validate(lineupSchema), setLineup);

  router.post(
    '/:id/squad',
    validate(idParams, 'params'),
    validate(footballerSchema),
    addFootballer
  );
  router.post(
    '/:id/squad/import',
    validate(idParams, 'params'),
    validate(importSchema),
    importSquad
  );
  router.patch(
    '/:id/squad/:playerId',
    validate(squadParams, 'params'),
    validate(updateFootballerSchema),
    updateFootballer
  );
  router.delete('/:id/squad/:playerId', validate(squadParams, 'params'), deleteFootballer);

  return router;
}
