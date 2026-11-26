// Student registration and the check-in lookup ("which of my courses are open?").
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation, uniqueViolationTarget } from '../utils/dbErrors.js';
import { assertEitherOrRespected, assertModulesOffered, serializeProgram } from './catalogService.js';
import { requireCurrentSemester, serializeSemester } from './semesterService.js';

async function assertStudentIsNew(idNumber, email, excludeId = undefined) {
  const existing = await prisma.student.findFirst({
    where: { OR: [{ idNumber }, { email }], ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { idNumber: true, email: true },
  });
  if (existing?.idNumber === idNumber) {
    throw AppError.conflict('A student with this ID number is already registered.', 'DUPLICATE_ID_NUMBER');
  }
  if (existing?.email === email) {
    throw AppError.conflict('This email address is already registered.', 'DUPLICATE_EMAIL');
  }
}

/** Translate a unique-constraint error on students into a friendly 409. */
export function studentConflictError(err) {
  const target = uniqueViolationTarget(err);
  if (target.includes('email'))
    return AppError.conflict('This email address is already registered.', 'DUPLICATE_EMAIL');
  return AppError.conflict('A student with this ID number is already registered.', 'DUPLICATE_ID_NUMBER');
}

/**
 * Register a student and their module enrollments for the current semester.
 * Rules: valid programme, modules offered by that programme this semester,
 * either/or pairs respected, unique ID number and email.
 */
export async function registerStudent(input) {
  const semester = await requireCurrentSemester();

  const program = await prisma.program.findUnique({ where: { id: input.programId } });
  if (!program) throw AppError.badRequest('Please choose a valid programme of study.', 'INVALID_PROGRAM');

  const moduleIds = [...new Set(input.moduleIds)];
  await assertModulesOffered([program.id], moduleIds, semester.term);
  await assertEitherOrRespected(program.id, moduleIds);
  await assertStudentIsNew(input.idNumber, input.email);

  try {
    // Student and enrollments are created together: either both succeed or neither does.
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          idNumber: input.idNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          programId: program.id,
        },
      });
      await tx.enrollment.createMany({
        data: moduleIds.map((moduleId) => ({ studentId: created.id, moduleId, semesterId: semester.id })),
      });
      return created;
    });

    return {
      student: {
        idNumber: student.idNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        program: serializeProgram(program),
      },
      semester: serializeSemester(semester),
      enrolledModuleCount: moduleIds.length,
    };
  } catch (err) {
    // Two registrations racing with the same ID/email: the unique constraint wins.
    if (isUniqueViolation(err)) throw studentConflictError(err);
    throw err;
  }
}

/**
 * Look up a student by ID number and list the courses they can check in to
 * right now: enrolled modules that have an open class session in the same
 * semester as the enrollment.
 */
export async function getOpenCourses(idNumber) {
  const student = await prisma.student.findUnique({
    where: { idNumber },
    include: { program: true, enrollments: { select: { moduleId: true, semesterId: true } } },
  });
  if (!student) {
    throw AppError.notFound('We could not find a student with that ID number.', 'STUDENT_NOT_FOUND');
  }

  let sessions = [];
  if (student.enrollments.length > 0) {
    sessions = await prisma.classSession.findMany({
      where: {
        closedAt: null,
        OR: student.enrollments.map((e) => ({ moduleId: e.moduleId, semesterId: e.semesterId })),
      },
      include: {
        module: true,
        lecturer: { select: { firstName: true, lastName: true } },
        attendance: { where: { studentId: student.id }, select: { checkedInAt: true } },
      },
      orderBy: [{ module: { code: 'asc' } }, { openedAt: 'asc' }],
    });
  }

  return {
    student: {
      idNumber: student.idNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      program: serializeProgram(student.program),
    },
    courses: sessions.map((s) => ({
      sessionId: s.id,
      moduleId: s.module.id,
      code: s.module.code,
      name: s.module.name,
      lecturer: `${s.lecturer.firstName} ${s.lecturer.lastName}`,
      openedAt: s.openedAt,
      alreadyCheckedIn: s.attendance.length > 0,
      checkedInAt: s.attendance[0]?.checkedInAt ?? null,
    })),
  };
}
