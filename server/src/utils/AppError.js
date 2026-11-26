/**
 * An error that is safe to show to API clients.
 *
 * Services throw AppError for expected business-rule failures (not found,
 * already checked in, not your course, ...). The error-handling middleware
 * turns it into a JSON response with the given HTTP status. Any other error
 * is treated as unexpected and reported as a generic 500.
 */
export class AppError extends Error {
  constructor(status, message, code = undefined, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message = 'Please sign in to continue.', code = 'UNAUTHENTICATED') {
    return new AppError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to do that.', code = 'FORBIDDEN') {
    return new AppError(403, message, code);
  }

  static notFound(message = 'Not found.', code = 'NOT_FOUND') {
    return new AppError(404, message, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(409, message, code);
  }
}
