// Authentication, role-based authorization and security hardening.
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

const sessionCookie = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('sams.sid='))?.split(';')[0];

// Every administrator endpoint (method, path). Each must refuse non-admins.
const ADMIN_ENDPOINTS = [
  ['get', '/api/admin/overview'],
  ['get', '/api/admin/schools'],
  ['post', '/api/admin/schools'],
  ['patch', '/api/admin/schools/1'],
  ['delete', '/api/admin/schools/1'],
  ['get', '/api/admin/programs'],
  ['post', '/api/admin/programs'],
  ['patch', '/api/admin/programs/1'],
  ['delete', '/api/admin/programs/1'],
  ['get', '/api/admin/programs/1/modules'],
  ['post', '/api/admin/programs/1/modules'],
  ['patch', '/api/admin/programs/1/modules/1'],
  ['delete', '/api/admin/programs/1/modules/1'],
  ['get', '/api/admin/modules'],
  ['post', '/api/admin/modules'],
  ['patch', '/api/admin/modules/1'],
  ['delete', '/api/admin/modules/1'],
  ['get', '/api/admin/semesters'],
  ['post', '/api/admin/semesters'],
  ['patch', '/api/admin/semesters/1'],
  ['delete', '/api/admin/semesters/1'],
  ['get', '/api/admin/students'],
  ['get', '/api/admin/students/1'],
  ['patch', '/api/admin/students/1'],
  ['delete', '/api/admin/students/1'],
  ['post', '/api/admin/students/1/enrollments'],
  ['delete', '/api/admin/students/1/enrollments/1/1'],
  ['get', '/api/admin/lecturers'],
  ['post', '/api/admin/lecturers'],
  ['get', '/api/admin/lecturers/1'],
  ['patch', '/api/admin/lecturers/1'],
  ['delete', '/api/admin/lecturers/1'],
  ['post', '/api/admin/lecturers/1/modules'],
  ['delete', '/api/admin/lecturers/1/modules/1/1'],
  ['get', '/api/admin/admins'],
  ['post', '/api/admin/admins'],
];

const LECTURER_ENDPOINTS = [
  ['get', '/api/auth/lecturer/me'],
  ['get', '/api/lecturer/courses'],
  ['post', '/api/class-sessions'],
  ['patch', '/api/class-sessions/1/close'],
  ['get', '/api/attendance?moduleId=1'],
  ['get', '/api/attendance/export?format=pdf&moduleId=1'],
];

describe('unauthenticated requests', () => {
  it.each([...ADMIN_ENDPOINTS, ...LECTURER_ENDPOINTS])('%s %s -> 401', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('role separation', () => {
  it('lecturers are refused on every administrator endpoint', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC001');
    for (const [method, path] of ADMIN_ENDPOINTS) {
      const res = await agent[method](path).set('X-CSRF-Token', csrf).send({});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
      expect(res.body.code).toBe('WRONG_ROLE');
    }
  });

  it('administrators are refused on every lecturer endpoint', async () => {
    const { agent, csrf } = await login(app, 'admin', 'ADM001');
    for (const [method, path] of LECTURER_ENDPOINTS) {
      const res = await agent[method](path).set('X-CSRF-Token', csrf).send({});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });

  it('a changed role invalidates the existing session', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC001');
    await prisma.user.update({ where: { id: fx.users.lecturer1.id }, data: { role: 'ADMIN' } });
    const res = await agent.get('/api/admin/overview');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_INVALID');
  });

  it('a deleted account loses access immediately', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC002');
    await prisma.user.delete({ where: { id: fx.users.lecturer2.id } });
    expect((await agent.get('/api/lecturer/courses')).status).toBe(401);
  });
});

describe('sessions', () => {
  it('rejects forged or unknown session cookies', async () => {
    const res = await request(app)
      .get('/api/lecturer/courses')
      .set('Cookie', 'sams.sid=s%3Afake-session-id.invalidsignature');
    expect(res.status).toBe(401);
  });

  it('regenerates the session ID on login (prevents session fixation)', async () => {
    const agent = request.agent(app);
    const first = await agent.post('/api/auth/lecturer/login').send({ identifier: 'LEC001', password: 'Password123' });
    const second = await agent.post('/api/auth/lecturer/login').send({ identifier: 'LEC001', password: 'Password123' });
    expect(sessionCookie(first)).toBeTruthy();
    expect(sessionCookie(second)).not.toBe(sessionCookie(first));
  });

  it('stores sessions in PostgreSQL, not in memory', async () => {
    await login(app, 'lecturer', 'LEC001');
    const rows = await prisma.userSession.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].sess.user).toEqual({ id: fx.users.lecturer1.id, role: 'LECTURER' });
  });

  it('logout invalidates the server-side session, not just the browser cookie', async () => {
    const res = await request(app)
      .post('/api/auth/lecturer/login')
      .send({ identifier: 'LEC001', password: 'Password123' });
    const cookie = sessionCookie(res);
    const csrf = res.body.data.csrfToken;

    const logout = await request(app).post('/api/auth/lecturer/logout').set('Cookie', cookie).set('X-CSRF-Token', csrf);
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'][0]).toMatch(/sams\.sid=;/); // cookie cleared

    // Replaying the old cookie must fail: the session no longer exists.
    const replay = await request(app).get('/api/lecturer/courses').set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(await prisma.userSession.count()).toBe(0);
  });

  it('GET /api/auth/session reports who is signed in', async () => {
    expect((await request(app).get('/api/auth/session')).body.data.authenticated).toBe(false);
    const { agent } = await login(app, 'admin', 'ADM001');
    const res = await agent.get('/api/auth/session');
    expect(res.body.data).toMatchObject({ authenticated: true, user: { role: 'ADMIN' } });
  });
});

