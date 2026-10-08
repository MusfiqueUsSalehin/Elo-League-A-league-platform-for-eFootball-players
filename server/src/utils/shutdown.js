/**
 * Stops accepting connections, lets in-flight requests finish, closes resources,
 * then exits. Readiness flips to "unavailable" first so a load balancer drains us.
 * `state.shuttingDown` is shared with the readiness check.
 */
export function registerGracefulShutdown({
  server,
  logger,
  state,
  onShutdown,
  timeoutMs = 10_000,
}) {
  const shutdown = async (reason, exitCode = 0) => {
    if (state.shuttingDown) return;
    state.shuttingDown = true;
    logger.info({ reason }, 'shutting down');

    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, 'shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    try {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      await onShutdown?.();
      logger.info('shutdown complete');
      process.exit(exitCode);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'unhandled promise rejection');
    shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    shutdown('uncaughtException', 1);
  });
}
