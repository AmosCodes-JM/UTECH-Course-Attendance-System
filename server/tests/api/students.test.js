// Student registration, the check-in lookup and the public catalog endpoints.
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../src/db/client.js';
import { clock } from '../../src/services/semesterService.js';
import { createFixtures, makeApp, openSessionInDb, resetDatabase } from '../helpers.js';

let app;
let fx;

beforeAll(() => {
  app = makeApp();
});
beforeEach(async () => {
  await resetDatabase();
  fx = await createFixtures();
});
afterEach(() => {
  clock.now = () => new Date();
});
afterAll(disconnectDatabase);

const newStudent = (overrides = {}) => ({
  firstName: 'Nia',
  lastName: 'Newton',
  idNumber: '2000123',
  email: 'nia.newton@students.test.example',
  programId: fx.programs.cs.id,
  moduleIds: [fx.modules.CIT2004.id, fx.modules.PRJ4020.id],
  ...overrides,
});

describe('POST /api/students (registration)', () => {
  it('creates the student and their current-semester enrollments', async () => {
    const res = await request(app).post('/api/students').send(newStudent());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student).toMatchObject({ idNumber: '2000123', firstName: 'Nia' });

    const student = await prisma.student.findUnique({ where: { idNumber: '2000123' }, include: { enrollments: true } });
    expect(student.enrollments).toHaveLength(2);
    expect(student.enrollments.every((e) => e.semesterId === fx.semesters.current.id)).toBe(true);
  });

  it('normalises the email and ID number', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ idNumber: ' ab2000 ', email: ' Nia.Newton@Students.TEST.example ' }));
    expect(res.status).toBe(201);
    const student = await prisma.student.findUnique({ where: { idNumber: 'AB2000' } });
    expect(student.email).toBe('nia.newton@students.test.example');
  });

  it('rejects a duplicate student ID number', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ idNumber: fx.students.s1.idNumber }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_ID_NUMBER');
  });

  it('rejects a duplicate email address (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ email: 'S1@Students.Test.Example' }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_EMAIL');
  });

  it('validates required fields and email format', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ firstName: '', email: 'nope' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['firstName', 'email']));
  });

  it('requires at least one module and a valid programme', async () => {
    expect(
      (
        await request(app)
          .post('/api/students')
          .send(newStudent({ moduleIds: [] }))
      ).status,
    ).toBe(400);
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ programId: 99999 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PROGRAM');
  });

  it('rejects modules that are not offered this semester (semester 2 module in semester 1)', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ moduleIds: [fx.modules.CMP1025.id] }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MODULE_NOT_OFFERED');
  });

  it('rejects modules that belong to a different programme', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ programId: fx.programs.it.id, moduleIds: [fx.modules.CIT2004.id] }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MODULE_NOT_OFFERED');
  });

  it('enforces the either/or rule (ENS3001 or MEE2003, not both)', async () => {
    const both = await request(app)
      .post('/api/students')
      .send(newStudent({ moduleIds: [fx.modules.ENS3001.id, fx.modules.MEE2003.id] }));
    expect(both.status).toBe(400);
    expect(both.body.code).toBe('EITHER_OR_CONFLICT');

    const one = await request(app)
      .post('/api/students')
      .send(newStudent({ moduleIds: [fx.modules.ENS3001.id] }));
    expect(one.status).toBe(201);
  });

  it('accepts year-long and either-semester modules', async () => {
    const res = await request(app)
      .post('/api/students')
      .send(newStudent({ moduleIds: [fx.modules.PRJ4020.id, fx.modules.CSP1001.id] }));
    expect(res.status).toBe(201);
  });

  it('refuses unknown fields (mass assignment)', async () => {
    const res = await request(app)
      .post('/api/students')
      .send({ ...newStudent(), id: 1, createdAt: '2000-01-01' });
    expect(res.status).toBe(400);
  });

  it('fails clearly when there is no active semester', async () => {
    clock.now = () => new Date('2099-07-01T12:00:00Z');
    const res = await request(app).post('/api/students').send(newStudent());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_ACTIVE_SEMESTER');
  });
});

