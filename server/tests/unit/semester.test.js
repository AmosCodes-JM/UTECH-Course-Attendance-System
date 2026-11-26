// Business rules: current-semester determination and module availability.
import { describe, expect, it } from 'vitest';
import { findCurrentSemester, isSlotAvailableInTerm, slotsForTerm } from '../../src/services/semesterService.js';
import { dayRangeUtc, isValidDateString } from '../../src/utils/dates.js';

const semesters = [
  { id: 1, academicYear: '2026/2027', term: 1, startDate: '2026-09-01', endDate: '2026-12-31' },
  { id: 2, academicYear: '2026/2027', term: 2, startDate: '2027-01-01', endDate: '2027-05-31' },
  // Prisma returns DATE columns as Date objects - both forms must work.
  {
    id: 3,
    academicYear: '2027/2028',
    term: 1,
    startDate: new Date('2027-09-01T00:00:00Z'),
    endDate: new Date('2027-12-31T00:00:00Z'),
  },
];

describe('current semester determination', () => {
  it('picks the semester whose date range contains today', () => {
    expect(findCurrentSemester(semesters, '2026-11-25').id).toBe(1);
    expect(findCurrentSemester(semesters, '2027-03-10').id).toBe(2);
    expect(findCurrentSemester(semesters, '2027-10-01').id).toBe(3);
  });

  it('includes the first and last day of a semester', () => {
    expect(findCurrentSemester(semesters, '2026-09-01').id).toBe(1);
    expect(findCurrentSemester(semesters, '2027-05-31').id).toBe(2);
  });

  it('returns null between semesters (June to August)', () => {
    expect(findCurrentSemester(semesters, '2027-07-15')).toBeNull();
  });

  it('uses the configured date ranges, not hardcoded months', () => {
    const custom = [{ id: 9, term: 2, startDate: '2027-01-12', endDate: '2027-04-30' }];
    expect(findCurrentSemester(custom, '2027-01-05')).toBeNull();
    expect(findCurrentSemester(custom, '2027-01-12').id).toBe(9);
    expect(findCurrentSemester(custom, '2027-05-15')).toBeNull();
  });
});

describe('semester slot availability', () => {
  it('offers semester-1 modules only in term 1 and semester-2 modules only in term 2', () => {
    expect(isSlotAvailableInTerm('SEM1', 1)).toBe(true);
    expect(isSlotAvailableInTerm('SEM1', 2)).toBe(false);
    expect(isSlotAvailableInTerm('SEM2', 2)).toBe(true);
    expect(isSlotAvailableInTerm('SEM2', 1)).toBe(false);
  });

  it('offers year-long (YEAR) modules such as PRJ4020 in both semesters', () => {
    expect(isSlotAvailableInTerm('YEAR', 1)).toBe(true);
    expect(isSlotAvailableInTerm('YEAR', 2)).toBe(true);
  });

  it('offers either-semester (EITHER) modules in both semesters', () => {
    expect(slotsForTerm(1)).toContain('EITHER');
    expect(slotsForTerm(2)).toContain('EITHER');
  });

  it('offers nothing for an unknown term', () => {
    expect(slotsForTerm(3)).toEqual([]);
  });
});

describe('date helpers', () => {
  it('validates real calendar dates only', () => {
    expect(isValidDateString('2026-11-25')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('25/11/2026')).toBe(false);
    expect(isValidDateString("2026-11-25' OR 1=1 --")).toBe(false);
  });

  it('turns a Jamaica calendar day into the matching UTC range (UTC-5)', () => {
    const { start, end } = dayRangeUtc('2026-11-25', 'America/Jamaica');
    expect(start.toISOString()).toBe('2026-11-25T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-26T05:00:00.000Z');
  });

  it('handles daylight-saving changes', () => {
    // New York switches to EDT on 2026-03-08, so that day is 23 hours long.
    const { start, end } = dayRangeUtc('2026-03-08', 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});
