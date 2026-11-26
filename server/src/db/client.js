// Single shared database client for the whole application.
//
// Prisma ORM 7 talks to PostgreSQL through the `pg` driver adapter. We also
// export the underlying pg Pool so the session store (connect-pg-simple) can
// reuse the same connection settings.
//
// `npx prisma generate` writes the client to src/generated/prisma as
// TypeScript files. Node.js 24 runs them directly (built-in type stripping),
// so this JavaScript project needs no extra build step to import it.
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { config } from '../config/env.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Close every database connection (used for graceful shutdown and tests). */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  if (!pool.ended) await pool.end();
}
