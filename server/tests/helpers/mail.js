/** A mailer that records what it was asked to send, or fails on demand. */
export function fakeMailer({ mode = 'smtp', failWith } = {}) {
  const sent = [];
  return {
    mode,
    sent,
    async send(message) {
      if (failWith) throw new Error(failWith);
      sent.push(message);
    },
  };
}

/** A logger that keeps what it was told, so tests can check for warnings and errors. */
export function recordingLogger() {
  const lines = { info: [], warn: [], error: [] };
  return {
    lines,
    info: (...args) => lines.info.push(args),
    warn: (...args) => lines.warn.push(args),
    error: (...args) => lines.error.push(args),
  };
}
