export default class ApiError extends Error {
  constructor(statusCode, message, details = undefined, code = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'You need to sign in to continue') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have access to this', code) {
    return new ApiError(403, message, undefined, code);
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }
  static conflict(message = 'That already exists') {
    return new ApiError(409, message);
  }
}
