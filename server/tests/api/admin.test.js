// Administrator login and management screens (catalog, semesters, people).
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../src/db/client.js';
import { createFixtures, login, makeApp, openSessionInDb, resetDatabase } from '../helpers.js';

let app;
let fx;
let admin; // { agent, csrf }

beforeAll(() => {
  app = makeApp();
});
beforeEach(async () => {
  await resetDatabase();
  fx = await createFixtures();
  admin = await login(app, 'admin', 'admin@test.example');
});
afterAll(disconnectDatabase);

const post = (path, body) => admin.agent.post(`/api/admin${path}`).set('X-CSRF-Token', admin.csrf).send(body);
const patch = (path, body) => admin.agent.patch(`/api/admin${path}`).set('X-CSRF-Token', admin.csrf).send(body);
const del = (path) => admin.agent.delete(`/api/admin${path}`).set('X-CSRF-Token', admin.csrf);
const get = (path) => admin.agent.get(`/api/admin${path}`);

describe('POST /api/auth/admin/login', () => {
  it('signs administrators in and points them to /admin', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ identifier: 'adm001', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ user: { role: 'ADMIN' }, redirectTo: '/admin' });
  });

  it('rejects wrong credentials', async () => {
    const res = await request(app).post('/api/auth/admin/login').send({ identifier: 'ADM001', password: 'Wrong12345' });
    expect(res.status).toBe(401);
  });

  it('refuses lecturers, even with the correct password', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/admin/login').send({ identifier: 'LEC001', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WRONG_LOGIN_PORTAL');
    expect((await agent.get('/api/lecturer/courses')).status).toBe(401);
  });

  it('logout destroys the server-side session', async () => {
    const res = await admin.agent.post('/api/auth/admin/logout').set('X-CSRF-Token', admin.csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.redirectTo).toBe('/admin/login');
    expect((await admin.agent.get('/api/auth/admin/me')).status).toBe(401);
    expect(await prisma.userSession.count()).toBe(0);
  });
});

describe('overview', () => {
  it('summarises the system', async () => {
    const res = await get('/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.counts).toMatchObject({ programs: 2, modules: 7, students: 2, lecturers: 2, admins: 1 });
    expect(res.body.data.currentSemester.id).toBe(fx.semesters.current.id);
  });
});

describe('schools CRUD', () => {
  it('creates, lists, updates and deletes a school', async () => {
    const created = await post('/schools', { code: 'sobe', name: 'School of Business' });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('SOBE');
    expect((await post('/schools', { code: 'SOBE', name: 'Duplicate' })).status).toBe(409);

    const list = await get('/schools');
    expect(list.body.data.map((s) => s.code)).toEqual(['SCIT', 'SOBE']);

    const updated = await patch(`/schools/${created.body.data.id}`, { name: 'Business School' });
    expect(updated.body.data.name).toBe('Business School');

    expect((await del(`/schools/${created.body.data.id}`)).status).toBe(200);
  });

  it('refuses to delete a school that still has programmes', async () => {
    const res = await del(`/schools/${fx.school.id}`);
    expect(res.status).toBe(409);
  });
});

describe('programmes CRUD', () => {
  it('creates, updates and deletes a programme', async () => {
    const created = await post('/programs', { schoolId: fx.school.id, name: 'BSc Gaming', major: 'Game Development' });
    expect(created.status).toBe(201);
    expect(created.body.data.displayName).toBe('BSc Gaming – Game Development');

    const updated = await patch(`/programs/${created.body.data.id}`, { major: 'Game Design' });
    expect(updated.body.data.major).toBe('Game Design');

    expect((await del(`/programs/${created.body.data.id}`)).status).toBe(200);
    expect((await get('/programs')).body.data).toHaveLength(2);
  });

  it('refuses to delete a programme that has students', async () => {
    expect((await del(`/programs/${fx.programs.cs.id}`)).status).toBe(409);
  });

  it('validates the school reference', async () => {
    expect((await post('/programs', { schoolId: 9999, name: 'X' })).status).toBe(404);
  });
});

describe('modules CRUD', () => {
  it('creates, searches, updates and deletes a module', async () => {
    const created = await post('/modules', { code: 'cit3027', name: 'Mobile Computing', credits: 4 });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('CIT3027');
    expect((await post('/modules', { code: 'CIT3027', name: 'Again', credits: 4 })).status).toBe(409);

    const search = await get('/modules?search=mobile');
    expect(search.body.data.map((m) => m.code)).toEqual(['CIT3027']);

    expect((await patch(`/modules/${created.body.data.id}`, { credits: 3 })).body.data.credits).toBe(3);
    expect((await del(`/modules/${created.body.data.id}`)).status).toBe(200);
  });

  it('refuses to delete a module with enrollments', async () => {
    expect((await del(`/modules/${fx.modules.CIT2004.id}`)).status).toBe(409);
  });

  it('validates module codes', async () => {
    expect((await post('/modules', { code: 'not a code', name: 'X', credits: 3 })).status).toBe(400);
  });
});

describe('programme-module assignments', () => {
  it('adds, updates, lists and removes modules on a programme', async () => {
    const added = await post(`/programs/${fx.programs.it.id}/modules`, {
      moduleId: fx.modules.PRJ4020.id,
      level: 4,
      semesterSlot: 'YEAR',
    });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ level: 4, semesterSlot: 'YEAR', choiceGroup: null });

    const dup = await post(`/programs/${fx.programs.it.id}/modules`, {
      moduleId: fx.modules.PRJ4020.id,
      level: 4,
      semesterSlot: 'YEAR',
    });
    expect(dup.status).toBe(409);

    const updated = await patch(`/programs/${fx.programs.it.id}/modules/${fx.modules.PRJ4020.id}`, {
      semesterSlot: '2',
      choiceGroup: 'X/Y',
    });
    expect(updated.body.data).toMatchObject({ semesterSlot: '2', choiceGroup: 'X/Y' });

    const list = await get(`/programs/${fx.programs.it.id}/modules`);
    expect(list.body.data.map((r) => r.module.code)).toEqual(['CMP2018', 'PRJ4020']);

    expect((await del(`/programs/${fx.programs.it.id}/modules/${fx.modules.PRJ4020.id}`)).status).toBe(200);
  });

  it('only accepts semester slots 1, 2, YEAR or EITHER', async () => {
    const res = await post(`/programs/${fx.programs.it.id}/modules`, {
      moduleId: fx.modules.PRJ4020.id,
      level: 4,
      semesterSlot: '3',
    });
    expect(res.status).toBe(400);
  });
});

