import ApiError from './ApiError.js';

/** Use as `.catch(onDuplicate('message'))` to turn a unique-index violation into a 409. */
export const onDuplicate = (message) => (err) => {
  if (err?.code === 11000) throw ApiError.conflict(message);
  throw err;
};
