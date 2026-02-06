import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use jsdom so we can test React DOM/hover behavior
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
});
