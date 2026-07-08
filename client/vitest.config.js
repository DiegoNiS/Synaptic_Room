// ============================================
// Synaptic Room — Client test runner (Vitest)
// ============================================
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // pure-logic tests; switch to 'jsdom' for component tests
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      thresholds: { lines: 40, functions: 40, branches: 40 },
    },
  },
});
