import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/error.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createRoutes } from './routes/index.js';

/**
 * Builds the app from its dependencies so tests can inject their own.
 * `deps` carries env, logger and whatever the routes need.
 */
export function createApp(deps) {
  const { env, logger } = deps;
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.use('/api', createRoutes(deps));

  app.use(notFound);
  app.use(errorHandler(env));

  return app;
}
