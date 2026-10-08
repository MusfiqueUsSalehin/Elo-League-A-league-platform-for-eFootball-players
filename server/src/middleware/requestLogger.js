import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';

const SAFE_ID = /^[\w-]{8,64}$/;
const QUIET_PATHS = new Set(['/api/health', '/api/ready']);

export function requestLogger(logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url) },
  });
}
