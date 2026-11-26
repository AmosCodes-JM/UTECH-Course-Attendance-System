// Lecturer routes:
//   POST  /api/lecturers                 public two-step registration
//   GET   /api/lecturer/courses          the signed-in lecturer's courses
//   POST  /api/class-sessions            open a session
//   PATCH /api/class-sessions/:id/close  close a session
import { Router } from 'express';
import { z } from 'zod';
import * as lecturers from '../controllers/lecturerController.js';
import { requireLecturer } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireSessionOwnership } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import { email, idList, idParam, password, personName, workId } from '../utils/validators.js';

const registerBody = z.strictObject({
  firstName: personName,
  lastName: personName,
  email,
  workId,
  password,
  programIds: idList('programme', { max: 20 }),
  moduleIds: idList('course', { max: 40 }),
});

export function createLecturerRegistrationRouter(limiters) {
  const router = Router();
  router.post('/', limiters.register, validate({ body: registerBody }), lecturers.register);
  return router;
}

export function createLecturerRouter() {
  const router = Router();
  router.get(
    '/courses',
    requireLecturer,
    validate({ query: z.object({ scope: z.enum(['current', 'all']).default('current') }) }),
    lecturers.courses,
  );
  return router;
}

export function createClassSessionRouter() {
  const router = Router();
  router.use(requireLecturer, requireCsrf);
  router.post('/', validate({ body: z.strictObject({ moduleId: idParam }) }), lecturers.open);
  router.patch('/:id/close', validate({ params: z.object({ id: idParam }) }), requireSessionOwnership, lecturers.close);
  return router;
}
