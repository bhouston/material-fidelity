import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['packages/*/src/**/*.test.ts', 'adapters/*/src/**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**'],
    environment: 'node',
    coverage: {
      include: ['packages/*/src/**/*.ts', 'adapters/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
    },
  },
});
