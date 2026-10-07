import pino from 'pino';
import pretty from 'pino-pretty';

export function createLogger(env) {
  const options = {
    level: env.logLevel,
    base: { service: 'elo-league-api' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  };

  // Readable output while developing; one JSON object per line everywhere else.
  if (env.isDev) {
    return pino(
      options,
      pretty({
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname,service',
        sync: true,
      })
    );
  }
  return pino(options);
}
