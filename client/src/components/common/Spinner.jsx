export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function LoadingBlock({ message = 'Loading…' }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
