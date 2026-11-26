// /api/students - public student registration and check-in lookup.
import { Router } from 'express';
import { z } from 'zod';
import * as students from '../controllers/studentController.js';
import { validate } from '../middleware/validate.js';
import { email, idList, idParam, personName, studentIdNumber } from '../utils/validators.js';

// strictObject rejects unknown fields, so a client cannot sneak in extra
// columns (mass assignment) such as created_at or id.
const registerBody = z.strictObject({
  firstName: personName,
  lastName: personName,
  idNumber: studentIdNumber,
  email,
  programId: idParam,
  moduleIds: idList('module'),
});

export function createStudentRouter(limiters) {
  const router = Router();
  router.post('/', limiters.register, validate({ body: registerBody }), students.register);
  router.get(
    '/:idNumber/open-courses',
    limiters.checkIn,
    validate({ params: z.object({ idNumber: studentIdNumber }) }),
    students.openCourses,
  );
  return router;
}
