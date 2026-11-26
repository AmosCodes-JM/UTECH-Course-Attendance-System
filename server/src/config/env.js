// Loads and validates environment variables once, so the rest of the app can
// import a typed, trusted `config` object instead of reading process.env.
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const toBool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const toInt = (fallback) => z.coerce.number().int().positive().default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: toInt(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  // Comma-separated list of browser origins allowed to call the API.
  CLIENT_URL: z.string().default('http://localhost:5173'),
  // Timezone used for "today" (current semester) and attendance date filters.
  APP_TIMEZONE: z.string().default('America/Jamaica'),
  SESSION_MAX_AGE_HOURS: toInt(8),
  // Set to 1 (or the number of proxies) when running behind a reverse proxy
  // that terminates HTTPS, so secure cookies and client IPs work correctly.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Serve the built React app (client/dist) from Express in production.
  SERVE_CLIENT: toBool(false),
  BCRYPT_ROUNDS: toInt(12),
  // Rate limits (requests per window, per client IP).
  RATE_LIMIT_CHECKIN_MAX: toInt(600),
  RATE_LIMIT_CHECKIN_WINDOW_MIN: toInt(10),
  RATE_LIMIT_REGISTER_MAX: toInt(30),
  RATE_LIMIT_REGISTER_WINDOW_MIN: toInt(15),
  RATE_LIMIT_LOGIN_MAX: toInt(10),
  RATE_LIMIT_LOGIN_WINDOW_MIN: toInt(15),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
  console.error('Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  sessionSecret: env.SESSION_SECRET,
  clientOrigins: env.CLIENT_URL.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  timezone: env.APP_TIMEZONE,
  sessionMaxAgeMs: env.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
  trustProxy: env.TRUST_PROXY,
  serveClient: env.SERVE_CLIENT,
  bcryptRounds: env.BCRYPT_ROUNDS,
  rateLimits: {
    checkIn: { max: env.RATE_LIMIT_CHECKIN_MAX, windowMs: env.RATE_LIMIT_CHECKIN_WINDOW_MIN * 60_000 },
    register: { max: env.RATE_LIMIT_REGISTER_MAX, windowMs: env.RATE_LIMIT_REGISTER_WINDOW_MIN * 60_000 },
    login: { max: env.RATE_LIMIT_LOGIN_MAX, windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MIN * 60_000 },
  },
};
