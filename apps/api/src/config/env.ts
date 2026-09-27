import { existsSync } from 'node:fs';
import { z } from 'zod';

// Local dev reads apps/api/.env; hosted environments set real env vars instead.
// Tests set NODE_ENV=test and load .env.test (see vitest.config.ts).
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Comma-separated list of browser origins allowed to call the API (the Next.js app).
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  // bcrypt work factor. 10 in real use; tests lower it to 4 so they run fast.
  BCRYPT_COST: z.coerce.number().int().min(4).max(14).default(10),
  // Folder for uploaded files (local-disk storage) and the maximum upload size.
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(500).default(50),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast at startup with a readable message instead of a crash later on.
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
};