describe('GET /api/students/:idNumber/open-courses', () => {
  it('returns 404 for an unknown student ID', async () => {
    const res = await request(app).get('/api/students/9999999/open-courses');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('returns the student name and programme, but no email', async () => {
    const res = await request(app).get(`/api/students/${fx.students.s1.idNumber}/open-courses`);
    expect(res.status).toBe(200);
    expect(res.body.data.student).toMatchObject({ firstName: 'Stu', lastName: 'Dent' });
    expect(res.body.data.student.program.displayName).toBe('BSc Computing – Computer Science');
    expect(res.body.data.student).not.toHaveProperty('email');
    expect(res.body.data.courses).toEqual([]);
  });

  it('lists only enrolled courses that have an open session', async () => {
    const { lecturer1, lecturer2 } = fx.users;
    await openSessionInDb(lecturer1, fx.modules.CIT2004, fx.semesters.current); // s1 enrolled, s2 not
    await openSessionInDb(lecturer2, fx.modules.CMP2018, fx.semesters.current); // both enrolled
    const closed = await openSessionInDb(lecturer1, fx.modules.PRJ4020, fx.semesters.current);
    await prisma.classSession.update({ where: { id: closed.id }, data: { closedAt: new Date() } });

    const s1 = await request(app).get(`/api/students/${fx.students.s1.idNumber}/open-courses`);
    expect(s1.body.data.courses.map((c) => c.code).sort()).toEqual(['CIT2004', 'CMP2018']);

    const s2 = await request(app).get(`/api/students/${fx.students.s2.idNumber}/open-courses`);
    expect(s2.body.data.courses.map((c) => c.code)).toEqual(['CMP2018']);
    expect(s2.body.data.courses[0]).toMatchObject({ lecturer: 'Lou Two', alreadyCheckedIn: false });
  });

  it('flags courses the student has already checked in to', async () => {
    const session = await openSessionInDb(fx.users.lecturer2, fx.modules.CMP2018, fx.semesters.current);
    await request(app).post('/api/attendance').send({ idNumber: fx.students.s2.idNumber, sessionId: session.id });
    const res = await request(app).get(`/api/students/${fx.students.s2.idNumber}/open-courses`);
    expect(res.body.data.courses[0].alreadyCheckedIn).toBe(true);
  });

  it('rejects malformed ID numbers', async () => {
    const res = await request(app).get(`/api/students/${encodeURIComponent("1' OR '1'='1")}/open-courses`);
    expect(res.status).toBe(400);
  });
});

describe('catalog endpoints', () => {
  it('GET /api/programs lists programmes', async () => {
    const res = await request(app).get('/api/programs');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.major)).toEqual(['Computer Science', 'Information Technology']);
  });

  it('GET /api/programs/:id/modules?semester=current returns semester-1, YEAR and EITHER modules in term 1', async () => {
    const res = await request(app).get(`/api/programs/${fx.programs.cs.id}/modules?semester=current`);
    expect(res.status).toBe(200);
    const codes = res.body.data.modules.map((m) => m.code);
    expect(codes).toEqual(expect.arrayContaining(['CIT2004', 'CMP2018', 'PRJ4020', 'CSP1001', 'ENS3001', 'MEE2003']));
    expect(codes).not.toContain('CMP1025');
    expect(res.body.data.semester.term).toBe(1);
    const ens = res.body.data.modules.find((m) => m.code === 'ENS3001');
    expect(ens).toMatchObject({ semesterSlot: '1', choiceGroup: 'ENS3001/MEE2003' });
  });

  it('switches to semester-2 modules when today is in semester 2 (year-long modules stay)', async () => {
    const next = fx.semesters.next.startDate;
    clock.now = () => new Date(next.getTime() + 2 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000);
    const res = await request(app).get(`/api/programs/${fx.programs.cs.id}/modules?semester=current`);
    const codes = res.body.data.modules.map((m) => m.code);
    expect(codes).toEqual(expect.arrayContaining(['CMP1025', 'PRJ4020', 'CSP1001']));
    expect(codes).not.toContain('CIT2004');
  });

  it('shows shared modules in every programme that offers them', async () => {
    const res = await request(app).get(`/api/programs/${fx.programs.it.id}/modules`);
    expect(res.body.data.modules.map((m) => m.code)).toEqual(['CMP2018']);
  });

  it('returns 404 for an unknown programme', async () => {
    expect((await request(app).get('/api/programs/99999/modules')).status).toBe(404);
  });

  it('GET /api/semesters/current returns the active semester', async () => {
    const res = await request(app).get('/api/semesters/current');
    expect(res.body.data.semester).toMatchObject({ id: fx.semesters.current.id, term: 1 });
  });
});
