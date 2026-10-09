import ApiError from '../utils/ApiError.js';

export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/** Maps any thrown value to a status and a message that is safe to show. */
function toResponse(err) {
  if (err instanceof ApiError) {
    return {
      status: err.statusCode,
      message: err.message,
      details: err.details,
      code: err.code,
    };
  }
  if (err.type === 'entity.parse.failed') {
    return { status: 400, message: 'The request body is not valid JSON' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, message: 'The request body is too large' };
  }
  if (err.name === 'ValidationError' && err.errors) {
    return {
      status: 400,
      message: 'Some fields need fixing',
      details: Object.values(err.errors).map((e) => e.message),
    };
  }
  if (err.name === 'CastError') {
    return { status: 400, message: `Invalid value for ${err.path}` };
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ') || 'That value';
    return { status: 409, message: `${fields} is already taken` };
  }
  const status = err.statusCode ?? err.status;
  if (status >= 400 && status < 500 && err.expose) {
    return { status, message: err.message };
  }
  return { status: 500, message: 'Something went wrong on the server' };
}

export const errorHandler =
  ({ isProd }) =>
  (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const { status, message, details, code } = toResponse(err);
    if (status >= 500) (req.log ?? console).error({ err }, 'unhandled error');

    res.status(status).json({
      success: false,
      // Server errors only reveal their real message outside production.
      message: status >= 500 && !isProd ? err.message || message : message,

      ...(details ? { details } : {}),
      ...(code ? { code } : {}),
      ...(req.id ? { requestId: req.id } : {}),
      ...(isProd ? {} : { stack: err.stack }),
    });
  };
