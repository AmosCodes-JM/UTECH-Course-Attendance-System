// Zod request validation.
//
// validate({ params, query, body }) parses each part of the request with its
// schema. Invalid input is rejected with 400 and a list of field errors.
// Parsed (and type-coerced) values are placed on req.validated, which is what
// controllers read - so unknown or unexpected fields never reach a service.
import { AppError } from '../utils/AppError.js';

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || null,
    message: issue.message,
  }));
}

export function validate(schemas) {
  return function validateRequest(req, _res, next) {
    const validated = { ...req.validated };
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        throw AppError.badRequest('Some of the information sent is invalid.', 'VALIDATION_ERROR', formatIssues(result.error));
      }
      validated[part] = result.data;
    }
    req.validated = validated;
    next();
  };
}
