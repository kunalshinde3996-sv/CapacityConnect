import { defineConfig } from 'vitest/config';
import { testEnv } from './tests/testEnv.js';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    env: testEnv,
    globalSetup: ['tests/globalSetup.ts'],
    // Route tests share one database, so run test files one at a time.
    fileParallelism: false,
  },
});
