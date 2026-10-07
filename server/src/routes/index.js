import { Router } from 'express';
import { createHealthRoutes } from './health.routes.js';

export function createRoutes(deps) {
  const router = Router();
  router.use(createHealthRoutes(deps));
  return router;
}
