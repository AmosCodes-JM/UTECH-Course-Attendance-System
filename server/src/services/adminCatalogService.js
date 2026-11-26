// Administrator management of the academic catalog: schools, programmes,
// modules, programme-module assignments and semesters.
//
// Deletes are refused (409) while other records still depend on the row, so
// an admin cannot accidentally wipe out students' history.
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import { fromDateOnly, toDateOnly } from '../utils/dates.js';
import { programDisplayName, serializeModule, serializeProgram, slotFromApi, slotToApi } from './catalogService.js';
import { serializeSemester, todayString } from './semesterService.js';

async function rethrowDuplicate(promise, message, code = 'DUPLICATE') {
  try {
    return await promise;
  } catch (err) {
    if (isUniqueViolation(err)) throw AppError.conflict(message, code);
    throw err;
  }
}

async function findOr404(model, id, label) {
  const row = await prisma[model].findUnique({ where: { id } });
  if (!row) throw AppError.notFound(`${label} not found.`);
  return row;
}

// ---------------------------------------------------------------- schools ---

export async function listSchools() {
  const schools = await prisma.school.findMany({
    include: { _count: { select: { programs: true } } },
    orderBy: { code: 'asc' },
  });
  return schools.map((s) => ({ id: s.id, code: s.code, name: s.name, programCount: s._count.programs }));
}

export function createSchool(data) {
  return rethrowDuplicate(prisma.school.create({ data }), 'A school with this code already exists.');
}

export async function updateSchool(id, data) {
  await findOr404('school', id, 'School');
  return rethrowDuplicate(prisma.school.update({ where: { id }, data }), 'A school with this code already exists.');
}

export async function deleteSchool(id) {
  await findOr404('school', id, 'School');
  const programs = await prisma.program.count({ where: { schoolId: id } });
  if (programs > 0) {
    throw AppError.conflict(`This school still has ${programs} programme(s). Move or delete them first.`, 'IN_USE');
  }
  await prisma.school.delete({ where: { id } });
}

// ------------------------------------------------------------- programmes ---

export async function listAdminPrograms() {
  const programs = await prisma.program.findMany({
    include: { school: true, _count: { select: { programModules: true, students: true } } },
    orderBy: [{ name: 'asc' }, { major: 'asc' }],
  });
  return programs.map((p) => ({
    ...serializeProgram(p),
    schoolId: p.schoolId,
    moduleCount: p._count.programModules,
    studentCount: p._count.students,
  }));
}

export async function createProgram(data) {
  await findOr404('school', data.schoolId, 'School');
  const program = await prisma.program.create({ data, include: { school: true } });
  return serializeProgram(program);
}

export async function updateProgram(id, data) {
  await findOr404('program', id, 'Programme');
  if (data.schoolId) await findOr404('school', data.schoolId, 'School');
  const program = await prisma.program.update({ where: { id }, data, include: { school: true } });
  return serializeProgram(program);
}

export async function deleteProgram(id) {
  await findOr404('program', id, 'Programme');
  const students = await prisma.student.count({ where: { programId: id } });
  if (students > 0) {
    throw AppError.conflict(`${students} student(s) are registered in this programme, so it cannot be deleted.`, 'IN_USE');
  }
  // Its program_modules rows are removed by ON DELETE CASCADE; modules stay.
  await prisma.program.delete({ where: { id } });
}

// ---------------------------------------------------------------- modules ---

export async function listModules(search) {
  const where = search
    ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] }
    : {};
  const modules = await prisma.module.findMany({
    where,
    include: { programModules: { include: { program: true } } },
    orderBy: { code: 'asc' },
  });
  return modules.map((m) => ({
    ...serializeModule(m),
    programs: m.programModules.map((pm) => ({
      programId: pm.programId,
      displayName: programDisplayName(pm.program),
      level: pm.level,
      semesterSlot: slotToApi(pm.semesterSlot),
      choiceGroup: pm.choiceGroup,
    })),
  }));
}

export function createModule(data) {
  return rethrowDuplicate(prisma.module.create({ data }), 'A module with this code already exists.');
}

export async function updateModule(id, data) {
  await findOr404('module', id, 'Module');
  return rethrowDuplicate(prisma.module.update({ where: { id }, data }), 'A module with this code already exists.');
}

export async function deleteModule(id) {
  await findOr404('module', id, 'Module');
  const [enrollments, assignments, sessions] = await Promise.all([
    prisma.enrollment.count({ where: { moduleId: id } }),
    prisma.lecturerModule.count({ where: { moduleId: id } }),
    prisma.classSession.count({ where: { moduleId: id } }),
  ]);
  if (enrollments + assignments + sessions > 0) {
    throw AppError.conflict(
      'This module has enrollments, lecturer assignments or class sessions, so it cannot be deleted.',
      'IN_USE',
    );
  }
  await prisma.module.delete({ where: { id } });
}

// ------------------------------------------------- programme <-> modules ---

