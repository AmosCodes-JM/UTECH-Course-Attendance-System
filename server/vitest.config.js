// Vitest configuration. API tests run against a separate, disposable test
// database (TEST_DATABASE_URL) - never against development data.
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({ quiet: true });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: './tests/globalSetup.js',
    // All API test files share one database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      APP_TIMEZONE: 'America/Jamaica',
      BCRYPT_ROUNDS: '4', // fast hashing in tests
      RATE_LIMIT_CHECKIN_MAX: '100000',
      RATE_LIMIT_REGISTER_MAX: '100000',
      RATE_LIMIT_LOGIN_MAX: '100000',
    },
  },
});
