-- Integrity rules that Prisma's schema language cannot express.
-- Written by hand; Prisma applies this file like any other migration.

-- -----------------------------------------------------------------------------
-- Attendance: one check-in per student per class session.
-- Prisma created this as a unique index; turn it into an explicit table
-- constraint so it shows up as
--   ALTER TABLE attendance ADD CONSTRAINT unique_session_student UNIQUE (session_id, student_id)
-- This is the final guard against duplicate attendance, even when two
-- requests arrive at exactly the same moment.
-- -----------------------------------------------------------------------------
ALTER TABLE "attendance"
  ADD CONSTRAINT "unique_session_student" UNIQUE USING INDEX "unique_session_student";

-- -----------------------------------------------------------------------------
-- Class sessions
-- -----------------------------------------------------------------------------
-- A lecturer can have at most ONE open session per module per semester
-- (stops a double-click from opening two sessions).
CREATE UNIQUE INDEX "one_open_session_per_lecturer_module"
  ON "class_sessions" ("lecturer_id", "module_id", "semester_id")
  WHERE "closed_at" IS NULL;

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_closed_after_opened"
  CHECK ("closed_at" IS NULL OR "closed_at" >= "opened_at");

-- -----------------------------------------------------------------------------
-- Semesters
-- -----------------------------------------------------------------------------
ALTER TABLE "semesters"
  ADD CONSTRAINT "semesters_term_check" CHECK ("term" IN (1, 2)),
  ADD CONSTRAINT "semesters_dates_check" CHECK ("end_date" > "start_date"),
  ADD CONSTRAINT "semesters_academic_year_format" CHECK ("academic_year" ~ '^[0-9]{4}/[0-9]{4}$');

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
ALTER TABLE "program_modules"
  ADD CONSTRAINT "program_modules_level_check" CHECK ("level" BETWEEN 1 AND 6);

ALTER TABLE "modules"
  ADD CONSTRAINT "modules_credits_check" CHECK ("credits" IS NULL OR "credits" >= 0);

-- -----------------------------------------------------------------------------
-- People: emails are stored in lower case so uniqueness is case-insensitive.
-- -----------------------------------------------------------------------------
ALTER TABLE "students"
  ADD CONSTRAINT "students_email_lowercase" CHECK ("email" = lower("email"));

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
