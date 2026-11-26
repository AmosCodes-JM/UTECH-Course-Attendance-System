// Mounts every API route under /api.
import { Router } from 'express';
import { createAdminRouter } from './adminRoutes.js';
import { createAttendanceRouter } from './attendanceRoutes.js';
import { createAuthRouter } from './authRoutes.js';
import { createProgramRouter, createSemesterRouter } from './catalogRoutes.js';
import {
  createClassSessionRouter,
  createLecturerRegistrationRouter,
  createLecturerRouter,
} from './lecturerRoutes.js';
import { createStudentRouter } from './studentRoutes.js';

export function createApiRouter(limiters) {
  const router = Router();

  router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

  router.use('/auth', createAuthRouter(limiters));
  router.use('/programs', createProgramRouter());
  router.use('/semesters', createSemesterRouter());
  router.use('/students', createStudentRouter(limiters));
  router.use('/attendance', createAttendanceRouter(limiters));
  router.use('/lecturers', createLecturerRegistrationRouter(limiters));
  router.use('/lecturer', createLecturerRouter());
  router.use('/class-sessions', createClassSessionRouter());
  router.use('/admin', createAdminRouter());

  return router;
}
