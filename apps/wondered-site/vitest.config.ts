import { defineConfig } from 'vitest/config';

// Tests only cover pure helpers in src/lib, so plain Node is enough (no browser).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
