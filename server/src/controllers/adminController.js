// Administrator endpoints. Every handler here sits behind requireAdmin and
// CSRF protection (see routes/adminRoutes.js); handlers only read validated
// input, call a service and send the result.
import * as catalog from '../services/adminCatalogService.js';
import * as people from '../services/adminPeopleService.js';

const send = (res, data, status = 200) => res.status(status).json({ success: true, data });
const v = (req) => req.validated;

export const overview = async (_req, res) => send(res, await people.getOverview());

// Schools
export const listSchools = async (_req, res) => send(res, await catalog.listSchools());
export const createSchool = async (req, res) => send(res, await catalog.createSchool(v(req).body), 201);
export const updateSchool = async (req, res) => send(res, await catalog.updateSchool(v(req).params.id, v(req).body));
export const deleteSchool = async (req, res) => send(res, await catalog.deleteSchool(v(req).params.id));

// Programmes
export const listPrograms = async (_req, res) => send(res, await catalog.listAdminPrograms());
export const createProgram = async (req, res) => send(res, await catalog.createProgram(v(req).body), 201);
export const updateProgram = async (req, res) => send(res, await catalog.updateProgram(v(req).params.id, v(req).body));
export const deleteProgram = async (req, res) => send(res, await catalog.deleteProgram(v(req).params.id));

// Modules
export const listModules = async (req, res) => send(res, await catalog.listModules(v(req).query.search));
export const createModule = async (req, res) => send(res, await catalog.createModule(v(req).body), 201);
export const updateModule = async (req, res) => send(res, await catalog.updateModule(v(req).params.id, v(req).body));
export const deleteModule = async (req, res) => send(res, await catalog.deleteModule(v(req).params.id));

// Programme-module assignments
export const listProgramModules = async (req, res) => send(res, await catalog.listProgramModules(v(req).params.id));
export const addProgramModule = async (req, res) =>
  send(res, await catalog.addProgramModule(v(req).params.id, v(req).body), 201);
export const updateProgramModule = async (req, res) =>
  send(res, await catalog.updateProgramModule(v(req).params.id, v(req).params.moduleId, v(req).body));
export const removeProgramModule = async (req, res) =>
  send(res, await catalog.removeProgramModule(v(req).params.id, v(req).params.moduleId));

// Semesters
export const listSemesters = async (_req, res) => send(res, await catalog.listSemesters());
export const createSemester = async (req, res) => send(res, await catalog.createSemester(v(req).body), 201);
export const updateSemester = async (req, res) => send(res, await catalog.updateSemester(v(req).params.id, v(req).body));
export const deleteSemester = async (req, res) => send(res, await catalog.deleteSemester(v(req).params.id));

// Students and enrollments
export const listStudents = async (req, res) => send(res, await people.listStudents(v(req).query.search));
export const getStudent = async (req, res) => send(res, await people.getStudent(v(req).params.id));
export const updateStudent = async (req, res) => send(res, await people.updateStudent(v(req).params.id, v(req).body));
export const deleteStudent = async (req, res) => send(res, await people.deleteStudent(v(req).params.id));
export const addEnrollment = async (req, res) => send(res, await people.addEnrollment(v(req).params.id, v(req).body), 201);
export const removeEnrollment = async (req, res) =>
  send(res, await people.removeEnrollment(v(req).params.id, v(req).params.semesterId, v(req).params.moduleId));

// Lecturers and course assignments
export const listLecturers = async (req, res) => send(res, await people.listLecturers(v(req).query.search));
export const getLecturer = async (req, res) => send(res, await people.getLecturer(v(req).params.id));
export const createLecturer = async (req, res) => send(res, await people.createLecturer(v(req).body), 201);
export const updateLecturer = async (req, res) => send(res, await people.updateLecturer(v(req).params.id, v(req).body));
export const deleteLecturer = async (req, res) => send(res, await people.deleteLecturer(v(req).params.id));
export const addAssignment = async (req, res) => send(res, await people.addAssignment(v(req).params.id, v(req).body), 201);
export const removeAssignment = async (req, res) =>
  send(res, await people.removeAssignment(v(req).params.id, v(req).params.semesterId, v(req).params.moduleId));

// Administrators
export const listAdmins = async (_req, res) => send(res, await people.listAdmins());
export const createAdmin = async (req, res) => send(res, await people.createAdmin(v(req).body), 201);
