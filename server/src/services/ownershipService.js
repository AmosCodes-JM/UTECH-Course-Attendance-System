// Lecturer resource-ownership rules.
//
// Having the LECTURER role is not enough: a lecturer may only open, close or
// view sessions (and attendance) for modules assigned to them in
// lecturer_modules, and may only close sessions they opened themselves.
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';

/**
 * Throw 403 unless the lecturer is assigned to the module - in a specific
 * semester when `semesterId` is given, otherwise in any semester.
 */
export async function assertTeachesModule(userId, moduleId, semesterId = undefined) {
  const assignment = await prisma.lecturerModule.findFirst({
    where: { userId, moduleId, ...(semesterId ? { semesterId } : {}) },
    select: { moduleId: true },
  });
  if (!assignment) {
    throw AppError.forbidden('This course is not assigned to you.', 'NOT_YOUR_COURSE');
  }
}

/**
 * Load a class session and verify the lecturer owns it: they opened it and
 * the module is assigned to them for the session's semester.
 */
export async function loadOwnedSession(userId, sessionId) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { module: { select: { id: true, code: true, name: true } } },
  });
  if (!session) throw AppError.notFound('That class session does not exist.', 'SESSION_NOT_FOUND');

  if (session.lecturerId !== userId) {
    throw AppError.forbidden('This class session belongs to another lecturer.', 'NOT_YOUR_SESSION');
  }
  await assertTeachesModule(userId, session.moduleId, session.semesterId);
  return session;
}
