// Authentication and role-based authorization middleware.
//
// The login endpoints store only { id, role } in the server-side session.
// On every protected request we reload the user from the database, so a
// deleted account or a changed role takes effect immediately, and nothing the
// browser sends (user IDs, roles in React state, ...) is ever trusted.
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';

const ROLE_LABELS = { LECTURER: 'lecturers', ADMIN: 'administrators' };

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

/** Reject the request unless it carries a valid, logged-in session. */
export async function requireAuth(req, _res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser?.id) {
    throw AppError.unauthorized('Please sign in to continue.', 'UNAUTHENTICATED');
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, workId: true, firstName: true, lastName: true, email: true, role: true },
  });

  // Account deleted, or its role changed since login: the session is no
  // longer valid, so end it and make the user sign in again.
  if (!user || user.role !== sessionUser.role) {
    await destroySession(req);
    throw AppError.unauthorized('Your session is no longer valid. Please sign in again.', 'SESSION_INVALID');
  }

  req.user = user;
  next();
}

/** Allow only users whose (database) role is one of `roles`. Use after requireAuth. */
export function requireRole(...roles) {
  return function checkRole(req, _res, next) {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) {
      const who = roles.map((r) => ROLE_LABELS[r] ?? r).join(' or ');
      throw AppError.forbidden(`This area is only available to ${who}.`, 'WRONG_ROLE');
    }
    next();
  };
}

/** Only authenticated LECTURER accounts. */
export const requireLecturer = [requireAuth, requireRole('LECTURER')];

/** Only authenticated ADMIN accounts. */
export const requireAdmin = [requireAuth, requireRole('ADMIN')];
