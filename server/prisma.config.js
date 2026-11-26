// Prisma ORM 7 CLI configuration: where the schema and migrations live, how
// to seed, and which database the CLI (migrate, studio) connects to.
import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ quiet: true });

export default defineConfig({
  schema: 'src/db/schema.prisma',
  migrations: {
    path: 'src/db/migrations',
    seed: 'node src/db/seed.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
