import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';

async function check(isReady) {
  try {
    return Boolean(await isReady());
  } catch {
    return false;
  }
}

export function createHealthRoutes({ env, isReady }) {
  const router = Router();

  // Liveness: the process is up and able to answer.
  router.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({
      success: true,
      status: 'ok',
      name: env.appName,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  // Readiness: dependencies are reachable, so traffic may be routed here.
  router.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      const ready = await check(isReady);
      res
        .set('Cache-Control', 'no-store')
        .status(ready ? 200 : 503)
        .json({ success: ready, status: ready ? 'ready' : 'unavailable' });
    })
  );

  return router;
}
