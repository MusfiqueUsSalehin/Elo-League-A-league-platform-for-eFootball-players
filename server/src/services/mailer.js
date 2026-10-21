import nodemailer from 'nodemailer';

/**
 * The one place that knows how an email leaves the app. `send` resolves once the message is
 * accepted and throws if it is not, which is what lets the outbox retry.
 */
export function createMailer(
  config,
  logger,
  { createTransport = nodemailer.createTransport } = {}
) {
  if (config.mode === 'smtp') {
    const transport = createTransport(config.smtp);
    return {
      mode: 'smtp',
      async send({ to, subject, html, text }) {
        await transport.sendMail({ from: config.from, to, subject, html, text });
      },
    };
  }

  if (config.mode === 'console') {
    return {
      mode: 'console',
      async send({ to, subject, text }) {
        logger.info({ to, subject }, `email (not sent, console mode)\n${text}`);
      },
    };
  }

  return {
    mode: 'off',
    async send() {
      throw new Error('Email is turned off');
    },
  };
}
