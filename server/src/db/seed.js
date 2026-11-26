// Development seed data. Run with: npm run db:seed
//
// 1. Imports the real SCIT catalog transcribed from the diet sheets.
// 2. Creates semesters for the previous, current and next academic year using
//    the standard calendar (Semester 1: Sep-Dec, Semester 2: Jan-May). These
//    dates are development defaults - administrators should set the official
//    dates in the admin area.
// 3. Creates DEVELOPMENT-ONLY accounts (one admin, two lecturers, four
//    students) with sample enrollments, course assignments and one closed
//    class session with attendance, so every screen has something to show.
//
// Safe to run more than once: existing rows are kept, missing ones are added.
// NEVER use these sample accounts or passwords in production.
import { config } from '../config/env.js';
import { hashPassword } from '../services/authService.js';
import { dateInTimezone, fromDateOnly } from '../utils/dates.js';
import { importCatalog } from './catalog/importCatalog.js';
import { disconnectDatabase, prisma } from './client.js';

const DEV_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const DEV_LECTURER_PASSWORD = process.env.SEED_LECTURER_PASSWORD || 'Lecturer@12345';

if (config.isProduction && !process.env.SEED_ADMIN_PASSWORD) {
  console.error('Refusing to seed default development credentials in production.');
  console.error('Use "npm run create-admin" to provision a real administrator instead.');
  process.exit(1);
}

/** Academic years around today, e.g. on 2026-11-25 -> 2025/2026, 2026/2027, 2027/2028. */
function semesterDefinitions(today) {
  const [year, month] = today.split('-').map(Number);
  const base = month >= 6 ? year : year - 1; // first calendar year of the current academic year
  const defs = [];
  for (const start of [base - 1, base, base + 1]) {
    const academicYear = `${start}/${start + 1}`;
    defs.push({ academicYear, term: 1, startDate: `${start}-09-01`, endDate: `${start}-12-31` });
    defs.push({ academicYear, term: 2, startDate: `${start + 1}-01-01`, endDate: `${start + 1}-05-31` });
  }
  return defs;
}

async function seedSemesters(today) {
  for (const s of semesterDefinitions(today)) {
    await prisma.semester.upsert({
      where: { academicYear_term: { academicYear: s.academicYear, term: s.term } },
      update: {},
      create: { ...s, startDate: fromDateOnly(s.startDate), endDate: fromDateOnly(s.endDate) },
    });
  }
  const todayDate = fromDateOnly(today);
  // Sample data goes into the current semester, or the next one between semesters.
  return (
    (await prisma.semester.findFirst({ where: { startDate: { lte: todayDate }, endDate: { gte: todayDate } } })) ??
    (await prisma.semester.findFirst({ where: { startDate: { gt: todayDate } }, orderBy: { startDate: 'asc' } }))
  );
}

async function upsertUser({ email, workId, firstName, lastName, role, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, workId, firstName, lastName, role, passwordHash: await hashPassword(password) },
  });
}

async function moduleIdsByCode(codes) {
  const modules = await prisma.module.findMany({ where: { code: { in: codes } } });
  return codes.map((code) => {
    const m = modules.find((x) => x.code === code);
    if (!m) throw new Error(`Seed expects module ${code} in the catalog`);
    return m.id;
  });
}

