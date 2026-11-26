# Open Decisions

The project plan (v1) lists five questions that still need a decision. None of them blocked v1, so each has a documented working assumption below. A few further decisions came up while building and reading the diet sheets; they are listed after the original five.

Each entry gives the question, why it matters, what v1 does now, its limitations, and possible next steps.

---

## 1. Student enrollment process

**Question.** Are students enrolled by picking modules at registration, or does an administrator import enrollments?

**Why it matters.** Enrollments decide which courses a student can check in to. Self-selection is quick but relies on students choosing correctly; an import from the official student records system would be authoritative.

**Current implementation.** Students choose their modules during registration at `/register` (only modules their programme offers in the current semester are listed; either/or pairs are enforced). Administrators can add or remove any enrollment, for any semester, in **Admin → Students & enrollments**.

**Limitations.** Students only register once; for the following semester they need an administrator to add enrollments (there is no student self-service page for that yet). Self-declared enrollments are not checked against official records. There is no bulk import.

**Possible improvements.** A semester "re-enrol" step on the kiosk or a student self-service page; CSV import of enrollments from the registry; lecturer confirmation of class lists.

---

## 2. A lecturer forgets to close a session

**Question.** What happens if a lecturer leaves an attendance session open?

**Why it matters.** An open session keeps accepting check-ins, so a student could check in hours later (or from outside the room).

**Current implementation.** As the plan requires, **sessions never close automatically**. Only the lecturer who opened the session can close it. The lecturer dashboard highlights open sessions with a pulsing "Open since …" badge and a live count, and the admin overview shows the number of open sessions. A lecturer cannot open a second session for the same course while one is open, which makes a forgotten session visible the next time they try.

**Limitations.** A forgotten session stays open indefinitely. Administrators cannot close a lecturer's session from the UI (by design, sessions belong to their lecturer). Check-in times are recorded, so late check-ins are visible in reports but not blocked.

**Possible improvements.** Remind the lecturer (dashboard banner/email) after N hours; let admins close stale sessions; optionally flag check-ins made long after the session opened; a configurable maximum session length if the school decides on one.

---

## 3. Diet sheet import process

**Question.** How do the diet sheet PDFs become catalog data: manual entry, CSV import, or a script the admin reviews?

**Why it matters.** The catalog drives registration, lecturer course selection and the either/or rule. Errors in it propagate everywhere.

**Current implementation.** A reviewed import file plus admin screens:

- All 22 supplied PDFs were transcribed into [`server/src/db/catalog/scit-catalog.json`](../server/src/db/catalog/scit-catalog.json), with every source and interpretation recorded in [DIET-SHEET-IMPORT.md](DIET-SHEET-IMPORT.md).
- `npm run db:check-catalog` validates it and refuses unresolved credit conflicts; `npm run db:import-catalog` upserts it (never deletes).
- Administrators correct or extend anything in **Admin → Programmes & modules / Modules**.

**Limitations.** New diet sheets need someone to update the JSON (or enter changes in the admin screens); there is no automatic PDF parser - the sheets' layouts vary too much to parse reliably, and several contain misprints that need human judgement. Some modules have no credits on their sheet and are stored with empty credits. Game Design Years 3–4 are not on any supplied sheet.

**Possible improvements.** A CSV upload in the admin area using the same validation as `importCatalog.js`; asking SCIT for the catalog in a structured format; an "import preview" page that shows differences before applying them.

---

## 4. Courses between semesters (June to August)

**Question.** Which courses should appear between semesters?

**Why it matters.** The current semester is defined by date ranges; outside them there is no "current" semester, so nothing is offered.

**Current implementation.** No assumption is made about summer teaching. If no semester covers today:

- student registration and lecturer registration show "no active semester" and cannot be completed;
- lecturers see an empty dashboard and cannot open sessions;
- the admin overview warns that no semester is active.

Administrators can create a semester whose dates cover a summer period, but the `term` must be 1 or 2, so a summer course would have to be recorded as one of those terms.

