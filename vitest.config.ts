import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // CLI integration tests spawn real Node processes and a browser-free pipeline.
    fileParallelism: false,
  },
});
