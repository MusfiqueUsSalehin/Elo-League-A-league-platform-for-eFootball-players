import { Router } from 'express';
import { createAuth } from '../middleware/auth.js';
import { createAuthRoutes } from './auth.routes.js';
import { createHealthRoutes } from './health.routes.js';

export function createRoutes(deps) {
  const router = Router();
  const routeDeps = { ...deps, auth: createAuth(deps) };

  router.use(createHealthRoutes(routeDeps));
  router.use('/auth', createAuthRoutes(routeDeps));

  return router;
}