describe('semester management', () => {
  it('lists semesters and marks the current one', async () => {
    const res = await get('/semesters');
    const current = res.body.data.find((s) => s.isCurrent);
    expect(current.id).toBe(fx.semesters.current.id);
  });

  it('creates, updates and deletes a semester', async () => {
    const created = await post('/semesters', {
      academicYear: '2095/2096',
      term: 1,
      startDate: '2095-09-01',
      endDate: '2095-12-31',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.label).toBe('2095/2096 Semester 1');

    const updated = await patch(`/semesters/${created.body.data.id}`, { endDate: '2095-12-20' });
    expect(updated.body.data.endDate).toBe('2095-12-20');

    expect((await del(`/semesters/${created.body.data.id}`)).status).toBe(200);
  });

  it('rejects overlapping ranges, reversed dates, duplicates and bad years', async () => {
    const start = fx.semesters.current.startDate.toISOString().slice(0, 10);
    expect(
      (await post('/semesters', { academicYear: '2080/2081', term: 1, startDate: start, endDate: '2099-01-01' })).body
        .code,
    ).toBe('SEMESTER_OVERLAP');
    expect(
      (await post('/semesters', { academicYear: '2095/2096', term: 1, startDate: '2095-12-31', endDate: '2095-09-01' }))
        .status,
    ).toBe(400);
    expect(
      (await post('/semesters', { academicYear: '2090/2091', term: 1, startDate: '2096-01-01', endDate: '2096-02-01' }))
        .status,
    ).toBe(409);
    expect(
      (await post('/semesters', { academicYear: '2095/2097', term: 1, startDate: '2095-09-01', endDate: '2095-12-31' }))
        .status,
    ).toBe(400);
  });

  it('refuses to delete a semester that is in use', async () => {
    expect((await del(`/semesters/${fx.semesters.current.id}`)).status).toBe(409);
  });
});

describe('students and enrollments', () => {
  it('lists, searches and shows students with their enrollments', async () => {
    const list = await get('/students?search=1900001');
    expect(list.body.data.map((s) => s.idNumber)).toEqual(['1900001']);
    expect(list.body.data[0].currentEnrollmentCount).toBe(3);

    const detail = await get(`/students/${fx.students.s1.id}`);
    expect(detail.body.data.enrollments.map((e) => e.module.code).sort()).toEqual(['CIT2004', 'CMP2018', 'PRJ4020']);
  });

  it('updates student details', async () => {
    const res = await patch(`/students/${fx.students.s2.id}`, { firstName: 'Susan' });
    expect(res.body.data.firstName).toBe('Susan');
    expect((await patch(`/students/${fx.students.s2.id}`, { email: 's1@students.test.example' })).status).toBe(409);
  });

  it('adds and removes enrollments, enforcing the either/or rule', async () => {
    const { s2 } = fx.students;
    const semesterId = fx.semesters.current.id;
    const add = await post(`/students/${s2.id}/enrollments`, { moduleId: fx.modules.ENS3001.id, semesterId });
    expect(add.status).toBe(201);

    const conflict = await post(`/students/${s2.id}/enrollments`, { moduleId: fx.modules.MEE2003.id, semesterId });
    expect(conflict.status).toBe(400);
    expect(conflict.body.code).toBe('EITHER_OR_CONFLICT');

    // The pair is allowed in different semesters.
    const otherSemester = await post(`/students/${s2.id}/enrollments`, {
      moduleId: fx.modules.MEE2003.id,
      semesterId: fx.semesters.next.id,
    });
    expect(otherSemester.status).toBe(201);

    const dup = await post(`/students/${s2.id}/enrollments`, { moduleId: fx.modules.ENS3001.id, semesterId });
    expect(dup.status).toBe(409);

    const removed = await del(`/students/${s2.id}/enrollments/${semesterId}/${fx.modules.ENS3001.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.enrollments.map((e) => e.module.code).sort()).toEqual(['CMP2018', 'MEE2003']);
  });

  it('protects students with attendance from deletion', async () => {
    const session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    await prisma.attendance.create({ data: { sessionId: session.id, studentId: fx.students.s1.id } });
    expect((await del(`/students/${fx.students.s1.id}`)).status).toBe(409);
    expect((await del(`/students/${fx.students.s2.id}`)).status).toBe(200);
  });
});

describe('lecturer accounts and course assignments', () => {
  it('creates and lists lecturers without exposing password hashes', async () => {
    const created = await post('/lecturers', {
      firstName: 'New',
      lastName: 'Lecturer',
      email: 'new@staff.test.example',
      workId: 'LEC777',
      password: 'Welcome123',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe('LECTURER');

    const list = await get('/lecturers');
    expect(list.body.data.map((l) => l.workId)).toEqual(expect.arrayContaining(['LEC001', 'LEC002', 'LEC777']));
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('updates a lecturer and resets their password', async () => {
    const res = await patch(`/lecturers/${fx.users.lecturer2.id}`, { lastName: 'Renamed', password: 'NewPass456' });
    expect(res.status).toBe(200);
    expect(res.body.data.lastName).toBe('Renamed');
    const loginRes = await request(app)
      .post('/api/auth/lecturer/login')
      .send({ identifier: 'LEC002', password: 'NewPass456' });
    expect(loginRes.status).toBe(200);
  });

  it('manages lecturer-course assignments', async () => {
    const id = fx.users.lecturer2.id;
    const semesterId = fx.semesters.current.id;
    const add = await post(`/lecturers/${id}/modules`, { moduleId: fx.modules.CIT2004.id, semesterId });
    expect(add.status).toBe(201);
    expect(add.body.data.assignments.map((a) => a.module.code).sort()).toEqual(['CIT2004', 'CMP2018']);
    expect((await post(`/lecturers/${id}/modules`, { moduleId: fx.modules.CIT2004.id, semesterId })).status).toBe(409);

    const remove = await del(`/lecturers/${id}/modules/${semesterId}/${fx.modules.CIT2004.id}`);
    expect(remove.body.data.assignments.map((a) => a.module.code)).toEqual(['CMP2018']);
  });

  it('will not treat an administrator as a lecturer', async () => {
    expect((await get(`/lecturers/${fx.users.admin.id}`)).status).toBe(404);
  });

  it('deletes lecturers without session history but protects those with it', async () => {
    await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    expect((await del(`/lecturers/${fx.users.lecturer1.id}`)).status).toBe(409);
    expect((await del(`/lecturers/${fx.users.lecturer2.id}`)).status).toBe(200);
  });
});

describe('administrator accounts', () => {
  it('lets an authenticated administrator create another administrator', async () => {
    const res = await post('/admins', {
      firstName: 'Second',
      lastName: 'Admin',
      email: 'admin2@test.example',
      workId: 'ADM002',
      password: 'Another123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('ADMIN');
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ identifier: 'ADM002', password: 'Another123' });
    expect(loginRes.status).toBe(200);
    expect((await get('/admins')).body.data).toHaveLength(2);
  });
});
