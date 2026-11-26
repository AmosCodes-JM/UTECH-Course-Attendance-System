// Central error handling. Every error ends up here and is turned into a JSON
// response of the form { success: false, message, code, errors? }.
// Raw database errors and stack traces are never sent to the client.
import { AppError } from '../utils/AppError.js';
import { isCheckViolation, isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from '../utils/dbErrors.js';
import { config } from '../config/env.js';

export function notFound(req, _res, next) {
  next(AppError.notFound(`No API endpoint matches ${req.method} ${req.originalUrl}.`, 'ROUTE_NOT_FOUND'));
}

function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err?.type === 'entity.parse.failed')
    return AppError.badRequest('The request body is not valid JSON.', 'INVALID_JSON');
  if (err?.type === 'entity.too.large') return new AppError(413, 'The request is too large.', 'PAYLOAD_TOO_LARGE');
  if (isUniqueViolation(err)) return AppError.conflict('That record already exists.', 'DUPLICATE');
  if (isForeignKeyViolation(err)) {
    return AppError.conflict('This record is linked to other records, so it cannot be changed or deleted.', 'IN_USE');
  }
  if (isRecordNotFound(err)) return AppError.notFound('The requested record was not found.');
  if (isCheckViolation(err)) return AppError.badRequest('The data breaks a database rule.', 'CONSTRAINT_FAILED');
  return null;
}

// Express recognises error handlers by their four arguments.
export function errorHandler(err, req, res, _next) {
  const appError = toAppError(err);

  if (!appError) {
    if (!config.isTest) console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong on our side. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  }

  const body = { success: false, message: appError.message, code: appError.code };
  if (appError.details) body.errors = appError.details;
  res.status(appError.status).json(body);
}
