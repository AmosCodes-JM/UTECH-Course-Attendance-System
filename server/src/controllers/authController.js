// Lecturer and administrator authentication. The two login systems share
// this code but are exposed through separate endpoints, each locked to one role.
import { prisma } from '../db/client.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../config/session.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { authenticate, serializeUser } from '../services/authService.js';

const HOME = { LECTURER: '/lecturer', ADMIN: '/admin' };
const LOGIN_PAGE = { LECTURER: '/lecturer/login', ADMIN: '/admin/login' };

/** Replace any existing session with a fresh one (new ID) for `user`. */
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    // Regenerating the session ID on login prevents session-fixation attacks.
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = { id: user.id, role: user.role };
      const csrfToken = issueCsrfToken(req);
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve(csrfToken)));
    });
  });
}

function endSession(req, res) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
      resolve();
    });
  });
}

/** POST /api/auth/lecturer/login and POST /api/auth/admin/login */
export function login(role) {
  return async function loginHandler(req, res) {
    const { identifier, password } = req.validated.body;
    const user = await authenticate(identifier, password, role);
    const csrfToken = await startSession(req, user);
    res.json({ success: true, data: { user: serializeUser(user), csrfToken, redirectTo: HOME[role] } });
  };
}

/** POST /api/auth/lecturer/logout and POST /api/auth/admin/logout */
export function logout(role) {
  return async function logoutHandler(req, res) {
    await endSession(req, res);
    res.json({ success: true, data: { redirectTo: LOGIN_PAGE[role] } });
  };
}

/** GET /api/auth/lecturer/me and GET /api/auth/admin/me */
export function me(req, res) {
  const csrfToken = req.session.csrfToken ?? issueCsrfToken(req);
  res.json({ success: true, data: { user: serializeUser(req.user), csrfToken } });
}

/**
 * GET /api/auth/session - public. Tells the React app whether someone is
 * signed in and with which role, so it can send them to the right dashboard.
 */
export async function sessionStatus(req, res) {
  const sessionUser = req.session?.user;
  const user = sessionUser ? await prisma.user.findUnique({ where: { id: sessionUser.id } }) : null;

  if (!user || user.role !== sessionUser.role) {
    if (sessionUser) await endSession(req, res);
    return res.json({ success: true, data: { authenticated: false, user: null, csrfToken: null } });
  }

  const csrfToken = req.session.csrfToken ?? issueCsrfToken(req);
  res.json({ success: true, data: { authenticated: true, user: serializeUser(user), csrfToken } });
}
