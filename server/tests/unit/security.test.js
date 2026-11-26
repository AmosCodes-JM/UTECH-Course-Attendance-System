// Password hashing and input validation rules.
import { describe, expect, it } from 'vitest';
import { hashPassword, serializeUser, verifyPassword } from '../../src/services/authService.js';
import { email, password, studentIdNumber, workId } from '../../src/utils/validators.js';

describe('password hashing (bcrypt)', () => {
  it('never stores the plain password and verifies correctly', async () => {
    const hash = await hashPassword('Secret123');
    expect(hash).not.toContain('Secret123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword('Secret123', hash)).toBe(true);
    expect(await verifyPassword('secret123', hash)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    expect(await hashPassword('Secret123')).not.toBe(await hashPassword('Secret123'));
  });

  it('never exposes the password hash in API user objects', () => {
    const shaped = serializeUser({
      id: 1,
      workId: 'L1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.c',
      role: 'LECTURER',
      passwordHash: 'x',
    });
    expect(shaped).not.toHaveProperty('passwordHash');
  });
});

describe('request validation rules', () => {
  it('normalises emails and rejects invalid ones', () => {
    expect(email.parse('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
    expect(email.safeParse('not-an-email').success).toBe(false);
  });

  it('requires reasonably strong passwords within the bcrypt limit', () => {
    expect(password.safeParse('short1').success).toBe(false);
    expect(password.safeParse('lettersonly').success).toBe(false);
    expect(password.safeParse('a1'.repeat(37)).success).toBe(false); // 74 chars
    expect(password.safeParse('GoodPass123').success).toBe(true);
  });

  it('upper-cases IDs and rejects SQL-looking input', () => {
    expect(studentIdNumber.parse(' ab1234 ')).toBe('AB1234');
    expect(workId.parse('lec001')).toBe('LEC001');
    expect(studentIdNumber.safeParse("1' OR '1'='1").success).toBe(false);
  });
});
