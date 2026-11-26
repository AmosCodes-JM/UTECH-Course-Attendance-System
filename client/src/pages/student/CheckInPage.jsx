// Student check-in kiosk ("/").
//
// enter ID -> confirm name & programme -> tap a course -> confirmation,
// then the screen resets for the next student. Designed for a shared device
// at the classroom door, and also works on a phone.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/common/Alert.jsx';
import { Clock } from '../../components/common/Clock.jsx';
import { Spinner } from '../../components/common/Spinner.jsx';
import { CheckInConfirmation } from '../../components/student/CheckInConfirmation.jsx';
import { CourseButtonList } from '../../components/student/CourseButtonList.jsx';
import { IdEntryForm } from '../../components/student/IdEntryForm.jsx';
import { StudentConfirmCard } from '../../components/student/StudentConfirmCard.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { studentApi } from '../../services/endpoints.js';

const RESET_AFTER_SUCCESS_SECONDS = 6;
const RESET_AFTER_IDLE_MS = 60_000; // privacy: clear a forgotten screen

// Friendly messages for the error codes the check-in API returns.
function describeCheckInError(error) {
  switch (error.code) {
    case 'ALREADY_CHECKED_IN':
      return { title: 'Already checked in', message: 'Your attendance for this session was already recorded. You do not need to check in again.' };
    case 'SESSION_CLOSED':
      return { title: 'Session closed', message: 'Your lecturer has closed this session, so check-in is no longer possible.' };
    case 'NOT_ENROLLED':
      return { title: 'Not enrolled', message: 'You are not enrolled in this course. Speak to your lecturer or the SCIT office.' };
    case 'SESSION_NOT_FOUND':
      return { title: 'Session not found', message: 'This class session no longer exists. Please try again.' };
    case 'RATE_LIMITED':
      return { title: 'Please wait', message: error.message };
    case 'NETWORK_ERROR':
      return { title: 'No connection', message: error.message };
    default:
      return { title: 'Check-in failed', message: error.message };
  }
}

