// Lecturer registration, the lecturer's course list and class-session control.
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation, uniqueViolationTarget } from '../utils/dbErrors.js';
import { hashPassword, serializeUser } from './authService.js';
import { assertModulesOffered, programDisplayName, serializeModule } from './catalogService.js';
import { assertTeachesModule } from './ownershipService.js';
import { getCurrentSemester, requireCurrentSemester, serializeSemester } from './semesterService.js';

export async function assertUserIsNew(email, workId, excludeId = undefined) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { workId }], ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { email: true, workId: true },
  });
  if (existing?.workId === workId) throw AppError.conflict('This work ID is already registered.', 'DUPLICATE_WORK_ID');
  if (existing?.email === email) throw AppError.conflict('This email address is already registered.', 'DUPLICATE_EMAIL');
}

export function userConflictError(err) {
  const target = uniqueViolationTarget(err);
  if (target.includes('email')) return AppError.conflict('This email address is already registered.', 'DUPLICATE_EMAIL');
  return AppError.conflict('This work ID is already registered.', 'DUPLICATE_WORK_ID');
}

/**
 * Two-step lecturer registration (both steps are submitted together):
 * account details, then the SCIT programmes and current-semester courses
 * the lecturer teaches. Creates the LECTURER account and its
 * lecturer_modules rows in one transaction. The role is always LECTURER -
 * administrator accounts can never be created through this endpoint.
 */
export async function registerLecturer(input) {
  const semester = await requireCurrentSemester();

  const programIds = [...new Set(input.programIds)];
  const programCount = await prisma.program.count({ where: { id: { in: programIds } } });
  if (programCount !== programIds.length) {
    throw AppError.badRequest('One or more selected programmes do not exist.', 'INVALID_PROGRAM');
  }

  const moduleIds = [...new Set(input.moduleIds)];
  await assertModulesOffered(programIds, moduleIds, semester.term);
  await assertUserIsNew(input.email, input.workId);

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          workId: input.workId,
          passwordHash,
          role: 'LECTURER',
        },
      });
      await tx.lecturerModule.createMany({
        data: moduleIds.map((moduleId) => ({ userId: created.id, moduleId, semesterId: semester.id })),
      });
      return created;
    });
    return { user: serializeUser(user), semester: serializeSemester(semester), assignedModuleCount: moduleIds.length };
  } catch (err) {
    if (isUniqueViolation(err)) throw userConflictError(err);
    throw err;
  }
}

/**
 * The lecturer's courses. scope='current' (dashboard): assignments for the
 * current semester, each with its open session (if any) and live count.
 * scope='all' (attendance page): every module ever assigned to them.
 */
export async function getLecturerCourses(userId, scope = 'current') {
  const semester = scope === 'current' ? await getCurrentSemester() : null;
  if (scope === 'current' && !semester) return { semester: null, courses: [] };

  const assignments = await prisma.lecturerModule.findMany({
    where: { userId, ...(semester ? { semesterId: semester.id } : {}) },
    include: {
      module: { include: { programModules: { include: { program: true } } } },
      semester: true,
    },
    orderBy: [{ module: { code: 'asc' } }],
  });

  // Open sessions this lecturer currently has, keyed by module.
  const openSessions = await prisma.classSession.findMany({
    where: { lecturerId: userId, closedAt: null },
    include: { _count: { select: { attendance: true } } },
  });
  const openByModule = new Map(openSessions.map((s) => [s.moduleId, s]));

  const seen = new Set();
  const courses = [];
  for (const a of assignments) {
    if (seen.has(a.moduleId)) continue; // scope=all: one entry per module
    seen.add(a.moduleId);
    const open = openByModule.get(a.moduleId);
    courses.push({
      ...serializeModule(a.module),
      programs: [...new Set(a.module.programModules.map((pm) => programDisplayName(pm.program)))].sort(),
      semester: serializeSemester(a.semester),
      openSession: open
        ? { id: open.id, openedAt: open.openedAt, attendanceCount: open._count.attendance }
        : null,
    });
  }

  return { semester: serializeSemester(semester), courses };
}

/** Open an attendance session for one of the lecturer's current-semester courses. */
export async function openSession(userId, moduleId) {
  const semester = await requireCurrentSemester();
  await assertTeachesModule(userId, moduleId, semester.id);

  const existing = await prisma.classSession.findFirst({
    where: { lecturerId: userId, moduleId, semesterId: semester.id, closedAt: null },
  });
  if (existing) {
    throw AppError.conflict('You already have an open session for this course. Close it before opening another.', 'SESSION_ALREADY_OPEN');
  }

  try {
    // opened_at is set by PostgreSQL (DEFAULT now()), not by the client.
    const session = await prisma.classSession.create({
      data: { moduleId, lecturerId: userId, semesterId: semester.id },
      include: { module: true },
    });
    return serializeSession(session);
  } catch (err) {
    // The partial unique index allows only one open session per lecturer,
    // module and semester - this catches a double-click race.
    if (isUniqueViolation(err)) {
      throw AppError.conflict('You already have an open session for this course.', 'SESSION_ALREADY_OPEN');
    }
    throw err;
  }
}

/**
 * Close a session. Ownership has already been verified by the
 * requireSessionOwnership middleware; the UPDATE only succeeds while the
 * session is still open, and closed_at comes from the database clock.
 */
export async function closeSession(sessionId) {
  const rows = await prisma.$queryRaw`
    UPDATE class_sessions
    SET closed_at = now()
    WHERE id = ${sessionId} AND closed_at IS NULL
    RETURNING id`;
  if (rows.length === 0) {
    throw AppError.conflict('This session is already closed.', 'SESSION_ALREADY_CLOSED');
  }
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { module: true, _count: { select: { attendance: true } } },
  });
  return serializeSession(session);
}

function serializeSession(session) {
  return {
    id: session.id,
    moduleId: session.moduleId,
    module: session.module ? { code: session.module.code, name: session.module.name } : undefined,
    semesterId: session.semesterId,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    isOpen: session.closedAt === null,
    attendanceCount: session._count?.attendance,
  };
}
