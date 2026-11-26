// Attendance check-in and lecturer attendance queries.
import { prisma } from '../db/client.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import { dayRangeUtc } from '../utils/dates.js';

const ALREADY_CHECKED_IN = 'Attendance has already been recorded for this session.';

/**
 * Record a student's attendance for an open class session.
 *
 * Duplicate prevention works on three levels:
 *  1. the kiosk disables the button after one tap (frontend),
 *  2. this function checks for an existing record (backend), and
 *  3. the UNIQUE (session_id, student_id) constraint rejects any duplicate
 *     that slips past 1 and 2 - e.g. two requests arriving at the same
 *     moment. That error is caught below and returned as 409 Conflict.
 *
 * The check-in time is never taken from the client: checked_in_at defaults
 * to now() inside PostgreSQL.
 */
export async function checkIn({ idNumber, sessionId }) {
  const student = await prisma.student.findUnique({ where: { idNumber }, select: { id: true } });
  if (!student) throw AppError.notFound('We could not find a student with that ID number.', 'STUDENT_NOT_FOUND');

  try {
    return await prisma.$transaction(async (tx) => {
      // FOR SHARE locks the session row until we commit, so a lecturer
      // closing the session at this exact moment waits for us (or we see it
      // closed) - a check-in can never land in an already-closed session.
      const [session] = await tx.$queryRaw`
        SELECT id, module_id, semester_id, closed_at
        FROM class_sessions
        WHERE id = ${sessionId}
        FOR SHARE`;

      if (!session) throw AppError.notFound('That class session does not exist.', 'SESSION_NOT_FOUND');
      if (session.closed_at !== null) {
        throw AppError.conflict('This class session has been closed. Check-in is no longer possible.', 'SESSION_CLOSED');
      }

      const enrollment = await tx.enrollment.findUnique({
        where: {
          studentId_moduleId_semesterId: {
            studentId: student.id,
            moduleId: session.module_id,
            semesterId: session.semester_id,
          },
        },
      });
      if (!enrollment) {
        throw AppError.forbidden('You are not enrolled in this course, so you cannot check in to it.', 'NOT_ENROLLED');
      }

      const existing = await tx.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
        select: { id: true },
      });
      if (existing) throw AppError.conflict(ALREADY_CHECKED_IN, 'ALREADY_CHECKED_IN');

      const record = await tx.attendance.create({
        data: { sessionId: session.id, studentId: student.id },
        include: { session: { include: { module: true } } },
      });

      return {
        attendanceId: record.id,
        checkedInAt: record.checkedInAt,
        course: { code: record.session.module.code, name: record.session.module.name },
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw AppError.conflict(ALREADY_CHECKED_IN, 'ALREADY_CHECKED_IN');
    throw err;
  }
}

/**
 * Attendance records for one module, limited to sessions the lecturer
 * opened. Optional `date` ('YYYY-MM-DD') keeps only check-ins made on that
 * calendar day in APP_TIMEZONE. Ownership is verified before this is called.
 */
export async function listAttendance({ lecturerId, moduleId, date }) {
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) throw AppError.notFound('That course does not exist.', 'MODULE_NOT_FOUND');

  const where = { session: { moduleId, lecturerId } };
  if (date) {
    const { start, end } = dayRangeUtc(date, config.timezone);
    where.checkedInAt = { gte: start, lt: end };
  }

  const rows = await prisma.attendance.findMany({
    where,
    include: {
      student: { select: { idNumber: true, firstName: true, lastName: true } },
      session: { select: { id: true, openedAt: true, closedAt: true } },
    },
    orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
  });

  return {
    module: { id: module.id, code: module.code, name: module.name },
    date: date ?? null,
    timezone: config.timezone,
    total: rows.length,
    records: rows.map((r) => ({
      id: r.id,
      studentIdNumber: r.student.idNumber,
      firstName: r.student.firstName,
      lastName: r.student.lastName,
      checkedInAt: r.checkedInAt,
      sessionId: r.session.id,
      sessionOpenedAt: r.session.openedAt,
    })),
  };
}
