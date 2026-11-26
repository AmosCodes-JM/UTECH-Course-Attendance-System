// One function per backend endpoint, grouped by area. Pages and components
// call these instead of building URLs themselves.
import { api, downloadFile } from './api.js';

export const authApi = {
  session: () => api.get('/auth/session'),
  lecturerLogin: (identifier, password) => api.post('/auth/lecturer/login', { identifier, password }),
  adminLogin: (identifier, password) => api.post('/auth/admin/login', { identifier, password }),
  lecturerLogout: () => api.post('/auth/lecturer/logout'),
  adminLogout: () => api.post('/auth/admin/logout'),
  lecturerMe: () => api.get('/auth/lecturer/me'),
  adminMe: () => api.get('/auth/admin/me'),
};

export const catalogApi = {
  programs: () => api.get('/programs'),
  programModules: (programId, semester = 'current') => api.get(`/programs/${programId}/modules`, { semester }),
  currentSemester: () => api.get('/semesters/current'),
};

export const studentApi = {
  register: (data) => api.post('/students', data),
  openCourses: (idNumber) => api.get(`/students/${encodeURIComponent(idNumber)}/open-courses`),
  checkIn: (idNumber, sessionId) => api.post('/attendance', { idNumber, sessionId }),
};

export const lecturerApi = {
  register: (data) => api.post('/lecturers', data),
  courses: (scope = 'current') => api.get('/lecturer/courses', { scope }),
  openSession: (moduleId) => api.post('/class-sessions', { moduleId }),
  closeSession: (sessionId) => api.patch(`/class-sessions/${sessionId}/close`),
  attendance: (moduleId, date) => api.get('/attendance', { moduleId, date }),
  exportAttendance: (format, moduleId, date) =>
    downloadFile('/attendance/export', { format, moduleId, date }, `attendance.${format}`),
};

const crud = (base) => ({
  list: (query) => api.get(base, query),
  get: (id) => api.get(`${base}/${id}`),
  create: (data) => api.post(base, data),
  update: (id, data) => api.patch(`${base}/${id}`, data),
  remove: (id) => api.delete(`${base}/${id}`),
});

export const adminApi = {
  overview: () => api.get('/admin/overview'),
  schools: crud('/admin/schools'),
  programs: crud('/admin/programs'),
  modules: crud('/admin/modules'),
  semesters: crud('/admin/semesters'),
  students: crud('/admin/students'),
  lecturers: crud('/admin/lecturers'),
  admins: { list: () => api.get('/admin/admins'), create: (data) => api.post('/admin/admins', data) },
  programModules: {
    list: (programId) => api.get(`/admin/programs/${programId}/modules`),
    add: (programId, data) => api.post(`/admin/programs/${programId}/modules`, data),
    update: (programId, moduleId, data) => api.patch(`/admin/programs/${programId}/modules/${moduleId}`, data),
    remove: (programId, moduleId) => api.delete(`/admin/programs/${programId}/modules/${moduleId}`),
  },
  enrollments: {
    add: (studentId, data) => api.post(`/admin/students/${studentId}/enrollments`, data),
    remove: (studentId, semesterId, moduleId) =>
      api.delete(`/admin/students/${studentId}/enrollments/${semesterId}/${moduleId}`),
  },
  assignments: {
    add: (lecturerId, data) => api.post(`/admin/lecturers/${lecturerId}/modules`, data),
    remove: (lecturerId, semesterId, moduleId) =>
      api.delete(`/admin/lecturers/${lecturerId}/modules/${semesterId}/${moduleId}`),
  },
};
