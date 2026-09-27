// Fixed, non-secret values so tests run the same on every machine.
// Route tests hit a separate database (created by docker/init-test-db.sql);
// override it with TEST_DATABASE_URL if yours lives elsewhere.
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://capacity:capacity@localhost:5433/capacity_connect_test?schema=public',
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
  CORS_ORIGINS: 'http://localhost:3000',
  BCRYPT_COST: '4', // fastest allowed; only for tests
};
