// Runs once before all tests: applies the Prisma migrations to the test
// database so it has exactly the same tables and constraints as production.
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

export default function setup() {
  dotenv.config({ quiet: true });
  // `npm run test:unit` sets this: unit tests never touch the database.
  if (process.env.SKIP_DB_SETUP === '1') return;
  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set in server/.env - the API tests need a separate test database.');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must point to a different database than DATABASE_URL (tests delete all data).');
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
