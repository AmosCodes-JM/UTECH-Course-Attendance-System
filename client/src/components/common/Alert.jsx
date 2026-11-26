const ICONS = { error: '⚠', success: '✓', warning: '!', info: 'i' };

/** Inline message box. type: error | success | warning | info */
export function Alert({ type = 'info', title, children, action }) {
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true" style={{ fontWeight: 700 }}>
        {ICONS[type]}
      </span>
      <div style={{ flex: 1 }}>
        {title && <span className="alert-title">{title}</span>}
        {children}
        {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
      </div>
    </div>
  );
}

/** Shows an ApiError (or any error) as an alert, with field details if present. */
export function ErrorAlert({ error, title = 'Something went wrong' }) {
  if (!error) return null;
  return (
    <Alert type="error" title={title}>
      <p>{error.message}</p>
      {error.errors?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {error.errors.map((e, i) => (
            <li key={i}>{e.field ? `${e.field}: ${e.message}` : e.message}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
