// /api/attendance - public check-in plus lecturer-only viewing and exports.
import { Router } from 'express';
import { z } from 'zod';
import * as attendance from '../controllers/attendanceController.js';
import { requireLecturer } from '../middleware/auth.js';
import { requireModuleOwnership } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import { dateString, idParam, studentIdNumber } from '../utils/validators.js';

// Only the student ID and session are accepted. Any extra field - for example
// a client-made `checkedInAt` timestamp - is rejected with 400.
const checkInBody = z.strictObject({
  idNumber: studentIdNumber,
  sessionId: idParam,
});

const filterQuery = z.object({
  moduleId: idParam,
  date: dateString.optional(),
});

const exportQuery = filterQuery.extend({
  format: z.enum(['xlsx', 'pdf'], { error: 'format must be xlsx or pdf' }),
});

export function createAttendanceRouter(limiters) {
  const router = Router();

  router.post('/', limiters.checkIn, validate({ body: checkInBody }), attendance.recordAttendance);

  router.get(
    '/export',
    requireLecturer,
    validate({ query: exportQuery }),
    requireModuleOwnership('query'),
    attendance.exportAttendance,
  );

  router.get(
    '/',
    requireLecturer,
    validate({ query: filterQuery }),
    requireModuleOwnership('query'),
    attendance.viewAttendance,
  );

  return router;
}
