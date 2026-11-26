// First-time student registration ("/register").
// Collects the student's details, programme and this semester's modules,
// then sends them back to the check-in kiosk.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert, ErrorAlert } from '../../components/common/Alert.jsx';
import { fieldProps } from '../../components/common/fieldProps.js';
import { FormField } from '../../components/common/FormField.jsx';
import { LoadingBlock, Spinner } from '../../components/common/Spinner.jsx';
import { CoursePicker } from '../../components/forms/CoursePicker.jsx';
import { ProgramPicker } from '../../components/forms/ProgramPicker.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { catalogApi, studentApi } from '../../services/endpoints.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[\p{L}\p{M}' .-]+$/u;
const ID = /^[A-Za-z0-9-]{4,20}$/;

function validate(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'Enter your first name';
  else if (!NAME.test(form.firstName.trim())) errors.firstName = 'Use letters, spaces, apostrophes or hyphens only';
  if (!form.lastName.trim()) errors.lastName = 'Enter your last name';
  else if (!NAME.test(form.lastName.trim())) errors.lastName = 'Use letters, spaces, apostrophes or hyphens only';
  if (!ID.test(form.idNumber.trim())) errors.idNumber = 'Student ID must be 4–20 letters, digits or dashes';
  if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (!form.programId) errors.programId = 'Choose your programme';
  if (form.moduleIds.length === 0) errors.moduleIds = 'Select at least one module you are taking this semester';
  return errors;
}

export function RegisterPage() {
  useDocumentTitle('Student registration');
  const navigate = useNavigate();
  const notify = useToast();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    idNumber: searchParams.get('id') ?? '',
    email: '',
    programId: null,
    moduleIds: [],
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const programs = useApi(() => catalogApi.programs(), []);
  const [modules, setModules] = useState({ status: 'idle', data: null, error: null });

  // Load the selected programme's modules for the current semester.
  useEffect(() => {
    if (!form.programId) return undefined;
    let active = true;
    catalogApi
      .programModules(form.programId, 'current')
      .then((data) => active && setModules({ status: 'ready', data, error: null }))
      .catch((error) => active && setModules({ status: 'error', data: null, error }));
    return () => {
      active = false;
    };
  }, [form.programId]);

  const update = (field) => (value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function changeProgram(programId) {
    setForm((f) => ({ ...f, programId, moduleIds: [] }));
    setErrors((e) => ({ ...e, programId: undefined, moduleIds: undefined }));
    setModules({ status: programId ? 'loading' : 'idle', data: null, error: null });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(null);
    try {
      const result = await studentApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        idNumber: form.idNumber.trim(),
        email: form.email.trim(),
        programId: form.programId,
        moduleIds: form.moduleIds,
      });
      notify.success(`Welcome, ${result.student.firstName}! You can now check in.`, 'Registration complete');
      navigate('/', { state: { registeredId: result.student.idNumber } });
    } catch (error) {
      setSubmitError(error);
      if (error.errors?.length) setErrors((e) => ({ ...e, ...error.fieldErrors }));
      if (error.code === 'DUPLICATE_ID_NUMBER') setErrors((e) => ({ ...e, idNumber: error.message }));
      if (error.code === 'DUPLICATE_EMAIL') setErrors((e) => ({ ...e, email: error.message }));
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const text = (id, label, props = {}) => (
    <FormField id={id} label={label} error={errors[id]} hint={props.hint}>
      <input
        className="input"
        {...fieldProps(id, errors[id], props.hint)}
        value={form[id]}
        onChange={(e) => update(id)(e.target.value)}
        required
        {...props.input}
      />
    </FormField>
  );

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1>Student registration</h1>
          <p>Register once, then check in to your classes with your ID number.</p>
        </div>
        <Link to="/" className="btn btn-secondary">
          ← Back to check-in
        </Link>
      </div>

      <form className="card form" onSubmit={handleSubmit} noValidate>
        {submitError && <ErrorAlert error={submitError} title="Registration was not completed" />}

        <h2>Your details</h2>
        <div className="form-grid two">
          {text('firstName', 'First name', { input: { autoComplete: 'given-name' } })}
          {text('lastName', 'Last name', { input: { autoComplete: 'family-name' } })}
          {text('idNumber', 'Student ID number', { input: { autoCapitalize: 'characters', spellCheck: false } })}
          {text('email', 'Student email address', { input: { type: 'email', autoComplete: 'email' } })}
        </div>

        <h2 style={{ marginTop: '0.5rem' }}>Programme of study</h2>
        {programs.loading && <LoadingBlock message="Loading programmes…" />}
        {programs.error && <ErrorAlert error={programs.error} title="Could not load programmes" />}
        {programs.data && (
          <FormField id="programId" label="Programme" error={errors.programId}>
            <ProgramPicker
              id="programId"
              programs={programs.data}
              value={form.programId}
              onChange={changeProgram}
              invalid={Boolean(errors.programId)}
              describedBy={errors.programId ? 'programId-error' : undefined}
            />
          </FormField>
        )}

        {form.programId && (
          <>
            <h2 style={{ marginTop: '0.5rem' }}>Modules this semester</h2>
            {modules.status === 'loading' && <LoadingBlock message="Loading modules…" />}
            {modules.error?.code === 'NO_ACTIVE_SEMESTER' && (
              <Alert type="warning" title="Registration is closed between semesters">
                {modules.error.message}
              </Alert>
            )}
            {modules.error && modules.error.code !== 'NO_ACTIVE_SEMESTER' && (
              <ErrorAlert error={modules.error} title="Could not load modules" />
            )}
            {modules.data && (
              <>
                <p className="muted">
                  Showing modules offered in <strong>{modules.data.semester.label}</strong>. Tick every module you are
                  enrolled in. For either/or pairs you can choose only one.
                </p>
                {errors.moduleIds && (
                  <span className="error" id="moduleIds-error" role="alert" style={{ color: 'var(--color-danger)' }}>
                    {errors.moduleIds}
                  </span>
                )}
                <CoursePicker
                  id="moduleIds"
                  modules={modules.data.modules}
                  selectedIds={form.moduleIds}
                  onChange={update('moduleIds')}
                  enforceChoiceGroups
                  describedBy={errors.moduleIds ? 'moduleIds-error' : undefined}
                />
              </>
            )}
          </>
        )}

        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy && <Spinner label="Registering" />}
          {busy ? 'Registering…' : 'Complete registration'}
        </button>
      </form>
    </div>
  );
}
