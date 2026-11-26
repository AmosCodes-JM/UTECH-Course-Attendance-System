// Public catalog endpoints used by the registration forms.
import { getProgramModules, listPrograms } from '../services/catalogService.js';
import { getCurrentSemester, serializeSemester } from '../services/semesterService.js';

/** GET /api/programs */
export async function programs(_req, res) {
  res.json({ success: true, data: await listPrograms() });
}

/** GET /api/programs/:id/modules?semester=current */
export async function programModules(req, res) {
  const result = await getProgramModules(req.validated.params.id, req.validated.query.semester);
  res.json({ success: true, data: result });
}

/** GET /api/semesters/current */
export async function currentSemester(_req, res) {
  res.json({ success: true, data: { semester: serializeSemester(await getCurrentSemester()) } });
}
