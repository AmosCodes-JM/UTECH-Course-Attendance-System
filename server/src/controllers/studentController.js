// Public student endpoints: registration and the check-in lookup.
import { getOpenCourses, registerStudent } from '../services/studentService.js';

/** POST /api/students */
export async function register(req, res) {
  const result = await registerStudent(req.validated.body);
  res.status(201).json({ success: true, data: result });
}

/** GET /api/students/:idNumber/open-courses */
export async function openCourses(req, res) {
  const result = await getOpenCourses(req.validated.params.idNumber);
  res.json({ success: true, data: result });
}