describe('identity always comes from the session', () => {
  it('ignores a lecturer ID supplied in the query string', async () => {
    const { agent } = await login(app, 'lecturer', 'LEC002');
    const res = await agent.get(
      `/api/attendance?moduleId=${fx.modules.CIT2004.id}&lecturerId=${fx.users.lecturer1.id}`,
    );
    expect(res.status).toBe(403);
  });

  it('rejects a lecturer ID or role supplied in a request body', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC002');
    const res = await agent
      .post('/api/class-sessions')
      .set('X-CSRF-Token', csrf)
      .send({ moduleId: fx.modules.CIT2004.id, lecturerId: fx.users.lecturer1.id });
    expect(res.status).toBe(400);
    expect(await prisma.classSession.count()).toBe(0);
  });
});

describe('CSRF and origin protection', () => {
  it('requires the CSRF token for state-changing lecturer requests', async () => {
    const { agent, csrf } = await login(app, 'lecturer', 'LEC001');
    const body = { moduleId: fx.modules.CIT2004.id };
    expect((await agent.post('/api/class-sessions').send(body)).body.code).toBe('CSRF_INVALID');
    expect((await agent.post('/api/class-sessions').set('X-CSRF-Token', 'x'.repeat(64)).send(body)).status).toBe(403);
    expect((await agent.post('/api/class-sessions').set('X-CSRF-Token', csrf).send(body)).status).toBe(201);
  });

  it('requires the CSRF token for administrator changes and logout', async () => {
    const { agent } = await login(app, 'admin', 'ADM001');
    expect((await agent.post('/api/admin/schools').send({ code: 'X', name: 'X' })).status).toBe(403);
    expect((await agent.post('/api/auth/admin/logout')).status).toBe(403);
  });

  it('refuses state-changing requests from foreign origins', async () => {
    const session = await openSessionInDb(fx.users.lecturer1, fx.modules.CIT2004, fx.semesters.current);
    const body = { idNumber: fx.students.s1.idNumber, sessionId: session.id };
    const evil = await request(app).post('/api/attendance').set('Origin', 'https://evil.example').send(body);
    expect(evil.status).toBe(403);
    expect(evil.body.code).toBe('ORIGIN_NOT_ALLOWED');
    const ours = await request(app).post('/api/attendance').set('Origin', 'http://localhost:5173').send(body);
    expect(ours.status).toBe(201);
  });

  it('only allows our frontend origin through CORS', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('limits failed logins', async () => {
    const limited = makeApp({
      rateLimits: {
        login: { max: 3, windowMs: 60_000 },
        checkIn: { max: 100, windowMs: 60_000 },
        register: { max: 100, windowMs: 60_000 },
      },
    });
    const attempt = () =>
      request(limited).post('/api/auth/admin/login').send({ identifier: 'ADM001', password: 'Wrong12345' });
    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });

  it('limits check-in and registration requests', async () => {
    const limited = makeApp({
      rateLimits: {
        login: { max: 100, windowMs: 60_000 },
        checkIn: { max: 2, windowMs: 60_000 },
        register: { max: 1, windowMs: 60_000 },
      },
    });
    await request(limited).get('/api/students/1900001/open-courses');
    await request(limited).get('/api/students/1900001/open-courses');
    expect((await request(limited).post('/api/attendance').send({ idNumber: '1900001', sessionId: 1 })).status).toBe(
      429,
    );

    await request(limited).post('/api/lecturers').send({});
    expect((await request(limited).post('/api/students').send({})).status).toBe(429);
  });
});

describe('injection and information leaks', () => {
  it('treats SQL in inputs as plain data', async () => {
    const login1 = await request(app)
      .post('/api/auth/admin/login')
      .send({ identifier: "' OR '1'='1' --", password: "' OR '1'='1" });
    expect(login1.status).toBe(401);

    const { agent } = await login(app, 'admin', 'ADM001');
    const search = await agent.get(`/api/admin/students?search=${encodeURIComponent("'; DROP TABLE students; --")}`);
    expect(search.status).toBe(200);
    expect(search.body.data).toEqual([]);
    expect(await prisma.student.count()).toBe(2);
  });

  it('never returns raw database errors', async () => {
    const res = await request(app).post('/api/students').set('Content-Type', 'application/json').send('{"broken":');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|SELECT|stack/i);
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
