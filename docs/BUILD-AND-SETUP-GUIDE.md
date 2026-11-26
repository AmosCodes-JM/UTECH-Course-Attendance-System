# Build and Setup Guide

The complete guide to installing, configuring, running, testing and hosting the Student Attendance Management System. Every command here matches the code in this repository.

- [A. Project introduction](#a-project-introduction)
- [B. Prerequisites](#b-prerequisites)
- [C. Project installation](#c-project-installation)
- [D. Database setup](#d-database-setup)
- [E. Environment configuration](#e-environment-configuration)
- [F. Running locally](#f-running-locally)
- [G. Authentication setup](#g-authentication-setup)
- [H. Testing](#h-testing)
- [I. Production build](#i-production-build)
- [J. Traditional Express hosting](#j-traditional-express-hosting)
- [K. Troubleshooting](#k-troubleshooting)
- [L. Project maintenance](#l-project-maintenance)

---

## A. Project introduction

### What the application does

It replaces paper attendance sheets for the School of Computing & Information Technology (SCIT). A student types their ID number at a kiosk (or on their phone), confirms their name and programme, and taps the course whose session is open - attendance is recorded with a server timestamp. Lecturers sign in to open and close sessions for their own courses and to view and export attendance. Administrators maintain the academic catalog (taken from the SCIT diet sheets), semesters, enrollments and accounts.

### Main features

- Student self-registration with programme and current-semester module selection (either/or pairs enforced)
- One-tap check-in kiosk that resets itself, with clear error states
- Two-step lecturer registration; separate lecturer and administrator login systems
- Lecturer dashboard: open/close sessions (never automatic), live check-in counts
- Attendance filtered by course and date, exported to Excel (ExcelJS) or PDF (PDFKit) on the server
- Admin CRUD for schools, programmes, modules, programme-module assignments (level, semester slot, either/or group), semesters, students and enrollments, lecturers and course assignments, administrators
- Duplicate check-ins prevented by the frontend, the backend **and** a PostgreSQL `UNIQUE (session_id, student_id)` constraint
- Full SCIT catalog: 12 programmes, 183 modules from 22 diet sheets

### Architecture

```text
Browser (React + Vite SPA)
   │  fetch() JSON, credentials: 'include'
   ▼
Express API (Node.js, long-running process, port 5000)
   │  routes → middleware (session auth, role, ownership, CSRF, Zod, rate limits) → controllers → services
   │  exports/ (ExcelJS, PDFKit)
   ▼
PostgreSQL (Prisma ORM 7 + pg driver adapter)  — 11 domain tables + session table
```

The React app never touches the database; every rule is enforced in Express and, where possible, by database constraints.

### Technology stack

| Layer        | Technology                                                          |
| ------------ | ------------------------------------------------------------------- |
| Frontend     | React 19 + Vite 8, React Router 8, Fetch API, plain CSS             |
| Backend      | Node.js 24 LTS + Express 5                                          |
| Database     | PostgreSQL 18, Prisma ORM 7 with `@prisma/adapter-pg`               |
| Auth         | bcrypt, express-session, connect-pg-simple (sessions in PostgreSQL) |
| Validation   | Zod 4                                                               |
| Security     | helmet, cors, express-rate-limit, CSRF tokens + origin check        |
| Reports      | ExcelJS, PDFKit                                                     |
| Tests        | Vitest + Supertest                                                  |
| Code quality | ESLint, Prettier                                                    |

---

## B. Prerequisites

| Software      | Version used                                        | Check                                                   |
| ------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Node.js (LTS) | 24.x (**22.18 or newer required**)                  | `node --version`                                        |
| npm           | 11.x (comes with Node)                              | `npm --version`                                         |
| PostgreSQL    | 18 (14+ should work)                                | `psql --version` and `sudo systemctl status postgresql` |
| Git           | any recent                                          | `git --version`                                         |
| Code editor   | VS Code with ESLint, Prettier and Prisma extensions | `code --version`                                        |
| Web browser   | any modern browser                                  |                                                         |

Why Node 22.18+: Prisma 7 generates its client as TypeScript files, and Node's built-in type stripping (on by default from 22.18 / 23.6) lets this JavaScript project import them without a build step.

On Ubuntu (including WSL), follow [`ubuntu-web-development-setup-guide.pdf`](ubuntu-web-development-setup-guide.pdf). In short:

```bash
sudo apt update && sudo apt install -y curl wget git build-essential ca-certificates gnupg unzip software-properties-common
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 24 && nvm alias default 24
sudo apt install -y postgresql
```

On Ubuntu 26.04 the PostgreSQL "contrib" extensions ship inside the `postgresql-18` package; there is no separate `postgresql-contrib` package. The state of the development machine this project was built on is recorded in [WSL-ENVIRONMENT-SETUP.md](WSL-ENVIRONMENT-SETUP.md).

---

## C. Project installation

```bash
git clone <your-repository-url> student-attendance-system
cd student-attendance-system

# root tools (concurrently, prettier), then the server and the client
npm run install:all
```

`npm run install:all` is the same as:

```bash
npm install
npm install --prefix server   # also runs "prisma generate" (postinstall)
npm install --prefix client
```

npm 11 asks for approval before dependencies run install scripts. The approvals this project needs are already recorded in `server/package.json` (`allowScripts`): Prisma's engine download is allowed; bcrypt's source rebuild is not needed because bcrypt ships prebuilt binaries.

Project layout:

```text
student-attendance-system/
├── client/                 React + Vite app (src/components, pages, routes, context, hooks, services, styles)
├── server/                 Express API
│   ├── prisma.config.js    Prisma CLI config (schema, migrations, seed, DATABASE_URL)
│   ├── src/
│   │   ├── app.js          Express app (middleware order)
│   │   ├── server.js       starts the HTTP server, graceful shutdown
│   │   ├── config/         env validation, session config
│   │   ├── routes/ controllers/ services/ middleware/ exports/ utils/
│   │   └── db/             schema.prisma, migrations/, seed.js, createAdmin.js, client.js, catalog/
│   └── tests/              unit/ and api/
├── scripts/setup-local-db.sh
└── docs/
```

---

## D. Database setup

### 1. Create the role and databases

The application uses its own PostgreSQL role and two databases: `attendance_db` (development) and `attendance_test_db` (automated tests - wiped on every test run).

**Option A - script (recommended).** First create `server/.env` (section E) with your chosen password in `DATABASE_URL` and `TEST_DATABASE_URL` (letters, digits and `_` only), then:

```bash
sudo bash scripts/setup-local-db.sh
```

It creates (or updates) the role with `LOGIN CREATEDB` - `CREATEDB` lets `prisma migrate dev` create its temporary shadow database - and both databases. It is safe to re-run.

**Option B - by hand:**

```bash
sudo -u postgres psql
```

```sql
CREATE USER attendance_user WITH PASSWORD 'choose_a_strong_password' CREATEDB;
CREATE DATABASE attendance_db OWNER attendance_user;
CREATE DATABASE attendance_test_db OWNER attendance_user;
\q
```

Test the connection:

```bash
psql -h localhost -U attendance_user -d attendance_db -c 'select current_user;'
```

### 2. Apply migrations

```bash
cd server
npm run db:deploy        # applies src/db/migrations/* (creates all tables and constraints)
```

During development, after changing `src/db/schema.prisma`, use `npm run db:migrate` instead (creates a new migration).

### 3. Seed development data

```bash
npm run db:seed
```

This imports the full SCIT catalog, creates semesters around today's date and the development accounts listed in [section G](#g-authentication-setup). It is safe to run repeatedly.

### 4. Inspect the data

```bash
npm run db:studio                                     # Prisma Studio at http://localhost:5555
set -a && . ./.env && set +a && psql "$DATABASE_URL"  # psql: \dt, \d attendance, SELECT ...
```

### 5. Reset the development database

```bash
npm run db:reset     # drops all data in DATABASE_URL, re-applies migrations, re-seeds
```

See [DATABASE-GUIDE.md](DATABASE-GUIDE.md) for every table, key and constraint.

---

## E. Environment configuration

Both apps read `.env` files that are **never committed** (`.gitignore` excludes them). Start from the examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### `server/.env`

| Variable                                        | Required  | Example / default                                                         | Purpose                                                                            |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NODE_ENV`                                      |           | `development`                                                             | `development`, `test` or `production`                                              |
| `PORT`                                          |           | `5000`                                                                    | HTTP port                                                                          |
| `DATABASE_URL`                                  | ✓         | `postgresql://attendance_user:PASSWORD@localhost:5432/attendance_db`      | App database                                                                       |
| `TEST_DATABASE_URL`                             | for tests | `postgresql://attendance_user:PASSWORD@localhost:5432/attendance_test_db` | Separate test database                                                             |
| `SESSION_SECRET`                                | ✓         | 48+ random bytes                                                          | Signs the session cookie                                                           |
| `CLIENT_URL`                                    |           | `http://localhost:5173`                                                   | Allowed browser origin(s), comma-separated; used by CORS and the CSRF origin check |
| `APP_TIMEZONE`                                  |           | `America/Jamaica`                                                         | "Today" and date filters                                                           |
| `SESSION_MAX_AGE_HOURS`                         |           | `8`                                                                       | Login lifetime (extended while active)                                             |
| `TRUST_PROXY`                                   |           | `0`                                                                       | Set `1` behind a reverse proxy that terminates HTTPS                               |
| `SERVE_CLIENT`                                  |           | `false`                                                                   | `true` makes Express also serve `client/dist`                                      |
| `BCRYPT_ROUNDS`                                 |           | `12`                                                                      | Password hashing cost                                                              |
| `RATE_LIMIT_*`                                  |           | see `.env.example`                                                        | Rate-limit tuning                                                                  |
| `SEED_ADMIN_PASSWORD`, `SEED_LECTURER_PASSWORD` |           |                                                                           | Override development seed passwords                                                |

Generate a session secret:

```bash
openssl rand -hex 48
```

The server validates its environment at start-up and exits with a clear list of problems if something is missing.

### `client/.env`

| Variable       | Default | Purpose                                                                                                                      |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | `/api`  | Base URL of the API. `http://localhost:5000/api` in development. Leave unset when Express serves the frontend (same origin). |

If `VITE_API_URL` is unset during development, the Vite dev server proxies `/api` to `http://localhost:5000`, so either setup works.

### CORS and origins

The browser origin of the React app must be listed in `CLIENT_URL` - exactly, including scheme and port. In development use `http://localhost:5173` (not `127.0.0.1:5173`, which is a different origin). In production, set it to the public HTTPS URL, e.g. `https://attendance.example.edu`.

### Development vs production

|                      | Development             | Production                                                   |
| -------------------- | ----------------------- | ------------------------------------------------------------ |
| `NODE_ENV`           | `development`           | `production`                                                 |
| Cookie `Secure` flag | off (HTTP)              | on (HTTPS required)                                          |
| Frontend             | Vite dev server on 5173 | built files, usually served by Express (`SERVE_CLIENT=true`) |
| Seed                 | `npm run db:seed`       | not used; `npm run create-admin`                             |

---

## F. Running locally

From the project root, start both apps together:

```bash
npm run dev
```

Or in two terminals:

```bash
cd server && npm run dev      # Express API with auto-restart (nodemon) → http://localhost:5000
```

```bash
cd client && npm run dev      # React app → http://localhost:5173
```

| URL                                  | What                   |
| ------------------------------------ | ---------------------- |
| http://localhost:5173                | Student check-in kiosk |
| http://localhost:5173/register       | Student registration   |
| http://localhost:5173/lecturer/login | Lecturer sign-in       |
| http://localhost:5173/admin/login    | Administrator sign-in  |
| http://localhost:5000/api/health     | API health check       |

### Verify frontend ↔ backend communication

```bash
curl http://localhost:5000/api/health          # {"success":true,"data":{"status":"ok"}}
curl http://localhost:5173/api/semesters/current   # same API through the Vite proxy
```

Then open http://localhost:5173/register - the programme list is loaded from the API. In the browser's DevTools **Network** tab you should see `GET …/api/auth/session` and `GET …/api/programs` returning `200`.

---

## G. Authentication setup

### Two separate login systems

|                  | Lecturers                                                 | Administrators                                                                  |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Page             | `/lecturer/login`                                         | `/admin/login`                                                                  |
| API              | `POST /api/auth/lecturer/login`                           | `POST /api/auth/admin/login`                                                    |
| Accepts          | `LECTURER` accounts only                                  | `ADMIN` accounts only                                                           |
| Account creation | self-registration at `/lecturer/register`, or by an admin | seed, `npm run create-admin`, or an existing admin - **no public registration** |

Both share the `users` table. Each login verifies the password with bcrypt, then checks the role: an administrator using the lecturer login (or vice versa) is refused with "… cannot sign in here" and no session is created.

### Development credentials (from `npm run db:seed`) - development only

| Role             | Email / work ID                            | Password         |
| ---------------- | ------------------------------------------ | ---------------- |
| Administrator    | `admin@example.com` / `ADMIN001`           | `Admin@12345`    |
| Lecturer         | `lecturer1@example.com` / `LEC001`         | `Lecturer@12345` |
| Lecturer         | `lecturer2@example.com` / `LEC002`         | `Lecturer@12345` |
| Students (kiosk) | `2600001`, `2600002`, `2600003`, `2600004` | -                |

**These are for local development only.** To change them, set `SEED_ADMIN_PASSWORD` / `SEED_LECTURER_PASSWORD` before seeding, or sign in and change them in **Admin → Lecturers** (password reset). Never seed these accounts into production - the seed refuses to run with `NODE_ENV=production` unless `SEED_ADMIN_PASSWORD` is set.

### Creating a real administrator

```bash
cd server
npm run create-admin -- --email you@example.edu --work-id ADM100 --first Pat --last Lee
# prompts for the password (hidden); or set ADMIN_PASSWORD=... in the environment
```

After that, administrators can add further administrators in **Admin → Administrators**.

### Lecturer registration

`/lecturer/register` - step 1: name, email, work ID, password (8–72 characters with a letter and a number); step 2: one or more SCIT programmes, then the courses they teach this semester. The account is created with the `LECTURER` role and course assignments for the current semester.

### Sessions, logout and access control

- After login the server stores `{ id, role }` in a PostgreSQL-backed session and sends an HTTP-only `sams.sid` cookie. The session ID is regenerated at login.
- Sessions survive server restarts and expire after `SESSION_MAX_AGE_HOURS` of inactivity.
- **Logout** destroys the session row and clears the cookie - an old cookie cannot be reused.
- Every protected API request reloads the user from the database and checks the role; lecturer operations also check **ownership** (assigned course, own session). The React route guards only improve the user experience - the API enforces everything on its own.
- State-changing requests need the CSRF token returned at login (`X-CSRF-Token` header) and must come from an allowed origin.

---

## H. Testing

```bash
npm test                         # from the root: all 175 server tests
cd server && npm run test:unit   # unit tests only (no database)
cd server && npm run test:api    # API tests against TEST_DATABASE_URL
npm run lint                     # ESLint for server and client
npm run build                    # proves the frontend compiles
```

Tests need PostgreSQL running and `TEST_DATABASE_URL` set to a separate database. Results show `✓`/`×` per test and a summary such as `Tests 175 passed (175)`. [TESTING-GUIDE.md](TESTING-GUIDE.md) explains every suite, how to read failures, a manual test checklist, and how to add tests.

---

## I. Production build

1. **Build the frontend** (from the project root):

   ```bash
   npm run build             # → client/dist (static HTML/JS/CSS)
   ```

   Leave `VITE_API_URL` unset (or `/api`) when Express will serve the frontend from the same origin. If the frontend is hosted on a different origin, build with `VITE_API_URL=https://api.example.edu/api npm run build` and add that frontend origin to `CLIENT_URL`.

2. **Prepare the backend:** install dependencies (`npm ci --prefix server`), which also generates the Prisma client.

3. **Production environment variables** (`server/.env` or the host's environment): `NODE_ENV=production`, `DATABASE_URL` (production database), a new `SESSION_SECRET`, `CLIENT_URL=https://your-domain`, `TRUST_PROXY=1` behind a reverse proxy, `SERVE_CLIENT=true` to serve the built frontend.

4. **Apply migrations** to the production database: `npm run db:deploy --prefix server`.

5. **Persistent sessions** are automatic - they are stored in the `session` table created by the migrations. Nothing else to configure; there is no in-memory session store.

6. **Start:** `npm start --prefix server` (runs `node src/server.js`).

---

## J. Traditional Express hosting

The backend is a conventional, continuously running Node.js process (not serverless). Any host that can run a long-lived Node.js process and reach a PostgreSQL database works: a Linux VM, a dedicated server, or a container platform. PostgreSQL should be a separate, managed or self-hosted database server.

### 1. Prepare the production environment

- A Linux server with Node.js 24 LTS (via nvm or your distribution's packages), Git and a firewall that exposes only ports 80/443.
- A non-root user to run the app, e.g. `attendance`.

### 2. Set up PostgreSQL

Create a role and database on the database server (as in [section D](#d-database-setup), without `CREATEDB` - production only needs `migrate deploy`). Use a strong password and restrict network access to the application server. Enable automated backups.

### 3. Configure environment variables

```env
NODE_ENV=production
PORT=5000
DATABASE_URL="postgresql://attendance_user:STRONG_PASSWORD@db.internal:5432/attendance_db"
SESSION_SECRET=<openssl rand -hex 48>
CLIENT_URL=https://attendance.example.edu
TRUST_PROXY=1
SERVE_CLIENT=true
```

Keep the file readable only by the app user (`chmod 600 server/.env`) or use the host's secret store.

### 4. Install production dependencies and build

```bash
git clone <repo> /srv/attendance && cd /srv/attendance
npm ci --prefix server        # installs and generates the Prisma client
npm ci --prefix client && npm run build --prefix client
```

The Prisma CLI is a development dependency and is needed for the next step. Afterwards you may run `npm prune --omit=dev --prefix server`; the generated client in `server/src/generated` stays.

### 5. Run database migrations

```bash
npm run db:deploy --prefix server
cd server && npm run create-admin -- --email admin@your-domain --work-id ADM001 --first First --last Last
```

### 6. Start the Express server under a process manager

Example `systemd` unit, `/etc/systemd/system/attendance.service`:

```ini
[Unit]
Description=Student Attendance Management System API
After=network.target

[Service]
Type=simple
User=attendance
WorkingDirectory=/srv/attendance/server
ExecStart=/usr/bin/env node src/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

(If Node comes from nvm, put the absolute path to that `node` binary in `ExecStart`.)

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now attendance
sudo systemctl status attendance
```

The server checks the database connection at start-up, and on `SIGTERM`/`SIGINT` stops accepting connections, finishes in-flight requests and closes database connections (graceful shutdown).

### 7. HTTPS and reverse proxy

Put a reverse proxy in front of Express to terminate HTTPS (required: session cookies are `Secure` in production). Example nginx server block (certificates via your CA or Let's Encrypt):

```nginx
server {
    listen 443 ssl;
    server_name attendance.example.edu;
    ssl_certificate     /etc/ssl/certs/attendance.pem;
    ssl_certificate_key /etc/ssl/private/attendance.key;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 80;
    server_name attendance.example.edu;
    return 301 https://$host$request_uri;
}
```

`TRUST_PROXY=1` lets Express trust `X-Forwarded-Proto`/`X-Forwarded-For`, so secure cookies and per-IP rate limits work behind the proxy.

### 8. Persistent sessions

Sessions live in PostgreSQL, so restarts and redeploys do not sign users out, and you can run more than one process. If you do run several processes, also replace express-rate-limit's in-memory store with a shared store (rate limits are currently per process).

### 9. Logs and monitoring

The server logs to stdout/stderr: start-up, shutdown and unexpected errors (with stack traces; clients only see a generic message). Under systemd read them with `journalctl -u attendance -f`. Monitor `GET /api/health` with your uptime checker, and watch PostgreSQL disk usage and backups.

### 10. Verify the deployment

```bash
curl https://attendance.example.edu/api/health
```

Then in a browser: the kiosk loads at `/`, `/register` lists programmes, an admin can sign in at `/admin/login` and sees the current semester, a lecturer can sign in, open a session, a student can check in, and the lecturer can download Excel and PDF reports. Check the response headers include `Strict-Transport-Security` and the cookie has `Secure; HttpOnly; SameSite=Lax`.

---

## K. Troubleshooting

| Problem                                                                      | Check / fix                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Could not connect to PostgreSQL` at start-up                                | `sudo systemctl status postgresql`; the host/port/database in `DATABASE_URL`; test with `psql "$DATABASE_URL" -c 'select 1'`                                                                                                              |
| `password authentication failed` / `role … does not exist`                   | Run `sudo bash scripts/setup-local-db.sh` (it reads the password from `server/.env`); the PostgreSQL log `/var/log/postgresql/postgresql-18-main.log` shows the exact reason                                                              |
| `Invalid environment configuration` on start                                 | The listed variables are missing or invalid in `server/.env` (e.g. `SESSION_SECRET` shorter than 32 characters)                                                                                                                           |
| `EADDRINUSE` / port already in use                                           | Another process uses 5000 or 5173: `lsof -i :5000`, stop it, or change `PORT` (and `VITE_API_URL`)                                                                                                                                        |
| `npm install` fails or hangs                                                 | Check Node with `node --version` (≥ 22.18), clear with `rm -rf node_modules package-lock.json && npm install`, check network/proxy settings. If Prisma reports a missing engine, run `npm rebuild prisma @prisma/engines --prefix server` |
| `Cannot find module …/generated/prisma/client.ts`                            | Run `npm run db:generate --prefix server`                                                                                                                                                                                                 |
| `Cannot reach the server` in the UI / API connection failures                | Is the API running on the port in `VITE_API_URL`? Try `curl http://localhost:5000/api/health`                                                                                                                                             |
| CORS error in the browser console                                            | The page's exact origin must be in `CLIENT_URL` (e.g. `http://localhost:5173`, not `http://127.0.0.1:5173`); restart the API after changing `.env`                                                                                        |
| `403 ORIGIN_NOT_ALLOWED`                                                     | Same cause as CORS: the request's `Origin` is not in `CLIENT_URL`                                                                                                                                                                         |
| Logged in but every action says "security token is missing" (`CSRF_INVALID`) | Refresh the page (the token is re-read from `/api/auth/session`); make sure the app and API agree on cookies (same site, `credentials: 'include'`)                                                                                        |
| Session cookie not kept / logged out on refresh                              | In production the cookie is `Secure`: you must use HTTPS and set `TRUST_PROXY=1` behind a proxy. In development use `localhost` for both apps                                                                                             |
| `prisma migrate` fails                                                       | Check `DATABASE_URL`; for `migrate dev` the role needs `CREATEDB` (shadow database). `npx prisma migrate status` shows which migrations ran. Never edit applied migrations - add a new one                                                |
| `401 INVALID_CREDENTIALS`                                                    | Wrong email/work ID or password - or the account doesn't exist (run `npm run db:seed` in development)                                                                                                                                     |
| `403 WRONG_LOGIN_PORTAL`                                                     | Admins must use `/admin/login`, lecturers `/lecturer/login`                                                                                                                                                                               |
| `403 WRONG_ROLE` / redirected to another dashboard                           | You are signed in with the other role; sign out first                                                                                                                                                                                     |
| `403 NOT_YOUR_COURSE`                                                        | The course is not assigned to this lecturer for that semester - an admin can assign it                                                                                                                                                    |
| Kiosk says "Already checked in" / API returns `409 ALREADY_CHECKED_IN`       | Working as intended: one check-in per student per session (database constraint `unique_session_student`)                                                                                                                                  |
| "No active semester" everywhere                                              | No semester covers today's date: add one in **Admin → Semesters**                                                                                                                                                                         |
| Times look 5 hours off                                                       | `APP_TIMEZONE` controls displayed dates; database connections always use UTC by design                                                                                                                                                    |

---

## L. Project maintenance

- **Add a module:** Admin → Modules → _Add module_, then Admin → Programmes & modules → choose the programme → _Add module to programme_ (level, semester slot, either/or group). For bulk changes from new diet sheets, update `server/src/db/catalog/scit-catalog.json`, run `npm run db:check-catalog` and `npm run db:import-catalog` (see [DIET-SHEET-IMPORT.md](DIET-SHEET-IMPORT.md)).
- **Add a programme:** Admin → Programmes & modules → _Add programme_, then add its modules.
- **Create a new semester:** Admin → Semesters → _Add semester_ (academic year, term, start and end dates - ranges must not overlap). Do this before each semester starts.
- **Manage lecturer assignments:** Admin → Lecturers & courses → _Manage_ → _Assign a course_ (pick semester and module). Lecturers can also pick their courses when they register.
- **Update database migrations:** edit `server/src/db/schema.prisma`, run `cd server && npm run db:migrate -- --name what_changed`, review the SQL in `src/db/migrations/`, run the tests, commit the migration folder; deploy with `npm run db:deploy`.
- **Before committing:** `npm run lint && npm test && npm run build` from the project root (and `npm run format` to apply Prettier).
