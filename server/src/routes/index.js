import { Router } from 'express';
import { createAuth } from '../middleware/auth.js';
import { createAuthRoutes } from './auth.routes.js';
import { createHealthRoutes } from './health.routes.js';
import { createUserRoutes } from './user.routes.js';

export function createRoutes(deps) {
  const router = Router();
  const routeDeps = { ...deps, auth: createAuth(deps) };

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.use(createHealthRoutes(routeDeps));
  router.use('/auth', createAuthRoutes(routeDeps));
  router.use('/users', createUserRoutes(routeDeps));

  return router;
}
