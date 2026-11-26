// Helpers for recognising PostgreSQL constraint violations, whether they
// arrive as Prisma "known request" errors or raw pg errors (from $queryRaw).
//
// PostgreSQL error codes: 23505 = unique_violation, 23503 = foreign_key_violation,
// 23514 = check_violation, 23P01 = exclusion_violation.

function pgCode(err) {
  return err?.meta?.code ?? err?.meta?.driverAdapterError?.cause?.originalCode ?? err?.cause?.code ?? err?.code;
}

export function isUniqueViolation(err) {
  return err?.code === 'P2002' || pgCode(err) === '23505';
}

export function isForeignKeyViolation(err) {
  return err?.code === 'P2003' || pgCode(err) === '23503';
}

export function isRecordNotFound(err) {
  return err?.code === 'P2025';
}

export function isCheckViolation(err) {
  return pgCode(err) === '23514' || pgCode(err) === '23P01';
}

/**
 * Best-effort list of the columns / constraint involved in a unique violation,
 * used to turn it into a friendly message ("email already registered").
 */
export function uniqueViolationTarget(err) {
  const target =
    err?.meta?.target ??
    err?.meta?.driverAdapterError?.cause?.constraint?.fields ??
    err?.meta?.driverAdapterError?.cause?.constraint?.index ??
    err?.constraint ??
    '';
  return Array.isArray(target) ? target.join(',') : String(target);
}
