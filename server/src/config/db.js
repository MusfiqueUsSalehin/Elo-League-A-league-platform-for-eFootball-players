import mongoose from 'mongoose';

export async function connectDB(uri, logger) {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => logger.warn('mongodb disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('mongodb reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'mongodb connection error'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  // Log the host and database only. The URI contains credentials.
  const { host, name } = mongoose.connection;
  logger.info({ host, database: name }, 'mongodb connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

/** True only when the connection is open and the server answers a ping. */
export async function isDbReady() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