function serializeAssignment(pm) {
  return {
    programId: pm.programId,
    moduleId: pm.moduleId,
    module: serializeModule(pm.module),
    level: pm.level,
    semesterSlot: slotToApi(pm.semesterSlot),
    choiceGroup: pm.choiceGroup,
  };
}

export async function listProgramModules(programId) {
  await findOr404('program', programId, 'Programme');
  const rows = await prisma.programModule.findMany({
    where: { programId },
    include: { module: true },
    orderBy: [{ level: 'asc' }, { semesterSlot: 'asc' }, { module: { code: 'asc' } }],
  });
  return rows.map(serializeAssignment);
}

export async function addProgramModule(programId, { moduleId, level, semesterSlot, choiceGroup }) {
  await findOr404('program', programId, 'Programme');
  await findOr404('module', moduleId, 'Module');
  const row = await rethrowDuplicate(
    prisma.programModule.create({
      data: { programId, moduleId, level, semesterSlot: slotFromApi(semesterSlot), choiceGroup: choiceGroup || null },
      include: { module: true },
    }),
    'This module is already part of the programme.',
  );
  return serializeAssignment(row);
}

export async function updateProgramModule(programId, moduleId, { level, semesterSlot, choiceGroup }) {
  const key = { programId_moduleId: { programId, moduleId } };
  const existing = await prisma.programModule.findUnique({ where: key });
  if (!existing) throw AppError.notFound('This module is not part of the programme.');
  const data = {};
  if (level !== undefined) data.level = level;
  if (semesterSlot !== undefined) data.semesterSlot = slotFromApi(semesterSlot);
  if (choiceGroup !== undefined) data.choiceGroup = choiceGroup || null;
  const row = await prisma.programModule.update({ where: key, data, include: { module: true } });
  return serializeAssignment(row);
}

export async function removeProgramModule(programId, moduleId) {
  const key = { programId_moduleId: { programId, moduleId } };
  const existing = await prisma.programModule.findUnique({ where: key });
  if (!existing) throw AppError.notFound('This module is not part of the programme.');
  await prisma.programModule.delete({ where: key });
}

// -------------------------------------------------------------- semesters ---

export async function listSemesters() {
  const today = todayString();
  const semesters = await prisma.semester.findMany({
    include: { _count: { select: { enrollments: true, lecturerModules: true, classSessions: true } } },
    orderBy: { startDate: 'desc' },
  });
  return semesters.map((s) => ({
    ...serializeSemester(s),
    isCurrent: toDateOnly(s.startDate) <= today && today <= toDateOnly(s.endDate),
    usage: s._count,
  }));
}

/** Semester date ranges must not overlap, or "the current semester" would be ambiguous. */
async function assertNoOverlap(startDate, endDate, excludeId = undefined) {
  const clash = await prisma.semester.findFirst({
    where: {
      startDate: { lte: fromDateOnly(endDate) },
      endDate: { gte: fromDateOnly(startDate) },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (clash) {
    throw AppError.conflict(
      `These dates overlap ${clash.academicYear} Semester ${clash.term}. Semester date ranges must not overlap.`,
      'SEMESTER_OVERLAP',
    );
  }
}

function assertDateOrder(startDate, endDate) {
  if (endDate <= startDate) throw AppError.badRequest('The end date must be after the start date.', 'INVALID_DATES');
}

export async function createSemester({ academicYear, term, startDate, endDate }) {
  assertDateOrder(startDate, endDate);
  await assertNoOverlap(startDate, endDate);
  const semester = await rethrowDuplicate(
    prisma.semester.create({
      data: { academicYear, term, startDate: fromDateOnly(startDate), endDate: fromDateOnly(endDate) },
    }),
    `${academicYear} Semester ${term} already exists.`,
  );
  return serializeSemester(semester);
}

export async function updateSemester(id, changes) {
  const current = await findOr404('semester', id, 'Semester');
  const next = {
    academicYear: changes.academicYear ?? current.academicYear,
    term: changes.term ?? current.term,
    startDate: changes.startDate ?? toDateOnly(current.startDate),
    endDate: changes.endDate ?? toDateOnly(current.endDate),
  };
  assertDateOrder(next.startDate, next.endDate);
  await assertNoOverlap(next.startDate, next.endDate, id);
  const semester = await rethrowDuplicate(
    prisma.semester.update({
      where: { id },
      data: { ...next, startDate: fromDateOnly(next.startDate), endDate: fromDateOnly(next.endDate) },
    }),
    `${next.academicYear} Semester ${next.term} already exists.`,
  );
  return serializeSemester(semester);
}

export async function deleteSemester(id) {
  await findOr404('semester', id, 'Semester');
  const [enrollments, assignments, sessions] = await Promise.all([
    prisma.enrollment.count({ where: { semesterId: id } }),
    prisma.lecturerModule.count({ where: { semesterId: id } }),
    prisma.classSession.count({ where: { semesterId: id } }),
  ]);
  if (enrollments + assignments + sessions > 0) {
    throw AppError.conflict('This semester already has enrollments, assignments or sessions, so it cannot be deleted.', 'IN_USE');
  }
  await prisma.semester.delete({ where: { id } });
}
