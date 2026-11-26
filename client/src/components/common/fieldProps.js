/** Props to spread onto an <input> inside FormField. */
export function fieldProps(id, error, hint) {
  return {
    id,
    name: id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}