async function main() {
  const today = dateInTimezone(new Date(), config.timezone);

  await importCatalog(prisma);
  const semester = await seedSemesters(today);
  console.log(`Semesters ready. Sample data uses ${semester.academicYear} Semester ${semester.term}.`);

  const program = await prisma.program.findFirst({ where: { name: 'BSc Computing', major: 'Computer Science' } });

  // Modules offered by BSc Computing (Computer Science) in each term.
  const plan =
    semester.term === 1
      ? { lecturer1: ['CMP1024', 'CIT2004', 'PRJ4020'], lecturer2: ['CMP2018', 'CIT2011', 'CSP1001'] }
      : { lecturer1: ['CMP1025', 'CMP2006', 'PRJ4020'], lecturer2: ['CMP2019', 'ENS3001', 'MEE2003'] };

  // ---- accounts (development only) ----
  await upsertUser({
    email: 'admin@example.com', workId: 'ADMIN001', firstName: 'Dev', lastName: 'Administrator',
    role: 'ADMIN', password: DEV_ADMIN_PASSWORD,
  });
  const lecturer1 = await upsertUser({
    email: 'lecturer1@example.com', workId: 'LEC001', firstName: 'Morgan', lastName: 'Ellis',
    role: 'LECTURER', password: DEV_LECTURER_PASSWORD,
  });
  const lecturer2 = await upsertUser({
    email: 'lecturer2@example.com', workId: 'LEC002', firstName: 'Taylor', lastName: 'Brooks',
    role: 'LECTURER', password: DEV_LECTURER_PASSWORD,
  });

  const l1Modules = await moduleIdsByCode(plan.lecturer1);
  const l2Modules = await moduleIdsByCode(plan.lecturer2);
  await prisma.lecturerModule.createMany({
    data: [
      ...l1Modules.map((moduleId) => ({ userId: lecturer1.id, moduleId, semesterId: semester.id })),
      ...l2Modules.map((moduleId) => ({ userId: lecturer2.id, moduleId, semesterId: semester.id })),
    ],
    skipDuplicates: true,
  });

  // ---- students (sample people, not real records) ----
  const students = [
    { idNumber: '2600001', firstName: 'Alex', lastName: 'Sample', email: 'alex.sample@students.example.com' },
    { idNumber: '2600002', firstName: 'Jamie', lastName: 'Tester', email: 'jamie.tester@students.example.com' },
    { idNumber: '2600003', firstName: 'Riley', lastName: 'Demo', email: 'riley.demo@students.example.com' },
    { idNumber: '2600004', firstName: 'Sam', lastName: 'Example', email: 'sam.example@students.example.com' },
  ];
  const studentRows = [];
  for (const s of students) {
    studentRows.push(
      await prisma.student.upsert({ where: { idNumber: s.idNumber }, update: {}, create: { ...s, programId: program.id } }),
    );
  }
  // The first three take every sample course; Sam takes only lecturer 2's.
  // (In term 2 the plan includes the ENS3001/MEE2003 either/or pair, so only one is used.)
  const allCourses = [...l1Modules, ...l2Modules.slice(0, 2)];
  await prisma.enrollment.createMany({
    data: [
      ...studentRows.slice(0, 3).flatMap((st) => allCourses.map((moduleId) => ({ studentId: st.id, moduleId, semesterId: semester.id }))),
      ...l2Modules.slice(0, 2).map((moduleId) => ({ studentId: studentRows[3].id, moduleId, semesterId: semester.id })),
    ],
    skipDuplicates: true,
  });

  // ---- one past, closed session with attendance (for the attendance page) ----
  const hasSessions = await prisma.classSession.count({ where: { lecturerId: lecturer1.id } });
  if (!hasSessions) {
    const openedAt = new Date(Date.now() - 26 * 60 * 60 * 1000); // yesterday
    const session = await prisma.classSession.create({
      data: {
        moduleId: l1Modules[1],
        lecturerId: lecturer1.id,
        semesterId: semester.id,
        openedAt,
        closedAt: new Date(openedAt.getTime() + 60 * 60 * 1000),
      },
    });
    await prisma.attendance.createMany({
      data: studentRows.slice(0, 2).map((st, i) => ({
        sessionId: session.id,
        studentId: st.id,
        checkedInAt: new Date(openedAt.getTime() + (5 + i * 3) * 60 * 1000),
      })),
    });
  }

  console.log('Development accounts (DO NOT use in production):');
  console.log(`  Admin     admin@example.com / ADMIN001      password: ${DEV_ADMIN_PASSWORD}`);
  console.log(`  Lecturer  lecturer1@example.com / LEC001    password: ${DEV_LECTURER_PASSWORD}`);
  console.log(`  Lecturer  lecturer2@example.com / LEC002    password: ${DEV_LECTURER_PASSWORD}`);
  console.log('  Students  2600001, 2600002, 2600003, 2600004 (check in with these ID numbers)');
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