export function CheckInPage() {
  useDocumentTitle('Check in');
  const location = useLocation();
  const navigate = useNavigate();
  const registeredId = location.state?.registeredId;

  const [step, setStep] = useState('enter'); // enter | confirm | done
  const [lookup, setLookup] = useState(null); // { student, courses }
  const [lookupError, setLookupError] = useState(null);
  const [checkInError, setCheckInError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busySessionId, setBusySessionId] = useState(null);
  const [result, setResult] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(RESET_AFTER_SUCCESS_SECONDS);
  const [formKey, setFormKey] = useState(0);
  const didAutoLookup = useRef(false);

  const reset = useCallback(() => {
    setStep('enter');
    setLookup(null);
    setLookupError(null);
    setCheckInError(null);
    setResult(null);
    setBusySessionId(null);
    setFormKey((k) => k + 1); // re-mount the ID form so it is empty and focused
  }, []);

  const findStudent = useCallback(async (idNumber) => {
    setBusy(true);
    setLookupError(null);
    setCheckInError(null);
    try {
      const data = await studentApi.openCourses(idNumber);
      setLookup(data);
      setStep('confirm');
    } catch (error) {
      setLookupError({ ...error, idNumber, code: error.code, message: error.message });
    } finally {
      setBusy(false);
    }
  }, []);

  // Coming back from registration: look the new student up straight away.
  useEffect(() => {
    if (registeredId && !didAutoLookup.current) {
      didAutoLookup.current = true;
      findStudent(registeredId);
      navigate('.', { replace: true, state: { justRegistered: true } });
    }
  }, [registeredId, findStudent, navigate]);

  async function handleSelect(course) {
    setBusySessionId(course.sessionId);
    setCheckInError(null);
    try {
      const data = await studentApi.checkIn(lookup.student.idNumber, course.sessionId);
      setResult(data);
      setSecondsLeft(RESET_AFTER_SUCCESS_SECONDS);
      setStep('done');
    } catch (error) {
      setCheckInError(describeCheckInError(error));
      // Refresh the list so closed sessions disappear and check-ins show as done.
      try {
        setLookup(await studentApi.openCourses(lookup.student.idNumber));
      } catch {
        // keep the old list if the refresh fails
      }
    } finally {
      setBusySessionId(null);
    }
  }

  // Count down after a successful check-in, then reset for the next student.
  useEffect(() => {
    if (step !== 'done') return undefined;
    const started = Date.now();
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(Math.max(0, RESET_AFTER_SUCCESS_SECONDS - elapsed));
    }, 250);
    const done = setTimeout(reset, RESET_AFTER_SUCCESS_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [step, reset]);

  // Reset a confirm screen nobody is using.
  useEffect(() => {
    if (step !== 'confirm') return undefined;
    const timer = setTimeout(reset, RESET_AFTER_IDLE_MS);
    return () => clearTimeout(timer);
  }, [step, lookup, reset]);

  const notFound = lookupError?.code === 'STUDENT_NOT_FOUND';
  const courses = lookup?.courses ?? [];

  return (
    <div className="kiosk">
      <Clock />
      <section className="kiosk-card" aria-live="polite">
        {step === 'enter' && (
          <>
            <h1>Record your attendance</h1>
            <p className="kiosk-lead">Enter your student ID number to see your open classes.</p>
            {location.state?.justRegistered && !busy && !lookupError && (
              <Alert type="success" title="Registration complete">
                Enter your ID number to check in.
              </Alert>
            )}
            {notFound && (
              <Alert
                type="warning"
                title="We don’t recognise that ID number"
                action={
                  <Link className="btn btn-primary" to={`/register?id=${encodeURIComponent(lookupError.idNumber)}`}>
                    Register as a new student
                  </Link>
                }
              >
                Check the number and try again. If this is your first time, please register first.
              </Alert>
            )}
            {lookupError && !notFound && (
              <Alert type="error" title={lookupError.code === 'VALIDATION_ERROR' ? 'Invalid ID number' : 'Could not look up your ID'}>
                {lookupError.code === 'VALIDATION_ERROR' ? 'Student IDs use 4–20 letters or digits.' : lookupError.message}
              </Alert>
            )}
            <div style={{ marginTop: '1.25rem' }}>
              <IdEntryForm key={formKey} busy={busy} onSubmit={findStudent} />
            </div>
            <p className="muted" style={{ textAlign: 'center', marginTop: '1.25rem', marginBottom: 0 }}>
              First time here? <Link to="/register">Register now</Link>
            </p>
          </>
        )}

        {step === 'confirm' && lookup && (
          <>
            <StudentConfirmCard student={lookup.student} onNotMe={reset} />
            {checkInError && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert type={checkInError.title === 'Already checked in' ? 'info' : 'error'} title={checkInError.title}>
                  {checkInError.message}
                </Alert>
              </div>
            )}
            {courses.length === 0 ? (
              <Alert type="info" title="No open sessions right now">
                None of your courses has an open attendance session. Ask your lecturer to open the session, then try again.
              </Alert>
            ) : (
              <>
                <h2 style={{ textAlign: 'center' }}>Tap your class</h2>
                <CourseButtonList courses={courses} busySessionId={busySessionId} onSelect={handleSelect} />
              </>
            )}
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => findStudent(lookup.student.idNumber)}
                disabled={busy || busySessionId !== null}
              >
                {busy ? <Spinner label="Refreshing" /> : '↻'} Refresh
              </button>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Start over
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <CheckInConfirmation
            firstName={lookup?.student.firstName}
            result={result}
            secondsLeft={secondsLeft}
            totalSeconds={RESET_AFTER_SUCCESS_SECONDS}
            onDone={reset}
          />
        )}
      </section>
    </div>
  );
}
