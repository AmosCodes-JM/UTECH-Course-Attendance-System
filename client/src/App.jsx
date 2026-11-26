// All frontend routes. Protected areas are wrapped in role-specific guards;
// the Express API enforces the same rules independently.
import { Route, Routes } from 'react-router';
import { AdminLayout } from './components/admin/AdminLayout.jsx';
import { PublicLayout } from './components/common/PublicLayout.jsx';
import { LecturerLayout } from './components/lecturer/LecturerLayout.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.jsx';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.jsx';
import { AdminsPage } from './pages/admin/AdminsPage.jsx';
import { LecturerDetailPage } from './pages/admin/LecturerDetailPage.jsx';
import { LecturersPage } from './pages/admin/LecturersPage.jsx';
import { ModulesPage } from './pages/admin/ModulesPage.jsx';
import { ProgramModulesPage } from './pages/admin/ProgramModulesPage.jsx';
import { ProgramsPage } from './pages/admin/ProgramsPage.jsx';
import { SchoolsPage } from './pages/admin/SchoolsPage.jsx';
import { SemestersPage } from './pages/admin/SemestersPage.jsx';
import { StudentDetailPage } from './pages/admin/StudentDetailPage.jsx';
import { StudentsPage } from './pages/admin/StudentsPage.jsx';
import { AttendancePage } from './pages/lecturer/AttendancePage.jsx';
import { LecturerDashboardPage } from './pages/lecturer/LecturerDashboardPage.jsx';
import { LecturerLoginPage } from './pages/lecturer/LecturerLoginPage.jsx';
import { LecturerRegisterPage } from './pages/lecturer/LecturerRegisterPage.jsx';
import { CheckInPage } from './pages/student/CheckInPage.jsx';
import { RegisterPage } from './pages/student/RegisterPage.jsx';
import { AdminProtectedRoute } from './routes/AdminProtectedRoute.jsx';
import { GuestOnlyRoute } from './routes/GuestOnlyRoute.jsx';
import { LecturerProtectedRoute } from './routes/LecturerProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<PublicLayout />}>
        <Route index element={<CheckInPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<GuestOnlyRoute />}>
          <Route path="lecturer/login" element={<LecturerLoginPage />} />
          <Route path="lecturer/register" element={<LecturerRegisterPage />} />
          <Route path="admin/login" element={<AdminLoginPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Lecturer area */}
      <Route path="lecturer" element={<LecturerProtectedRoute />}>
        <Route element={<LecturerLayout />}>
          <Route index element={<LecturerDashboardPage />} />
          <Route path="attendance" element={<AttendancePage />} />
        </Route>
      </Route>

      {/* Administrator area */}
      <Route path="admin" element={<AdminProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:programId" element={<ProgramModulesPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="semesters" element={<SemestersPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />
          <Route path="lecturers" element={<LecturersPage />} />
          <Route path="lecturers/:lecturerId" element={<LecturerDetailPage />} />
          <Route path="admins" element={<AdminsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