**Limitations.** Summer school, re-sits or make-up classes cannot be modelled as their own term. Lecturers registering in summer have to wait (or be created by an admin).

**Possible improvements.** Add a summer term (e.g. `term = 3` with a matching semester slot) once SCIT confirms which modules run then; allow registration for the _upcoming_ semester during the break.

---

## 5. Student identity verification

**Question.** Student ID numbers are not secret - what stops one student checking in for another?

**Why it matters.** Attendance records are only as trustworthy as the check-in.

**Current implementation.** The kiosk shows the student's **name and programme** for confirmation before they choose a course, and the ID-number lookup is rate-limited. That makes honest mistakes visible, but it **does not verify identity**: anyone who knows another student's ID number can check them in, especially from a personal phone.

**Limitations.** Proxy check-ins ("buddy punching") are possible. The open-courses lookup reveals a student's name and programme to anyone who knows their ID number (email is never shown).

**Possible improvements (need approval before building).**

- Lecturer supervision: run the kiosk only on a lecturer-controlled device at the door, and/or show the live check-in list on the lecturer's screen so they can spot absent names.
- A short session code shown in the classroom (changes every minute) that must be entered with the ID.
- Restrict check-in to the campus network or to registered kiosk devices.
- Student accounts with a PIN or university single sign-on.
- Random spot-checks against a photo roster.

---

## Additional decisions made during the build

### 6. Elective and either-semester modules

**Question.** The plan allows semester slots `1`, `2` and `YEAR`. How should modules that the diet sheets say "can be completed in SEM1 or SEM2" (e.g. CSP1001), the CNS rule "any six of these Year 1 modules may be done in either semester", and elective pools with no semester be stored?

**Why it matters.** Marking them `YEAR` would wrongly call them year-long; forcing them into `1` or `2` would invent a semester the sheet does not give and stop students from registering when they actually take them.

**Current implementation.** A fourth slot value, `EITHER`, which behaves like `YEAR` for availability (offered in both semesters) but is labelled "Either semester". Elective pools are attached to the level where the sheet's elective slots appear.

**Limitations.** Elective modules appear in both semesters even if SCIT only runs them in one. An administrator can narrow any module to `1` or `2` in **Admin → Programmes & modules**.

### 7. Separate login pages (plan vs build instructions)

The project plan's page table had lecturers and admins sharing `/lecturer/login`. The build instructions require **separate** login pages and endpoints with role enforcement, so v1 has `/lecturer/login` + `POST /api/auth/lecturer/login` and `/admin/login` + `POST /api/auth/admin/login`. Each login refuses the other role (`403 WRONG_LOGIN_PORTAL`) without creating a session.

### 8. Public lecturer self-registration

**Why it matters.** Anyone can register as a lecturer and claim any course offered this semester, which would let them see that course's attendance (for sessions they open) - the plan specifies public lecturer registration.

**Current implementation.** As specified. Lecturers only ever see attendance for sessions **they** opened, never another lecturer's sessions, even for a shared module. Administrators can review lecturer accounts and remove assignments or accounts.

**Possible improvements.** Require administrator approval of new lecturer accounts (a `pending` status), or restrict registration to staff email domains.

### 9. Several lecturers teaching one module

Two lecturers may be assigned the same module (e.g. different groups). Each can open their own session; a student enrolled in the module sees each open session with the lecturer's name and picks theirs. A lecturer's attendance view and exports include only their own sessions.

### 10. Catalog interpretation

Where diet sheets disagree (credits, names) or contain misprints, the choices made are listed in [DIET-SHEET-IMPORT.md](DIET-SHEET-IMPORT.md#reconciliation-notes). These should be confirmed with SCIT.

### 11. Semester dates

The seed creates semesters on the standard calendar (1 Sep – 31 Dec and 1 Jan – 31 May). Official UTech dates were not supplied; administrators should enter them in **Admin → Semesters**.
