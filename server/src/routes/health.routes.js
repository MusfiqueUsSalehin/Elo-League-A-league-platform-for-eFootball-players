import { Router } from 'express';

export function createHealthRoutes({ env }) {
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

  return router;
}
