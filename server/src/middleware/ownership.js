// Resource-ownership middleware for lecturer routes. Run after requireLecturer
// and validate(), so req.user and req.validated are already trusted.
import { assertTeachesModule, loadOwnedSession } from '../services/ownershipService.js';

/**
 * Require that the lecturer teaches the module named by `moduleId` in the
 * validated request part ('query' or 'body'), in any semester.
 */
export function requireModuleOwnership(part = 'query') {
  return async function checkModuleOwnership(req, _res, next) {
    await assertTeachesModule(req.user.id, req.validated[part].moduleId);
    next();
  };
}

/** Require that the class session in :id belongs to the lecturer. */
export async function requireSessionOwnership(req, _res, next) {
  req.classSession = await loadOwnedSession(req.user.id, req.validated.params.id);
  next();
}
