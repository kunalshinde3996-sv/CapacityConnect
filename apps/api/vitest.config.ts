import { defineConfig } from 'vitest/config';

// Tests use fixed, non-secret values so they run the same on every machine.
// Route tests hit a separate database (created by docker/init-test-db.sql);
// override it with TEST_DATABASE_URL if yours lives elsewhere.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://capacity:capacity@localhost:5433/capacity_connect_test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
      CORS_ORIGINS: 'http://localhost:3000',
    },
    // Route tests share one database, so run test files one at a time.
    fileParallelism: false,
  },
});
