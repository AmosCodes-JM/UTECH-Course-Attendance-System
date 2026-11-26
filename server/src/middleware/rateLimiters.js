// Rate limiting for the public endpoints (check-in, registration, logins).
//
// Limits are per client IP and configurable through environment variables
// (see config/env.js). Check-in limits are deliberately generous: a classroom
// kiosk - or many phones behind one campus NAT - share a single IP address.
//
// The default in-memory store is fine for a single Express process. If you
// run several processes behind a load balancer, switch to a shared store.
import { rateLimit } from 'express-rate-limit';

function createLimiter({ max, windowMs }, message, extra = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message, code: 'RATE_LIMITED' });
    },
    ...extra,
  });
}

export function createRateLimiters(limits) {
  return {
    checkIn: createLimiter(limits.checkIn, 'Too many check-in attempts. Please wait a moment and try again.'),
    register: createLimiter(limits.register, 'Too many registration attempts. Please try again later.'),
    // Only failed logins count towards the limit.
    login: createLimiter(limits.login, 'Too many failed sign-in attempts. Please wait and try again.', {
      skipSuccessfulRequests: true,
    }),
  };
}
