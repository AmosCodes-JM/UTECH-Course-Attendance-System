import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminApi } from '../../services/endpoints.js';

export function StudentsPage() {
  useDocumentTitle('Students');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const { data, error, loading } = useApi(() => adminApi.students.list({ search }), [search]);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Registered students and their enrollments. Students register themselves at /register."
      />
      <form
        className="btn-row"
        style={{ marginBottom: '1rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <input
          className="input"
          style={{ maxWidth: 360 }}
          type="search"
          placeholder="Search by ID, name or email"
          aria-label="Search students"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && data.length === 0 && (
        <EmptyState title="No students found">
          {search ? `Nothing matches “${search}”.` : 'No students have registered yet.'}
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID number</th>
                <th>Name</th>
                <th>Email</th>
                <th>Programme</th>
                <th>Modules (current)</th>
                <th>Check-ins</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.idNumber}</td>
                  <td>
                    {s.firstName} {s.lastName}
                  </td>
                  <td>{s.email}</td>
                  <td>{s.program.displayName}</td>
                  <td>{s.currentEnrollmentCount}</td>
                  <td>{s.attendanceCount}</td>
                  <td className="actions">
                    <Link className="btn btn-secondary btn-sm" to={`/admin/students/${s.id}`}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
