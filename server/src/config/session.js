// express-session configuration with a PostgreSQL-backed session store.
//
// Sessions live in the `session` table (created by the Prisma migrations), so
// logins survive server restarts and work with more than one server process.
// The browser only receives an opaque, HTTP-only cookie holding the session ID.
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './env.js';

export const SESSION_COOKIE_NAME = 'sams.sid';

export const sessionCookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read the cookie
  secure: config.isProduction, // HTTPS-only in production
  sameSite: 'lax', // not sent on cross-site POSTs (CSRF defence in depth)
  path: '/',
};

export function createSessionMiddleware(pool) {
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
    // Delete expired sessions every 15 minutes (disabled in tests so no timer
    // keeps the test process alive).
    pruneSessionInterval: config.isTest ? false : 15 * 60,
  });

  return session({
    name: SESSION_COOKIE_NAME,
    store,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false, // no session (or cookie) until someone logs in
    rolling: true, // each request extends the expiry while the user is active
    cookie: { ...sessionCookieOptions, maxAge: config.sessionMaxAgeMs },
  });
}
