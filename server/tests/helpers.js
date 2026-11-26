// Shared helpers for API tests: wipe the test database, build a small known
// set of fixtures, and sign in as a lecturer or administrator.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';
import { hashPassword } from '../src/services/authService.js';
import { todayString } from '../src/services/semesterService.js';
import { fromDateOnly } from '../src/utils/dates.js';

export const PASSWORD = 'Password123';

const TABLES = [
  'attendance',
  'class_sessions',
  'enrollments',
  'lecturer_modules',
  'students',
  'users',
  'program_modules',
  'programs',
  'modules',
  'schools',
  'semesters',
  'session',
];

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

function shiftDays(dateString, days) {
  const d = fromDateOnly(dateString);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fixtures (all relative to today, so tests never depend on the calendar):
 *  - semesters: current = term 1 (today-30 .. today+30); next = term 2
 *  - programmes: CS and IT (CMP2018 is shared by both)
 *  - modules: CIT2004 (sem 1), CMP2018 (sem 1, shared), PRJ4020 (YEAR),
 *    CMP1025 (sem 2 only), ENS3001 / MEE2003 (either/or pair), CSP1001 (EITHER)
 *  - users: admin, lecturer1 (CIT2004, PRJ4020), lecturer2 (CMP2018)
 *  - students: s1 (CIT2004, CMP2018, PRJ4020), s2 (CMP2018 only)
 */
export async function createFixtures() {
  const today = todayString();
  const current = await prisma.semester.create({
    data: {
      academicYear: '2090/2091',
      term: 1,
      startDate: fromDateOnly(shiftDays(today, -30)),
      endDate: fromDateOnly(shiftDays(today, 30)),
    },
  });
  const next = await prisma.semester.create({
    data: {
      academicYear: '2090/2091',
      term: 2,
      startDate: fromDateOnly(shiftDays(today, 31)),
      endDate: fromDateOnly(shiftDays(today, 150)),
    },
  });

  const school = await prisma.school.create({ data: { code: 'SCIT', name: 'School of Computing & Information Technology' } });
  const cs = await prisma.program.create({ data: { schoolId: school.id, name: 'BSc Computing', major: 'Computer Science' } });
  const it = await prisma.program.create({ data: { schoolId: school.id, name: 'BSc Computing', major: 'Information Technology' } });

  const mod = async (code, name, credits) => prisma.module.create({ data: { code, name, credits } });
  const modules = {
    CIT2004: await mod('CIT2004', 'Object Oriented Programming', 4),
    CMP2018: await mod('CMP2018', 'Database Design', 3),
    PRJ4020: await mod('PRJ4020', 'Major Project', 3),
    CMP1025: await mod('CMP1025', 'Programming 2', 4),
    ENS3001: await mod('ENS3001', 'Environmental Studies', 3),
    MEE2003: await mod('MEE2003', 'Material Science', 3),
    CSP1001: await mod('CSP1001', 'Community Service Project', 1),
  };

  const link = (program, m, level, semesterSlot, choiceGroup = null) =>
    prisma.programModule.create({ data: { programId: program.id, moduleId: m.id, level, semesterSlot, choiceGroup } });
  await link(cs, modules.CIT2004, 2, 'SEM1');
  await link(cs, modules.CMP2018, 2, 'SEM1');
  await link(it, modules.CMP2018, 2, 'SEM1');
  await link(cs, modules.PRJ4020, 4, 'YEAR');
  await link(cs, modules.CMP1025, 1, 'SEM2');
  await link(cs, modules.ENS3001, 1, 'SEM1', 'ENS3001/MEE2003');
  await link(cs, modules.MEE2003, 1, 'SEM1', 'ENS3001/MEE2003');
  await link(cs, modules.CSP1001, 1, 'EITHER');

  const passwordHash = await hashPassword(PASSWORD);
  const user = (workId, email, firstName, lastName, role) =>
    prisma.user.create({ data: { workId, email, firstName, lastName, role, passwordHash } });
  const admin = await user('ADM001', 'admin@test.example', 'Ada', 'Admin', 'ADMIN');
  const lecturer1 = await user('LEC001', 'lecturer1@test.example', 'Lee', 'One', 'LECTURER');
  const lecturer2 = await user('LEC002', 'lecturer2@test.example', 'Lou', 'Two', 'LECTURER');

  await prisma.lecturerModule.createMany({
    data: [
      { userId: lecturer1.id, moduleId: modules.CIT2004.id, semesterId: current.id },
      { userId: lecturer1.id, moduleId: modules.PRJ4020.id, semesterId: current.id },
      { userId: lecturer2.id, moduleId: modules.CMP2018.id, semesterId: current.id },
    ],
  });

  const s1 = await prisma.student.create({
    data: { idNumber: '1900001', firstName: 'Stu', lastName: 'Dent', email: 's1@students.test.example', programId: cs.id },
  });
  const s2 = await prisma.student.create({
    data: { idNumber: '1900002', firstName: 'Sue', lastName: 'Second', email: 's2@students.test.example', programId: cs.id },
  });
  await prisma.enrollment.createMany({
    data: [
      { studentId: s1.id, moduleId: modules.CIT2004.id, semesterId: current.id },
      { studentId: s1.id, moduleId: modules.CMP2018.id, semesterId: current.id },
      { studentId: s1.id, moduleId: modules.PRJ4020.id, semesterId: current.id },
      { studentId: s2.id, moduleId: modules.CMP2018.id, semesterId: current.id },
    ],
  });

  return { semesters: { current, next }, school, programs: { cs, it }, modules, users: { admin, lecturer1, lecturer2 }, students: { s1, s2 } };
}

/** A fresh Express app per test file (fresh in-memory rate-limit counters). */
export function makeApp(options) {
  return createApp(options);
}

/**
 * Sign in through the given login system. Returns a Supertest agent that
 * keeps the session cookie, plus the CSRF token for state-changing calls.
 */
export async function login(app, portal, identifier, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post(`/api/auth/${portal}/login`).send({ identifier, password });
  if (res.status !== 200) throw new Error(`Login as ${identifier} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: res.body.data.csrfToken, user: res.body.data.user };
}

/** Open a class session directly in the database (test shortcut). */
export function openSessionInDb(lecturer, module, semester) {
  return prisma.classSession.create({ data: { lecturerId: lecturer.id, moduleId: module.id, semesterId: semester.id } });
}
