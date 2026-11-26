// Academic catalog queries and rules shared by registration and admin code.
import { prisma } from '../db/client.js';
import { AppError } from '../utils/AppError.js';
import { requireCurrentSemester, serializeSemester, slotsForTerm } from './semesterService.js';

// The database stores semester slots as '1', '2', 'YEAR', 'EITHER'; Prisma
// names the first two SEM1/SEM2 because enum names must be identifiers.
const SLOT_TO_API = { SEM1: '1', SEM2: '2', YEAR: 'YEAR', EITHER: 'EITHER' };
const SLOT_FROM_API = { 1: 'SEM1', 2: 'SEM2', YEAR: 'YEAR', EITHER: 'EITHER' };
export const API_SEMESTER_SLOTS = ['1', '2', 'YEAR', 'EITHER'];

export const slotToApi = (slot) => SLOT_TO_API[slot];
export const slotFromApi = (slot) => SLOT_FROM_API[slot];

export function programDisplayName(program) {
  return program.major ? `${program.name} – ${program.major}` : program.name;
}

export function serializeProgram(program) {
  return {
    id: program.id,
    name: program.name,
    major: program.major,
    displayName: programDisplayName(program),
    school: program.school ? { id: program.school.id, code: program.school.code, name: program.school.name } : undefined,
  };
}

export function serializeModule(module) {
  return { id: module.id, code: module.code, name: module.name, credits: module.credits };
}

function serializeProgramModule(pm) {
  return {
    ...serializeModule(pm.module),
    level: pm.level,
    semesterSlot: slotToApi(pm.semesterSlot),
    choiceGroup: pm.choiceGroup,
  };
}

export async function listPrograms() {
  const programs = await prisma.program.findMany({
    include: { school: true },
    orderBy: [{ name: 'asc' }, { major: 'asc' }],
  });
  return programs.map(serializeProgram);
}

/**
 * Modules a programme offers. With semester='current' only modules whose
 * slot is available in the current semester are returned (year-long and
 * either-semester modules appear in both semesters).
 */
export async function getProgramModules(programId, semester = 'current') {
  const program = await prisma.program.findUnique({ where: { id: programId }, include: { school: true } });
  if (!program) throw AppError.notFound('That programme does not exist.', 'PROGRAM_NOT_FOUND');

  let currentSemester = null;
  const where = { programId };
  if (semester === 'current') {
    currentSemester = await requireCurrentSemester();
    where.semesterSlot = { in: slotsForTerm(currentSemester.term) };
  }

  const rows = await prisma.programModule.findMany({
    where,
    include: { module: true },
    orderBy: [{ level: 'asc' }, { module: { code: 'asc' } }],
  });

  return {
    program: serializeProgram(program),
    semester: serializeSemester(currentSemester),
    modules: rows.map(serializeProgramModule),
  };
}

/**
 * Either/or rule: within one programme, modules that share a choice group
 * are alternatives, so at most one of them may be taken in a semester.
 * Throws 400 if `moduleIds` contains two modules from the same group.
 */
export async function assertEitherOrRespected(programId, moduleIds, db = prisma) {
  if (moduleIds.length < 2) return;
  const grouped = await db.programModule.findMany({
    where: { programId, moduleId: { in: moduleIds }, choiceGroup: { not: null } },
    include: { module: { select: { code: true } } },
  });

  const byGroup = new Map();
  for (const row of grouped) {
    const codes = byGroup.get(row.choiceGroup) ?? [];
    codes.push(row.module.code);
    byGroup.set(row.choiceGroup, codes);
  }

  for (const codes of byGroup.values()) {
    if (codes.length > 1) {
      throw AppError.badRequest(
        `${codes.sort().join(' and ')} are either/or options - choose only one of them.`,
        'EITHER_OR_CONFLICT',
      );
    }
  }
}

/**
 * Check that every module in `moduleIds` is offered by at least one of the
 * programmes in `programIds` during the semester `term`.
 */
export async function assertModulesOffered(programIds, moduleIds, term) {
  const offered = await prisma.programModule.findMany({
    where: { programId: { in: programIds }, moduleId: { in: moduleIds }, semesterSlot: { in: slotsForTerm(term) } },
    select: { moduleId: true },
  });
  const offeredIds = new Set(offered.map((row) => row.moduleId));
  const missing = moduleIds.filter((id) => !offeredIds.has(id));
  if (missing.length > 0) {
    throw AppError.badRequest(
      'One or more selected modules are not offered by the selected programme(s) this semester.',
      'MODULE_NOT_OFFERED',
    );
  }
}
