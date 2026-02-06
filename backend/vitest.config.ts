import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-secret-for-unit-tests-minimum-16-chars',
      DATABASE_PATH: ':memory:',
      NODE_ENV: 'test',
    },
    setupFiles: ['src/test/setup.ts'],
  },
});
