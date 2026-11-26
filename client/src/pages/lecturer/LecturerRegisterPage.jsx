// Two-step lecturer registration ("/lecturer/register"):
//   1. personal and account details   2. SCIT programmes and courses taught
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, ErrorAlert } from '../../components/common/Alert.jsx';
import { fieldProps } from '../../components/common/fieldProps.js';
import { FormField } from '../../components/common/FormField.jsx';
import { LoadingBlock, Spinner } from '../../components/common/Spinner.jsx';
import { CoursePicker } from '../../components/forms/CoursePicker.jsx';
import { MultiStepForm } from '../../components/forms/MultiStepForm.jsx';
import { ProgramPicker } from '../../components/forms/ProgramPicker.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { catalogApi, lecturerApi } from '../../services/endpoints.js';

const STEPS = ['Your details', 'Programmes & courses'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[\p{L}\p{M}' .-]+$/u;
const WORK_ID = /^[A-Za-z0-9-]{3,20}$/;

function validateDetails(f) {
  const e = {};
  if (!f.firstName.trim() || !NAME.test(f.firstName.trim())) e.firstName = 'Enter your first name (letters only)';
  if (!f.lastName.trim() || !NAME.test(f.lastName.trim())) e.lastName = 'Enter your last name (letters only)';
  if (!EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (!WORK_ID.test(f.workId.trim())) e.workId = 'Work ID must be 3–20 letters, digits or dashes';
  if (f.password.length < 8 || f.password.length > 72) e.password = 'Use 8–72 characters';
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
    e.password = 'Include at least one letter and one number';
  if (f.confirmPassword !== f.password) e.confirmPassword = 'Passwords do not match';
  return e;
}

export function LecturerRegisterPage() {
  useDocumentTitle('Lecturer registration');
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    workId: '',
    password: '',
    confirmPassword: '',
  });
  const [programIds, setProgramIds] = useState([]);
  const [moduleIds, setModuleIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const programs = useApi(() => catalogApi.programs(), []);
  const [moduleLists, setModuleLists] = useState({}); // programId -> response
  const [moduleError, setModuleError] = useState(null);

  // Fetch the current-semester modules of each newly selected programme.
  useEffect(() => {
    const missing = programIds.filter((id) => !moduleLists[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map((id) => catalogApi.programModules(id, 'current')))
      .then((results) => {
        setModuleLists((prev) => {
          const next = { ...prev };
          missing.forEach((id, i) => {
            next[id] = results[i];
          });
          return next;
        });
      })
      .catch(setModuleError);
  }, [programIds, moduleLists]);

  // Merge the modules of all selected programmes (a shared module appears once).
  const modules = useMemo(() => {
    const merged = new Map();
    for (const id of programIds) {
      const list = moduleLists[id];
      if (!list) continue;
      for (const m of list.modules) {
        const entry = merged.get(m.id) ?? { ...m, programs: [] };
        entry.programs = [...entry.programs, list.program.displayName];
        entry.level = Math.min(entry.level, m.level);
        merged.set(m.id, entry);
      }
    }
    return [...merged.values()].sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
  }, [programIds, moduleLists]);

  const loadingModules = programIds.some((id) => !moduleLists[id]) && !moduleError;
  const semester = programIds.map((id) => moduleLists[id]?.semester).find(Boolean);

  function changePrograms(ids) {
    setProgramIds(ids);
    setErrors((e) => ({ ...e, programIds: undefined }));
    // Drop selected courses that are no longer offered by any chosen programme.
    setModuleIds((selected) =>
      selected.filter((mid) => ids.some((pid) => moduleLists[pid]?.modules.some((m) => m.id === mid))),
    );
  }

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (step === 0) {
      const found = validateDetails(form);
      setErrors(found);
      if (Object.keys(found).length === 0) setStep(1);
      return;
    }

    const found = {};
    if (programIds.length === 0) found.programIds = 'Select at least one programme';
    if (moduleIds.length === 0) found.moduleIds = 'Select the courses you teach this semester';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(null);
    try {
      // confirmPassword is only checked in the browser; it is not sent.
      await lecturerApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        workId: form.workId.trim(),
        password: form.password,
        programIds,
        moduleIds,
      });
      navigate('/lecturer/login', { state: { message: 'Your lecturer account was created. Please sign in.' } });
    } catch (error) {
      setSubmitError(error);
      const fieldErrors = { ...error.fieldErrors };
      if (error.code === 'DUPLICATE_EMAIL') fieldErrors.email = error.message;
      if (error.code === 'DUPLICATE_WORK_ID') fieldErrors.workId = error.message;
      setErrors(fieldErrors);
      if (['firstName', 'lastName', 'email', 'workId', 'password'].some((f) => fieldErrors[f])) setStep(0);
      setBusy(false);
    }
  }

  const input = (id, label, props = {}) => (
    <FormField id={id} label={label} error={errors[id]} hint={props.hint}>
      <input
        className="input"
        {...fieldProps(id, errors[id], props.hint)}
        value={form[id]}
        onChange={update(id)}
        required
        {...props.input}
      />
    </FormField>
  );

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1>Lecturer registration</h1>
          <p>Create your account, then choose the courses you teach this semester.</p>
        </div>
        <Link to="/lecturer/login" className="btn btn-secondary">
          Already registered? Sign in
        </Link>
      </div>

      <div className="card">
        <MultiStepForm steps={STEPS} currentStep={step} onSubmit={handleSubmit}>
          {submitError && <ErrorAlert error={submitError} title="Registration was not completed" />}

          {step === 0 && (
            <>
              <div className="form-grid two">
                {input('firstName', 'First name', { input: { autoComplete: 'given-name' } })}
                {input('lastName', 'Last name', { input: { autoComplete: 'family-name' } })}
                {input('email', 'Email address', { input: { type: 'email', autoComplete: 'email' } })}
                {input('workId', 'Work ID', { input: { autoCapitalize: 'characters' } })}
                {input('password', 'Password', {
                  hint: '8–72 characters with at least one letter and one number',
                  input: { type: 'password', autoComplete: 'new-password' },
                })}
                {input('confirmPassword', 'Confirm password', {
                  input: { type: 'password', autoComplete: 'new-password' },
                })}
              </div>
              <button type="submit" className="btn btn-primary btn-lg">
                Next: programmes & courses →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Which SCIT programmes do you teach in?</h2>
              {programs.loading && <LoadingBlock message="Loading programmes…" />}
              {programs.error && <ErrorAlert error={programs.error} title="Could not load programmes" />}
              {programs.data && (
                <>
                  {errors.programIds && <Alert type="error">{errors.programIds}</Alert>}
                  <ProgramPicker
                    id="programs"
                    programs={programs.data}
                    multiple
                    value={programIds}
                    onChange={changePrograms}
                  />
                </>
              )}

              {programIds.length > 0 && (
                <>
                  <h2 style={{ marginTop: '0.75rem' }}>Courses you teach this semester</h2>
                  {semester && <p className="muted">Courses offered in {semester.label} by the selected programmes.</p>}
                  {moduleError?.code === 'NO_ACTIVE_SEMESTER' && (
                    <Alert type="warning" title="No active semester">
                      {moduleError.message}
                    </Alert>
                  )}
                  {moduleError && moduleError.code !== 'NO_ACTIVE_SEMESTER' && <ErrorAlert error={moduleError} />}
                  {loadingModules && <LoadingBlock message="Loading courses…" />}
                  {errors.moduleIds && <Alert type="error">{errors.moduleIds}</Alert>}
                  {!loadingModules && modules.length > 0 && (
                    <CoursePicker id="modules" modules={modules} selectedIds={moduleIds} onChange={setModuleIds} />
                  )}
                </>
              )}

              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(0)} disabled={busy}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                  {busy && <Spinner label="Creating account" />}
                  {busy ? 'Creating account…' : 'Create lecturer account'}
                </button>
              </div>
            </>
          )}
        </MultiStepForm>
      </div>
    </div>
  );
}
