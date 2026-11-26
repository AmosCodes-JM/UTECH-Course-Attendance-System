// Lecturer registration, course list and session open/close.
import { closeSession, getLecturerCourses, openSession, registerLecturer } from '../services/lecturerService.js';

/** POST /api/lecturers (public) */
export async function register(req, res) {
  const result = await registerLecturer(req.validated.body);
  res.status(201).json({ success: true, data: result });
}

/** GET /api/lecturer/courses?scope=current|all */
export async function courses(req, res) {
  const result = await getLecturerCourses(req.user.id, req.validated.query.scope);
  res.json({ success: true, data: result });
}

/** POST /api/class-sessions */
export async function open(req, res) {
  const session = await openSession(req.user.id, req.validated.body.moduleId);
  res.status(201).json({ success: true, data: session });
}

/** PATCH /api/class-sessions/:id/close (ownership already verified) */
export async function close(req, res) {
  const session = await closeSession(req.classSession.id);
  res.json({ success: true, data: session });
}
