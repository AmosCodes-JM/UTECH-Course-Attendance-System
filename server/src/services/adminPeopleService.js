// Administrator management of people: students and their enrollments,
// lecturer accounts and their course assignments, and administrator accounts.
// Password hashes are never returned - admins cannot see passwords.
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import { hashPassword, serializeUser } from './authService.js';
import { assertEitherOrRespected, programDisplayName, serializeModule, serializeProgram } from './catalogService.js';
import { assertUserIsNew, userConflictError } from './lecturerService.js';
import { getCurrentSemester, serializeSemester } from './semesterService.js';
import { studentConflictError } from './studentService.js';

const searchFilter = (search, fields) =>
  search ? { OR: fields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) } : {};

// --------------------------------------------------------------- students ---

export async function listStudents(search) {
  const current = await getCurrentSemester();
  const students = await prisma.student.findMany({
    where: searchFilter(search, ['idNumber', 'firstName', 'lastName', 'email']),
    include: {
      program: true,
      _count: { select: { enrollments: current ? { where: { semesterId: current.id } } : true, attendance: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 500,
  });
  return students.map((s) => ({
    id: s.id,
    idNumber: s.idNumber,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    program: serializeProgram(s.program),
    createdAt: s.createdAt,
    currentEnrollmentCount: s._count.enrollments,
    attendanceCount: s._count.attendance,
  }));
}

export async function getStudent(id) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      program: true,
      enrollments: {
        include: { module: true, semester: true },
        orderBy: [{ semesterId: 'desc' }, { module: { code: 'asc' } }],
      },
      _count: { select: { attendance: true } },
    },
  });
  if (!student) throw AppError.notFound('Student not found.');
  return {
    id: student.id,
    idNumber: student.idNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    programId: student.programId,
    program: serializeProgram(student.program),
    createdAt: student.createdAt,
    attendanceCount: student._count.attendance,
    enrollments: student.enrollments.map((e) => ({
      module: serializeModule(e.module),
      semester: serializeSemester(e.semester),
    })),
  };
}

export async function updateStudent(id, data) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Student not found.');
  if (data.programId && !(await prisma.program.findUnique({ where: { id: data.programId } }))) {
    throw AppError.badRequest('That programme does not exist.', 'INVALID_PROGRAM');
  }
  try {
    await prisma.student.update({ where: { id }, data });
  } catch (err) {
    if (isUniqueViolation(err)) throw studentConflictError(err);
    throw err;
  }
  return getStudent(id);
}

export async function deleteStudent(id) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: { _count: { select: { attendance: true } } },
  });
  if (!student) throw AppError.notFound('Student not found.');
  if (student._count.attendance > 0) {
    throw AppError.conflict('This student has attendance records, so the account cannot be deleted.', 'IN_USE');
  }
  await prisma.student.delete({ where: { id } }); // enrollments cascade
}

/** Enrol a student in a module for a semester (either/or rule enforced). */
export async function addEnrollment(studentId, { moduleId, semesterId }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw AppError.notFound('Student not found.');
  if (!(await prisma.module.findUnique({ where: { id: moduleId } })))
    throw AppError.badRequest('That module does not exist.');
  if (!(await prisma.semester.findUnique({ where: { id: semesterId } })))
    throw AppError.badRequest('That semester does not exist.');

  const existing = await prisma.enrollment.findMany({ where: { studentId, semesterId }, select: { moduleId: true } });
  await assertEitherOrRespected(student.programId, [...existing.map((e) => e.moduleId), moduleId]);

  try {
    await prisma.enrollment.create({ data: { studentId, moduleId, semesterId } });
  } catch (err) {
    if (isUniqueViolation(err))
      throw AppError.conflict('The student is already enrolled in this module for that semester.', 'DUPLICATE');
    throw err;
  }
  return getStudent(studentId);
}

export async function removeEnrollment(studentId, semesterId, moduleId) {
  const key = { studentId_moduleId_semesterId: { studentId, moduleId, semesterId } };
  if (!(await prisma.enrollment.findUnique({ where: key }))) throw AppError.notFound('Enrollment not found.');
  await prisma.enrollment.delete({ where: key });
  return getStudent(studentId);
}

// -------------------------------------------------------------- lecturers ---

async function findUserWithRole(id, role) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== role) {
    throw AppError.notFound(role === 'LECTURER' ? 'Lecturer not found.' : 'Administrator not found.');
  }
  return user;
}

