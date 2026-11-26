// Semester rules.
//
// - The current semester is the one whose [start_date, end_date] range
//   contains today's date (in APP_TIMEZONE). Semester dates come from the
//   `semesters` table that administrators maintain - not from hardcoded months.
// - A programme module is available in a semester when its slot matches the
//   semester's term: slot 1 -> term 1, slot 2 -> term 2, and YEAR (year-long)
//   or EITHER modules are available in both terms.
import { prisma } from '../db/client.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { dateInTimezone, fromDateOnly, toDateOnly } from '../utils/dates.js';

/** Replaceable clock so tests can pretend "today" is any date. */
export const clock = { now: () => new Date() };

export function todayString() {
  return dateInTimezone(clock.now(), config.timezone);
}

/** Semester slots whose modules are offered in the given term (1 or 2). */
export function slotsForTerm(term) {
  if (term === 1) return ['SEM1', 'YEAR', 'EITHER'];
  if (term === 2) return ['SEM2', 'YEAR', 'EITHER'];
  return [];
}

export function isSlotAvailableInTerm(slot, term) {
  return slotsForTerm(term).includes(slot);
}

/**
 * Pure helper: pick the semester whose date range contains `today`
 * ('YYYY-MM-DD'). Dates may be Date objects (from Prisma) or strings.
 */
export function findCurrentSemester(semesters, today) {
  return (
    semesters.find((s) => toDateOnly(s.startDate) <= today && today <= toDateOnly(s.endDate)) ?? null
  );
}

/** The semester containing today's date, or null between semesters. */
export async function getCurrentSemester() {
  const today = fromDateOnly(todayString());
  return prisma.semester.findFirst({
    where: { startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: 'desc' },
  });
}

/** Like getCurrentSemester, but fails with a clear message when there is none. */
export async function requireCurrentSemester() {
  const semester = await getCurrentSemester();
  if (!semester) {
    throw AppError.conflict(
      'There is no active semester today. An administrator must set up the semester dates first.',
      'NO_ACTIVE_SEMESTER',
    );
  }
  return semester;
}

/** Shape a semester row for API responses. */
export function serializeSemester(semester) {
  if (!semester) return null;
  return {
    id: semester.id,
    academicYear: semester.academicYear,
    term: semester.term,
    startDate: toDateOnly(semester.startDate),
    endDate: toDateOnly(semester.endDate),
    label: `${semester.academicYear} Semester ${semester.term}`,
  };
}
