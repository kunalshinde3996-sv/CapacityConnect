import { execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { testEnv } from './testEnv.js';

// Runs once before all test files: bring the test database schema up to date.
// `migrate deploy` only applies committed migrations and never prompts or resets.
export default function setup() {
  try {
    execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: testEnv.DATABASE_URL } });
  } catch (err) {
    const output = (err as { stderr?: Buffer; stdout?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Could not migrate the test database. Is Postgres running (npm run db:up)?\n${output}`);
  }

  // Runs once after all test files: remove files uploaded by the tests.
  return () => rm(testEnv.UPLOAD_DIR, { recursive: true, force: true });
}
