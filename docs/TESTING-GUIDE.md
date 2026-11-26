# Testing Guide

## Tools

| Tool                                            | Used for                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vitest](https://vitest.dev/)                   | Test runner and assertions (`describe`, `it`, `expect`)                                                                                            |
| [Supertest](https://github.com/ladjs/supertest) | Sends real HTTP requests to the Express app in memory (no port needed) and keeps cookies between requests (`request.agent`)                        |
| PostgreSQL test database                        | API tests run against a real, separate database (`TEST_DATABASE_URL`) so constraints, transactions and concurrency behave exactly as in production |
| ExcelJS (in tests)                              | Opens exported `.xlsx` files to check their contents                                                                                               |

## Test layout

```text
server/
├── vitest.config.js          # test env vars, global setup, one file at a time
└── tests/
    ├── globalSetup.js        # applies Prisma migrations to the test database
    ├── helpers.js            # resetDatabase(), createFixtures(), login(), openSessionInDb()
    ├── unit/                 # pure logic, no database
    │   ├── semester.test.js  # current semester, slot availability, timezone day ranges
    │   ├── catalog.test.js   # the diet-sheet catalog and its rules
    │   └── security.test.js  # bcrypt hashing, validation rules
    └── api/                  # HTTP tests against the test database
        ├── students.test.js    # registration, kiosk lookup, catalog endpoints
        ├── attendance.test.js  # check-in rules and duplicate prevention
        ├── lecturers.test.js   # lecturer registration, login, sessions, attendance, exports
        ├── admin.test.js       # admin login/logout and every admin CRUD area
        └── auth.test.js        # authorization matrix, sessions, CSRF, CORS, rate limits, injection
```

## Running the tests

Prerequisites: PostgreSQL running, `server/.env` containing `TEST_DATABASE_URL` pointing at a **separate** database (the setup script `scripts/setup-local-db.sh` creates `attendance_test_db`). The tests delete all data in that database; `globalSetup.js` refuses to run if `TEST_DATABASE_URL` equals `DATABASE_URL`.

```bash
# everything (from the project root or server/)
npm test

# from server/
npm run test:unit     # unit tests only - no database needed
npm run test:api      # API tests only
npm run test:watch    # re-run on file changes
npx vitest run tests/api/attendance.test.js            # one file
npx vitest run -t "simultaneous"                        # tests whose name matches
```

What happens on `npm test`:

1. `vitest.config.js` sets `NODE_ENV=test`, points `DATABASE_URL` at `TEST_DATABASE_URL`, lowers bcrypt cost to 4 and raises rate limits (so ordinary tests are not throttled).
2. `globalSetup.js` runs `prisma migrate deploy` against the test database.
3. Each API test file creates its own Express app; `beforeEach` truncates every table and inserts a small set of fixtures (`createFixtures()` in `helpers.js`), so tests never depend on each other or on the calendar - fixture semesters are placed around today's date.
4. Files run one at a time (`fileParallelism: false`) because they share the database.

## Understanding results

```text
 ✓ tests/api/attendance.test.js (13 tests) 1.9s
 ❯ tests/api/admin.test.js (29 tests | 1 failed)
   × students and enrollments > lists, searches and shows students
     AssertionError: expected [ '1900001', '1900002' ] to deeply equal [ '1900001' ]
 Test Files  1 failed | 7 passed (8)
      Tests  1 failed | 174 passed (175)
```

- `✓` passed, `×` failed. Vitest prints the failing assertion with an expected/received diff and the source line.
- Many API assertions include the response body in the message, e.g. `expect(res.status, JSON.stringify(res.body)).toBe(200)`, so a failure shows the server's error code.
- If every API test fails immediately, check that PostgreSQL is running and `TEST_DATABASE_URL` is correct (`psql "$TEST_DATABASE_URL" -c 'select 1'`).

Latest run (25 Nov 2026): **8 files, 175 tests, all passing.**

## What each suite verifies

### Students (`students.test.js`)

Registration creates the student and current-semester enrollments; email/ID normalisation; duplicate ID number and duplicate email (case-insensitive) rejected; field validation; invalid programme; modules not offered this semester or not in the programme rejected; either/or rule (ENS3001 + MEE2003 refused, one of them accepted); YEAR and EITHER modules accepted; unknown fields rejected; no active semester; unknown student ID (404); lookup returns name and programme but no email; only enrolled courses with open sessions are listed; already-checked-in flag; malformed IDs rejected; programme list; current-semester module filtering in term 1 and term 2 (year-long modules in both); shared modules appear in both programmes.

### Attendance integrity (`attendance.test.js`)

Successful check-in with a server timestamp; second check-in → 409 with the exact message; **12 simultaneous identical requests create exactly one record**; not enrolled → 403; enrollment in a different semester does not count; closed session → 409 (closed in the database and closed through the API); unknown session/student → 404; client-supplied `checkedInAt` rejected and nothing stored; body validation; the `unique_session_student UNIQUE (session_id, student_id)` constraint exists in `pg_constraint`; a duplicate inserted directly through Prisma (bypassing the API) is still rejected; only one open session per lecturer/module/semester.

### Lecturers (`lecturers.test.js`)

Registration (role is LECTURER, bcrypt hash, current-semester assignments, shared modules across programmes, duplicate work ID/email, courses not offered, a `role` field cannot create an admin, password policy); login by email or work ID with HTTP-only `SameSite=Lax` cookie; generic message for wrong password/unknown user; **administrator refused by the lecturer login** with no session created; `me` without the password hash; course list only shows own courses; open session (server timestamp, no second open session); close session (and not twice); sessions do not close automatically; cannot open or close another lecturer's course/session; cannot close after the assignment is removed; attendance view with date filter and all dates; another lecturer's attendance refused; filter validation; Excel export contents (course, date, student row, total) and headers; PDF export; exports refused for other lecturers, unauthenticated users and bad formats.

### Administrators (`admin.test.js`)

Admin login; wrong password; **lecturer refused by the admin login**; logout destroys the server-side session (session table empty, `me` → 401); overview counts; CRUD for schools, programmes, modules (with in-use protection and duplicate codes); programme-module assignments (add, duplicate, update slot/choice group, list, remove, invalid slot); semesters (current flag, create/update/delete, overlap, reversed dates, duplicates, bad year format, in-use protection); students (search, detail, update, duplicate email, enrollments with either/or rule across semesters, delete protection); lecturer accounts (create, list without hashes, update and password reset, assignments, admin is not a lecturer, delete protection); creating another administrator.

### Authentication and authorization (`auth.test.js`)

Every admin endpoint (36) and lecturer endpoint (6) returns 401 without a session; **a lecturer gets 403 on every admin endpoint**; an administrator gets 403 on every lecturer endpoint; changed role or deleted account invalidates the session; forged cookies rejected; session ID regenerated on login; sessions stored in PostgreSQL; logout invalidates the server-side session (replaying the old cookie fails); session status endpoint; a `lecturerId` in the query is ignored and in a body is rejected; CSRF token required for lecturer and admin changes and logout; foreign `Origin` refused; CORS only allows the frontend origin; rate limits on failed logins, check-in and registration (429); SQL-injection strings treated as data; no raw database errors in responses; security headers present and `X-Powered-By` hidden.

### Unit tests

Current-semester determination from configured date ranges (inclusive boundaries, none between semesters, not hardcoded months); slot availability (1, 2, YEAR, EITHER); date validation; Jamaica and daylight-saving day ranges; the catalog contains all 12 programmes, stores each module once, shares Years 1–2 between CS and IT, marks PRJ4020 as YEAR everywhere, records the ENS3001/MEE2003 pair, applies credit overrides and refuses unresolved conflicts; bcrypt hashing/verification/salting; password hashes never serialised; validation normalisation and rejection of SQL-looking IDs.

## Manual testing checklist

Start the app (`npm run dev` from the project root), sign in with the development accounts in [BUILD-AND-SETUP-GUIDE.md](BUILD-AND-SETUP-GUIDE.md#g-authentication-setup), then:

1. **Lecturer:** sign in at `/lecturer/login` as `LEC001`, open the `CIT2004` session on the dashboard.
2. **Kiosk:** at `/`, enter `2600001` → confirm the name and programme → tap `CIT2004` → confirmation appears and the screen resets after ~6 seconds. Repeat: the course now shows "Already checked in".
3. Enter `2600004` (not enrolled in CIT2004): "No open sessions right now". Enter `9999999`: "We don't recognise that ID" with a link to register.
4. **Register** a new student from that link (pick BSc Computing – Computer Science, tick CMP3040 then BIO3004 - an either/or pair in Semester 1; ENS3001/MEE2003 is the Semester 2 pair - and see the first untick), include CIT2004, then check in.
5. **Dashboard:** the live count increases; close the session (confirmation dialog). Try to check in again → "Session closed".
6. **Attendance page:** filter by course and date, switch to "All dates", download Excel and PDF and open them.
7. **Role separation:** try the admin credentials on `/lecturer/login` (refused), then sign in at `/admin/login`. Visit `/lecturer` while signed in as admin → redirected to `/admin`.
8. **Admin:** add a semester that overlaps an existing one (refused), add a module to a programme, add/remove a student enrollment, assign a course to a lecturer, sign out.
9. **Phone layout:** open the kiosk in the browser's device toolbar (e.g. 375 px wide).

## Adding a new test

1. Pick the right folder: `tests/unit` for pure functions, `tests/api` for anything that goes through HTTP or the database.
2. For API tests, copy the setup from an existing file:

```js
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase } from '../../src/db/client.js';
import { createFixtures, login, makeApp, resetDatabase } from '../helpers.js';

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

it('lecturer sees their own courses', async () => {
  const { agent } = await login(app, 'lecturer', 'LEC001');
  const res = await agent.get('/api/lecturer/courses');
  expect(res.status).toBe(200);
});
```

3. Use `login(app, 'lecturer' | 'admin', identifier)` to get a signed-in agent plus its CSRF token, and send `.set('X-CSRF-Token', csrf)` on POST/PATCH/DELETE.
4. To test date-dependent behaviour, replace the clock: `clock.now = () => new Date('2027-02-01T12:00:00Z')` (from `src/services/semesterService.js`) and restore it in `afterEach`.
5. Run `npm test` before committing.
