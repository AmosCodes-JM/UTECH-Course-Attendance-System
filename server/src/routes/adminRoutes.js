// /api/admin/... - every route requires an authenticated ADMIN account
// (checked against the database on each request) plus a CSRF token for
// changes. Hiding links in the React app is NOT what protects these routes.
import { Router } from 'express';
import { z } from 'zod';
import * as admin from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { validate } from '../middleware/validate.js';
import { API_SEMESTER_SLOTS } from '../services/catalogService.js';
import {
  dateString,
  email,
  idParam,
  moduleCode,
  password,
  personName,
  studentIdNumber,
  workId,
} from '../utils/validators.js';

const idParams = z.object({ id: idParam });
const searchQuery = z.object({ search: z.string().trim().max(100).optional() });

const text = (max, label = 'Required') => z.string({ error: label }).trim().min(1, label).max(max);
const optionalMajor = z
  .string()
  .trim()
  .max(150)
  .nullish()
  .transform((v) => (v ? v : null));
const credits = z.coerce.number().int().min(0).max(30).nullable();
const level = z.coerce.number().int().min(1).max(6);
const semesterSlot = z.enum(API_SEMESTER_SLOTS, { error: 'Semester slot must be 1, 2, YEAR or EITHER' });
const choiceGroup = z.string().trim().max(60).nullish();
const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{4}$/, 'Use the format 2026/2027')
  .refine((v) => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, 'The second year must follow the first');
const term = z.coerce.number().int().min(1).max(2);

const schoolBody = z.strictObject({ code: text(20).toUpperCase(), name: text(150) });
const programBody = z.strictObject({ schoolId: idParam, name: text(150), major: optionalMajor });
const moduleBody = z.strictObject({ code: moduleCode, name: text(200), credits });
const programModuleBody = z.strictObject({ moduleId: idParam, level, semesterSlot, choiceGroup });
const semesterBody = z.strictObject({ academicYear, term, startDate: dateString, endDate: dateString });
const studentBody = z.strictObject({
  idNumber: studentIdNumber,
  firstName: personName,
  lastName: personName,
  email,
  programId: idParam,
});
const userBody = z.strictObject({ firstName: personName, lastName: personName, email, workId, password });
const moduleSemesterBody = z.strictObject({ moduleId: idParam, semesterId: idParam });
const pairParams = z.object({ id: idParam, semesterId: idParam, moduleId: idParam });

export function createAdminRouter() {
  const router = Router();
  router.use(requireAdmin, requireCsrf);

  router.get('/overview', admin.overview);

  router.get('/schools', admin.listSchools);
  router.post('/schools', validate({ body: schoolBody }), admin.createSchool);
  router.patch('/schools/:id', validate({ params: idParams, body: schoolBody.partial() }), admin.updateSchool);
  router.delete('/schools/:id', validate({ params: idParams }), admin.deleteSchool);

  router.get('/programs', admin.listPrograms);
  router.post('/programs', validate({ body: programBody }), admin.createProgram);
  router.patch('/programs/:id', validate({ params: idParams, body: programBody.partial() }), admin.updateProgram);
  router.delete('/programs/:id', validate({ params: idParams }), admin.deleteProgram);

  router.get('/programs/:id/modules', validate({ params: idParams }), admin.listProgramModules);
  router.post('/programs/:id/modules', validate({ params: idParams, body: programModuleBody }), admin.addProgramModule);
  router.patch(
    '/programs/:id/modules/:moduleId',
    validate({
      params: z.object({ id: idParam, moduleId: idParam }),
      body: programModuleBody.omit({ moduleId: true }).partial(),
    }),
    admin.updateProgramModule,
  );
  router.delete(
    '/programs/:id/modules/:moduleId',
    validate({ params: z.object({ id: idParam, moduleId: idParam }) }),
    admin.removeProgramModule,
  );

  router.get('/modules', validate({ query: searchQuery }), admin.listModules);
  router.post('/modules', validate({ body: moduleBody }), admin.createModule);
  router.patch('/modules/:id', validate({ params: idParams, body: moduleBody.partial() }), admin.updateModule);
  router.delete('/modules/:id', validate({ params: idParams }), admin.deleteModule);

  router.get('/semesters', admin.listSemesters);
  router.post('/semesters', validate({ body: semesterBody }), admin.createSemester);
  router.patch('/semesters/:id', validate({ params: idParams, body: semesterBody.partial() }), admin.updateSemester);
  router.delete('/semesters/:id', validate({ params: idParams }), admin.deleteSemester);

  router.get('/students', validate({ query: searchQuery }), admin.listStudents);
  router.get('/students/:id', validate({ params: idParams }), admin.getStudent);
  router.patch('/students/:id', validate({ params: idParams, body: studentBody.partial() }), admin.updateStudent);
  router.delete('/students/:id', validate({ params: idParams }), admin.deleteStudent);
  router.post(
    '/students/:id/enrollments',
    validate({ params: idParams, body: moduleSemesterBody }),
    admin.addEnrollment,
  );
  router.delete(
    '/students/:id/enrollments/:semesterId/:moduleId',
    validate({ params: pairParams }),
    admin.removeEnrollment,
  );

  router.get('/lecturers', validate({ query: searchQuery }), admin.listLecturers);
  router.post('/lecturers', validate({ body: userBody }), admin.createLecturer);
  router.get('/lecturers/:id', validate({ params: idParams }), admin.getLecturer);
  router.patch('/lecturers/:id', validate({ params: idParams, body: userBody.partial() }), admin.updateLecturer);
  router.delete('/lecturers/:id', validate({ params: idParams }), admin.deleteLecturer);
  router.post('/lecturers/:id/modules', validate({ params: idParams, body: moduleSemesterBody }), admin.addAssignment);
  router.delete(
    '/lecturers/:id/modules/:semesterId/:moduleId',
    validate({ params: pairParams }),
    admin.removeAssignment,
  );

  router.get('/admins', admin.listAdmins);
  router.post('/admins', validate({ body: userBody }), admin.createAdmin);

  return router;
}
