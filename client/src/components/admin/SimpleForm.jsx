import { useState } from 'react';
import { ErrorAlert } from '../common/Alert.jsx';
import { fieldProps } from '../common/fieldProps.js';
import { FormField } from '../common/FormField.jsx';
import { Spinner } from '../common/Spinner.jsx';

/**
 * A small configurable form for the admin screens.
 * fields: [{ name, label, type?, options?, required?, hint?, placeholder? }]
 * onSubmit(values) may throw an ApiError; its field errors are shown inline.
 */
export function SimpleForm({ fields, initialValues = {}, submitLabel = 'Save', onSubmit, onCancel, columns = 2 }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, initialValues[f.name] ?? (f.type === 'checkbox' ? false : '')])),
  );
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function convert(field, raw) {
    if (field.type === 'number') return raw === '' || raw === null ? null : Number(raw);
    if (field.type === 'select' && field.numeric) return raw === '' ? null : Number(raw);
    if (typeof raw === 'string') return raw.trim() === '' && !field.required ? null : raw.trim();
    return raw;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const missing = {};
    for (const f of fields) {
      if (f.required && (values[f.name] === '' || values[f.name] === null)) missing[f.name] = `${f.label} is required`;
    }
    setErrors(missing);
    if (Object.keys(missing).length) return;

    const payload = {};
    for (const f of fields) {
      const v = convert(f, values[f.name]);
      if (f.omitIfEmpty && (v === null || v === '')) continue;
      payload[f.name] = v;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err);
      setErrors(err.fieldErrors ?? {});
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <ErrorAlert error={error} title="Could not save" />
      <div className={`form-grid ${columns === 3 ? 'three' : columns === 2 ? 'two' : ''}`}>
        {fields.map((f) => {
          const id = `f-${f.name}`;
          const common = {
            ...fieldProps(id, errors[f.name], f.hint),
            value: values[f.name] ?? '',
            onChange: (e) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
          };
          return (
            <FormField key={f.name} id={id} label={f.label} hint={f.hint} error={errors[f.name]}>
              {f.type === 'select' ? (
                <select className="select" {...common}>
                  {!f.required || f.placeholder ? <option value="">{f.placeholder ?? '—'}</option> : null}
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                  {...common}
                />
              )}
            </FormField>
          );
        })}
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy && <Spinner label="Saving" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
