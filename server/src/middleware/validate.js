import ApiError from '../utils/ApiError.js';

/**
 * Validates req[source] against a zod schema and replaces it with the parsed value,
 * so handlers only ever see coerced, known-good data.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(
        (issue) => `${issue.path.join('.') || source}: ${issue.message}`
      );
      return next(ApiError.badRequest('Some fields need fixing', details));
    }
    req[source] = result.data;
    next();
  };
