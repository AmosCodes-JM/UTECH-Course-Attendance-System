// Cross-Site Request Forgery (CSRF) protection.
//
// Two layers:
// 1. verifyOrigin - browsers always send an Origin header on cross-site
//    POST/PUT/PATCH/DELETE requests. If it is present and is not one of our
//    configured frontend origins, the request is refused.
// 2. requireCsrf - for cookie-authenticated (lecturer/admin) state-changing
//    requests we also require a secret token (synchronizer token pattern).
//    The token is created at login, stored in the server-side session, given
//    to the React app in the login / "me" responses, and must be sent back in
//    the X-CSRF-Token header. Another site cannot read it, so it cannot forge
//    the request even though the browser would attach the session cookie.
import crypto from 'node:crypto';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrfToken(req) {
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function tokensMatch(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!tokensMatch(req.session?.csrfToken, req.get('x-csrf-token'))) {
    throw AppError.forbidden('Your security token is missing or expired. Refresh the page and try again.', 'CSRF_INVALID');
  }
  next();
}

export function verifyOrigin(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return function checkOrigin(req, _res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowed.has(origin)) {
      throw AppError.forbidden('Requests from this website are not allowed.', 'ORIGIN_NOT_ALLOWED');
    }
    next();
  };
}
