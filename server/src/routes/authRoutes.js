// /api/auth - two separate login systems (lecturer and administrator).
import { Router } from 'express';
import { z } from 'zod';
import * as auth from '../controllers/authController.js';
import { requireAdmin, requireLecturer } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { validate } from '../middleware/validate.js';
import { loginIdentifier } from '../utils/validators.js';

const loginBody = z.strictObject({
  identifier: loginIdentifier,
  password: z.string({ error: 'Required' }).min(1, 'Enter your password').max(200),
});

export function createAuthRouter(limiters) {
  const router = Router();

  // Public: who is signed in (if anyone)?
  router.get('/session', auth.sessionStatus);

  // Lecturer login system - only LECTURER accounts can sign in here.
  router.post('/lecturer/login', limiters.login, validate({ body: loginBody }), auth.login('LECTURER'));
  router.post('/lecturer/logout', requireLecturer, requireCsrf, auth.logout('LECTURER'));
  router.get('/lecturer/me', requireLecturer, auth.me);

  // Administrator login system - only ADMIN accounts can sign in here.
  router.post('/admin/login', limiters.login, validate({ body: loginBody }), auth.login('ADMIN'));
  router.post('/admin/logout', requireAdmin, requireCsrf, auth.logout('ADMIN'));
  router.get('/admin/me', requireAdmin, auth.me);

  return router;
}
