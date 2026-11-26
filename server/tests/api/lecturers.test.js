// Lecturer registration, login, course list, sessions, attendance and exports.
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../src/db/client.js';
import { createFixtures, login, makeApp, openSessionInDb, resetDatabase } from '../helpers.js';

let app;
let fx;

beforeAll(() => {
  app = makeApp();
});
beforeEach(async () => {
  await resetDatabase();
  fx = await createFixtures();
});
afterAll(disconnectDatabase);

// Collect a binary response body into a Buffer.
const binary = (res, callback) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const registration = (overrides = {}) => ({
  firstName: 'Lena',
  lastName: 'Lecturer',
  email: 'lena@staff.test.example',
  workId: 'lec900',
  password: 'Teaching123',
  programIds: [fx.programs.cs.id],
  moduleIds: [fx.modules.CIT2004.id, fx.modules.PRJ4020.id],
  ...overrides,
});

describe('POST /api/lecturers (registration)', () => {
  it('creates a LECTURER account with a bcrypt hash and current-semester course assignments', async () => {
    const res = await request(app).post('/api/lecturers').send(registration());
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ workId: 'LEC900', role: 'LECTURER' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const user = await prisma.user.findUnique({ where: { workId: 'LEC900' }, include: { lecturerModules: true } });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain('Teaching123');
    expect(user.lecturerModules).toHaveLength(2);
    expect(user.lecturerModules.every((a) => a.semesterId === fx.semesters.current.id)).toBe(true);
  });

  it('accepts courses from several programmes, including shared modules', async () => {
    const res = await request(app)
      .post('/api/lecturers')
      .send(registration({ programIds: [fx.programs.cs.id, fx.programs.it.id], moduleIds: [fx.modules.CMP2018.id] }));
    expect(res.status).toBe(201);
  });

  it('rejects a duplicate work ID and a duplicate email', async () => {
    const dupWork = await request(app)
      .post('/api/lecturers')
      .send(registration({ workId: 'LEC001' }));
    expect(dupWork.status).toBe(409);
    expect(dupWork.body.code).toBe('DUPLICATE_WORK_ID');
    const dupEmail = await request(app)
      .post('/api/lecturers')
      .send(registration({ email: 'LECTURER1@test.example' }));
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.code).toBe('DUPLICATE_EMAIL');
  });

  it('rejects courses not offered by the selected programmes this semester', async () => {
    const res = await request(app)
      .post('/api/lecturers')
      .send(registration({ moduleIds: [fx.modules.CMP1025.id] }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MODULE_NOT_OFFERED');
  });

  it('cannot be used to create an administrator', async () => {
    const res = await request(app)
      .post('/api/lecturers')
      .send({ ...registration(), role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('enforces the password policy', async () => {
    const res = await request(app)
      .post('/api/lecturers')
      .send(registration({ password: 'short' }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('password');
  });
});

describe('POST /api/auth/lecturer/login', () => {
  it('signs in with email or work ID and sets an HTTP-only session cookie', async () => {
    const byEmail = await request(app)
      .post('/api/auth/lecturer/login')
      .send({ identifier: 'Lecturer1@Test.Example', password: 'Password123' });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data).toMatchObject({ user: { workId: 'LEC001', role: 'LECTURER' }, redirectTo: '/lecturer' });
    expect(byEmail.body.data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const cookie = byEmail.headers['set-cookie'].find((c) => c.startsWith('sams.sid='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const byWorkId = await request(app)
      .post('/api/auth/lecturer/login')
      .send({ identifier: 'lec001', password: 'Password123' });
    expect(byWorkId.status).toBe(200);
  });

  it('rejects a wrong password or unknown account with the same generic message', async () => {
    const wrong = await request(app)
      .post('/api/auth/lecturer/login')
      .send({ identifier: 'LEC001', password: 'Nope12345' });
    const unknown = await request(app)
      .post('/api/auth/lecturer/login')
      .send({ identifier: 'ghost@test.example', password: 'Nope12345' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('refuses administrators, even with the correct password, and creates no session', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/lecturer/login').send({ identifier: 'ADM001', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WRONG_LOGIN_PORTAL');
    expect((await agent.get('/api/auth/lecturer/me')).status).toBe(401);
    expect((await agent.get('/api/admin/overview')).status).toBe(401);
  });

  it('GET /api/auth/lecturer/me returns the lecturer without the password hash', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    const res = await agent.get('/api/auth/lecturer/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual(expect.objectContaining({ workId: 'LEC001' }));
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

describe('lecturer courses and sessions', () => {
  it('lists only the lecturer’s own current-semester courses', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    const res = await agent.get('/api/lecturer/courses');
    expect(res.status).toBe(200);
    expect(res.body.data.courses.map((c) => c.code)).toEqual(['CIT2004', 'PRJ4020']);
    expect(res.body.data.courses[0]).toMatchObject({
      openSession: null,
      programs: ['BSc Computing – Computer Science'],
    });
  });

  it('opens a session (server timestamp) and refuses a second open session for the same course', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC001');
    const open = await agent
      .post('/api/class-sessions')
      .set('X-CSRF-Token', csrf)
      .send({ moduleId: fx.modules.CIT2004.id });
    expect(open.status).toBe(201);
    expect(open.body.data).toMatchObject({ isOpen: true, closedAt: null, module: { code: 'CIT2004' } });
    expect(Math.abs(new Date(open.body.data.openedAt).getTime() - Date.now())).toBeLessThan(5000);

    const again = await agent
      .post('/api/class-sessions')
      .set('X-CSRF-Token', csrf)
      .send({ moduleId: fx.modules.CIT2004.id });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('SESSION_ALREADY_OPEN');

    const courses = await agent.get('/api/lecturer/courses');
    expect(courses.body.data.courses[0].openSession).toMatchObject({ id: open.body.data.id, attendanceCount: 0 });
  });

  it('closes a session manually; closing twice is refused', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC001');
    const session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    const close = await agent.patch(`/api/class-sessions/${session.id}/close`).set('X-CSRF-Token', csrf);
    expect(close.status).toBe(200);
    expect(close.body.data.isOpen).toBe(false);
    expect((await prisma.classSession.findUnique({ where: { id: session.id } })).closedAt).not.toBeNull();

    const again = await agent.patch(`/api/class-sessions/${session.id}/close`).set('X-CSRF-Token', csrf);
    expect(again.status).toBe(409);
  });

  it('sessions stay open until closed (no automatic closing)', async () => {
    const session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    await prisma.classSession.update({
      where: { id: session.id },
      data: { openedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
    });
    const res = await request(app).get(`/api/students/${fx.students.s1.idNumber}/open-courses`);
    expect(res.body.data.courses.map((c) => c.sessionId)).toContain(session.id);
  });

  it('cannot open a session for another lecturer’s course', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC002');
    const res = await agent
      .post('/api/class-sessions')
      .set('X-CSRF-Token', csrf)
      .send({ moduleId: fx.modules.CIT2004.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_YOUR_COURSE');
  });

  it('cannot close another lecturer’s session', async () => {
    const session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    const { agent, csrf } = await login(app, 'lecturer', 'LEC002');
    const res = await agent.patch(`/api/class-sessions/${session.id}/close`).set('X-CSRF-Token', csrf);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_YOUR_SESSION');
    expect((await prisma.classSession.findUnique({ where: { id: session.id } })).closedAt).toBeNull();
  });

  it('cannot close a session for a module that is no longer assigned to them', async () => {
    const session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    await prisma.lecturerModule.deleteMany({
      where: { userId: fx.users.lecturer1.id, moduleId: fx.modules.CIT2004.id },
    });
    const { agent, csrf } = await login(app, 'lecturer', 'LEC001');
    expect((await agent.patch(`/api/class-sessions/${session.id}/close`).set('X-CSRF-Token', csrf)).status).toBe(403);
  });

  it('returns 404 for a session that does not exist', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC001');
    expect((await agent.patch('/api/class-sessions/99999/close').set('X-CSRF-Token', csrf)).status).toBe(404);
  });
});

describe('attendance viewing and exports', () => {
  let session;

  beforeEach(async () => {
    session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    await request(app).post('/api/attendance').send({ idNumber: fx.students.s1.idNumber, sessionId: session.id });
  });

  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(new Date());

  it('shows attendance for the lecturer’s own course, filtered by date', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    const res = await agent.get(`/api/attendance?moduleId=${fx.modules.CIT2004.id}&date=${today()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, module: { code: 'CIT2004' }, date: today() });
    expect(res.body.data.records[0]).toMatchObject({ studentIdNumber: '1900001', firstName: 'Stu', lastName: 'Dent' });

    const otherDay = await agent.get(`/api/attendance?moduleId=${fx.modules.CIT2004.id}&date=2001-01-01`);
    expect(otherDay.body.data.total).toBe(0);

    const allDates = await agent.get(`/api/attendance?moduleId=${fx.modules.CIT2004.id}`);
    expect(allDates.body.data.total).toBe(1);
  });

  it('refuses to show another lecturer’s attendance', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC002');
    const res = await agent.get(`/api/attendance?moduleId=${fx.modules.CIT2004.id}`);
    expect(res.status).toBe(403);
  });

  it('validates the filters', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    expect((await agent.get('/api/attendance')).status).toBe(400);
    expect((await agent.get(`/api/attendance?moduleId=${fx.modules.CIT2004.id}&date=2026-13-45`)).status).toBe(400);
  });

  it('exports the filtered view as an Excel workbook', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    const res = await agent
      .get(`/api/attendance/export?format=xlsx&moduleId=${fx.modules.CIT2004.id}&date=${today()}`)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="attendance-CIT2004-${today()}.xlsx"`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet('Attendance');
    const cells = [];
    sheet.eachRow((row) => cells.push(row.values.filter(Boolean).join('|')));
    const text = cells.join('\n');
    expect(text).toContain('CIT2004');
    expect(text).toContain('Object Oriented Programming');
    expect(text).toContain(today());
    expect(text).toContain('1900001|Stu|Dent');
    expect(text).toContain('Total attendance|1');
  });

  it('exports the filtered view as a PDF', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    const res = await agent
      .get(`/api/attendance/export?format=pdf&moduleId=${fx.modules.CIT2004.id}&date=2001-01-01`)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attendance-CIT2004-2001-01-01.pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('refuses exports for other lecturers, unauthenticated users and bad formats', async () => {
    const url = `/api/attendance/export?format=xlsx&moduleId=${fx.modules.CIT2004.id}`;
    expect((await request(app).get(url)).status).toBe(401);
    const other = await login(app, 'lecturer', 'LEC002');
    expect((await other.agent.get(url)).status).toBe(403);
    const own = await login(app, 'lecturer', 'LEC001');
    expect((await own.agent.get(`/api/attendance/export?format=csv&moduleId=${fx.modules.CIT2004.id}`)).status).toBe(
      400,
    );
  });
});
