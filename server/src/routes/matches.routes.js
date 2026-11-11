import { Router } from 'express';
import {
  createMatchesController,
  idParams,
  listQuery,
  rescheduleSchema,
} from '../controllers/matches.controller.js';
import { validate } from '../middleware/validate.js';

export function createMatchRoutes({ auth, notify }) {
  const router = Router();
  const matches = createMatchesController({ notify });
  router.use(auth.protect);

  router.get('/', validate(listQuery, 'query'), matches.list);
  router.get('/:id', validate(idParams, 'params'), matches.get);
  router.patch(
    '/:id',
    auth.requireAdmin,
    validate(idParams, 'params'),
    validate(rescheduleSchema),
    matches.reschedule
  );

  return router;
}
