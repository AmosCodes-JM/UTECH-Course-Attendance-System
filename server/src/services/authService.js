// Password hashing and role-specific login checks.
import bcrypt from 'bcrypt';
import { prisma } from '../db/client.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Used to spend the same bcrypt time when the account does not exist, so the
// response time does not reveal which emails / work IDs are registered.
let dummyHash;
function getDummyHash() {
  dummyHash ??= bcrypt.hashSync('not-a-real-password', config.bcryptRounds);
  return dummyHash;
}

export function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptRounds);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** Public shape of a user - never includes the password hash. */
export function serializeUser(user) {
  return {
    id: user.id,
    workId: user.workId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  };
}

/** Email addresses are stored lower-case and work IDs upper-case. */
function findByIdentifier(identifier) {
  const value = identifier.trim();
  return value.includes('@')
    ? prisma.user.findUnique({ where: { email: value.toLowerCase() } })
    : prisma.user.findUnique({ where: { workId: value.toUpperCase() } });
}

const WRONG_PORTAL = {
  LECTURER: 'Administrator accounts cannot sign in here. Please use the administrator login.',
  ADMIN: 'Lecturer accounts cannot sign in here. Please use the lecturer login.',
};

/**
 * Verify credentials for a specific login system. `requiredRole` is fixed by
 * the endpoint (/auth/lecturer/login -> LECTURER, /auth/admin/login -> ADMIN),
 * so one role can never sign in through the other role's login.
 */
export async function authenticate(identifier, password, requiredRole) {
  const user = await findByIdentifier(identifier);
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? getDummyHash());

  if (!user || !passwordOk) {
    throw AppError.unauthorized('Incorrect email/work ID or password.', 'INVALID_CREDENTIALS');
  }
  if (user.role !== requiredRole) {
    throw AppError.forbidden(WRONG_PORTAL[requiredRole], 'WRONG_LOGIN_PORTAL');
  }
  return user;
}