export async function listLecturers(search) {
  const current = await getCurrentSemester();
  const lecturers = await prisma.user.findMany({
    where: { role: 'LECTURER', ...searchFilter(search, ['workId', 'firstName', 'lastName', 'email']) },
    include: { _count: { select: { lecturerModules: current ? { where: { semesterId: current.id } } : true } } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  return lecturers.map((u) => ({
    ...serializeUser(u),
    createdAt: u.createdAt,
    currentCourseCount: u._count.lecturerModules,
  }));
}

export async function getLecturer(id) {
  const user = await findUserWithRole(id, 'LECTURER');
  const assignments = await prisma.lecturerModule.findMany({
    where: { userId: id },
    include: { module: { include: { programModules: { include: { program: true } } } }, semester: true },
    orderBy: [{ semesterId: 'desc' }, { module: { code: 'asc' } }],
  });
  return {
    ...serializeUser(user),
    createdAt: user.createdAt,
    assignments: assignments.map((a) => ({
      module: serializeModule(a.module),
      programs: [...new Set(a.module.programModules.map((pm) => programDisplayName(pm.program)))],
      semester: serializeSemester(a.semester),
    })),
  };
}

async function createUserWithRole(data, role) {
  await assertUserIsNew(data.email, data.workId);
  const { password, ...rest } = data;
  try {
    const user = await prisma.user.create({ data: { ...rest, passwordHash: await hashPassword(password), role } });
    return serializeUser(user);
  } catch (err) {
    if (isUniqueViolation(err)) throw userConflictError(err);
    throw err;
  }
}

export function createLecturer(data) {
  return createUserWithRole(data, 'LECTURER');
}

export async function updateLecturer(id, data) {
  await findUserWithRole(id, 'LECTURER');
  const { password, ...rest } = data;
  if (rest.email || rest.workId) await assertUserIsNew(rest.email, rest.workId, id);
  const update = { ...rest };
  if (password) update.passwordHash = await hashPassword(password); // admin-initiated password reset
  try {
    await prisma.user.update({ where: { id }, data: update });
  } catch (err) {
    if (isUniqueViolation(err)) throw userConflictError(err);
    throw err;
  }
  return getLecturer(id);
}

export async function deleteLecturer(id) {
  await findUserWithRole(id, 'LECTURER');
  const sessions = await prisma.classSession.count({ where: { lecturerId: id } });
  if (sessions > 0) {
    throw AppError.conflict(
      'This lecturer has class sessions with attendance history, so the account cannot be deleted.',
      'IN_USE',
    );
  }
  await prisma.user.delete({ where: { id } }); // lecturer_modules cascade
}

export async function addAssignment(userId, { moduleId, semesterId }) {
  await findUserWithRole(userId, 'LECTURER');
  if (!(await prisma.module.findUnique({ where: { id: moduleId } })))
    throw AppError.badRequest('That module does not exist.');
  if (!(await prisma.semester.findUnique({ where: { id: semesterId } })))
    throw AppError.badRequest('That semester does not exist.');
  try {
    await prisma.lecturerModule.create({ data: { userId, moduleId, semesterId } });
  } catch (err) {
    if (isUniqueViolation(err))
      throw AppError.conflict('The lecturer is already assigned to this module for that semester.', 'DUPLICATE');
    throw err;
  }
  return getLecturer(userId);
}

export async function removeAssignment(userId, semesterId, moduleId) {
  await findUserWithRole(userId, 'LECTURER');
  const key = { userId_moduleId_semesterId: { userId, moduleId, semesterId } };
  if (!(await prisma.lecturerModule.findUnique({ where: key }))) throw AppError.notFound('Assignment not found.');
  const openSessions = await prisma.classSession.count({
    where: { lecturerId: userId, moduleId, semesterId, closedAt: null },
  });
  if (openSessions > 0) {
    throw AppError.conflict(
      'The lecturer has an open session for this module. It must be closed first.',
      'SESSION_OPEN',
    );
  }
  await prisma.lecturerModule.delete({ where: key });
  return getLecturer(userId);
}

// --------------------------------------------------------- administrators ---

export async function listAdmins() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, orderBy: { lastName: 'asc' } });
  return admins.map((u) => ({ ...serializeUser(u), createdAt: u.createdAt }));
}

/** Only an authenticated administrator can reach this (see adminRoutes). */
export function createAdmin(data) {
  return createUserWithRole(data, 'ADMIN');
}

// ---------------------------------------------------------------- overview ---

export async function getOverview() {
  const current = await getCurrentSemester();
  const [schools, programs, modules, students, lecturers, admins, openSessions, attendanceToday] = await Promise.all([
    prisma.school.count(),
    prisma.program.count(),
    prisma.module.count(),
    prisma.student.count(),
    prisma.user.count({ where: { role: 'LECTURER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.classSession.count({ where: { closedAt: null } }),
    prisma.attendance.count({ where: { checkedInAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  return {
    currentSemester: serializeSemester(current),
    counts: {
      schools,
      programs,
      modules,
      students,
      lecturers,
      admins,
      openSessions,
      attendanceLast24h: attendanceToday,
    },
  };
}
