#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Local PostgreSQL setup for the Student Attendance Management System.
#
# Creates (or updates) the application role and the development + test
# databases described in server/.env. Safe to run more than once.
#
# Usage (from the project root):
#   sudo bash scripts/setup-local-db.sh
#
# It reads DATABASE_URL and TEST_DATABASE_URL from server/.env, so the role
# password only lives in that (git-ignored) file.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "server/.env not found. Copy server/.env.example to server/.env first." >&2
  exit 1
fi

read_var() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

# postgresql://USER:PASSWORD@HOST:PORT/DBNAME
URL_RE='^postgres(ql)?://([A-Za-z0-9_]+):([A-Za-z0-9_]+)@[^/]+/([A-Za-z0-9_]+)'

DEV_URL="$(read_var DATABASE_URL)"
TEST_URL="$(read_var TEST_DATABASE_URL)"

[[ $DEV_URL =~ $URL_RE ]] || { echo "Could not parse DATABASE_URL (use letters, digits, _ only)" >&2; exit 1; }
DB_USER="${BASH_REMATCH[2]}"
DB_PASS="${BASH_REMATCH[3]}"
DEV_DB="${BASH_REMATCH[4]}"

TEST_DB=""
if [[ -n "$TEST_URL" && $TEST_URL =~ $URL_RE ]]; then
  TEST_DB="${BASH_REMATCH[4]}"
fi

echo "Creating/updating role '$DB_USER' and database '$DEV_DB'${TEST_DB:+ and '$TEST_DB'}..."

# CREATEDB lets `prisma migrate dev` create its temporary shadow database.
sudo -u postgres psql -v ON_ERROR_STOP=1 --quiet <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN CREATEDB PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN CREATEDB PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DEV_DB} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DEV_DB}') \gexec
SQL

if [[ -n "$TEST_DB" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 --quiet <<SQL
SELECT 'CREATE DATABASE ${TEST_DB} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${TEST_DB}') \gexec
SQL
fi

echo "Done. Verify with:"
echo "  psql \"$DEV_URL\" -c 'select current_user, current_database();'"
