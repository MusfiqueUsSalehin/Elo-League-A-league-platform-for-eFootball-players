import { Router } from 'express';
import {
  createUserSchema,
  createUsersController,
  idParams,
  listQuery,
  profileSchema,
  resetPasswordSchema,
  updateUserSchema,
} from '../controllers/users.controller.js';
import { validate } from '../middleware/validate.js';

export function createUserRoutes({ env, auth }) {
  const router = Router();
  const ctrl = createUsersController({ env });

  router.use(auth.protect);

  // Routes open to any signed-in user. Fixed paths go before /:id so they are not read as an id.
  router.patch('/profile', validate(profileSchema), ctrl.updateProfile);
  router.get('/:id', validate(idParams, 'params'), ctrl.getUser);

  router.use(auth.requireAdmin);
  router.get('/', validate(listQuery, 'query'), ctrl.listUsers);
  router.post('/', validate(createUserSchema), ctrl.createUser);
  router.patch('/:id', validate(idParams, 'params'), validate(updateUserSchema), ctrl.updateUser);
  router.post(
    '/:id/reset-password',
    validate(idParams, 'params'),
    validate(resetPasswordSchema),
    ctrl.resetPassword
  );

  return router;
}
