import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env by itself. Load it when present (local dev);
// in production the host injects real environment variables instead.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` does not need a real URL, so fall back to an empty string
    // instead of crashing; migrate/seed will fail loudly if it is missing.
    url: process.env.DATABASE_URL ?? '',
  },
});
