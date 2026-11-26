// Reusable Zod field schemas. They also normalise input (trim, letter case),
// so "  Jane@Example.com " and "jane@example.com" are treated as the same email.
import { z } from 'zod';
import { isValidDateString } from './dates.js';

export const idParam = z.coerce.number({ error: 'Must be a number' }).int().positive('Must be a positive whole number');

export const idList = (label, { min = 1, max = 60 } = {}) =>
  z
    .array(idParam, { error: `${label} must be a list` })
    .min(min, min === 1 ? `Select at least one ${label}` : `Select at least ${min} ${label}`)
    .max(max, `Select at most ${max} ${label}`);

export const personName = z
  .string({ error: 'Required' })
  .trim()
  .min(1, 'Required')
  .max(100, 'Must be 100 characters or fewer')
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Use letters, spaces, apostrophes or hyphens only');

export const email = z
  .string({ error: 'Required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const studentIdNumber = z
  .string({ error: 'Required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,20}$/, 'Student ID must be 4–20 letters, digits or dashes');

export const workId = z
  .string({ error: 'Required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,20}$/, 'Work ID must be 3–20 letters, digits or dashes');

// bcrypt only uses the first 72 bytes of a password, so longer ones are refused.
export const password = z
  .string({ error: 'Required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain at least one letter and one number');

export const loginIdentifier = z
  .string({ error: 'Required' })
  .trim()
  .min(1, 'Enter your email or work ID')
  .max(254);

export const dateString = z
  .string()
  .refine(isValidDateString, 'Use a valid date in YYYY-MM-DD format');

export const moduleCode = z
  .string({ error: 'Required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}\d{3,4}$/, 'Module code looks like CIT2004 (letters then digits)');
