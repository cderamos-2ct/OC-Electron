import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const sharedAlias = {
  '@shared': path.resolve(__dirname, 'src/shared'),
  '@main': path.resolve(__dirname, 'src/main'),
  '@renderer': path.resolve(__dirname, 'src/renderer'),
  '@openclaw/core': path.resolve(__dirname, '../../packages/openclaw-core/src/index.ts'),
  'openclaw-db': path.resolve(__dirname, '../../packages/openclaw-db/src/index.ts'),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sharedAlias,
  },
  test: {
    globals: true,
    projects: [
      // ── Node project: main-process tests ──────────────────────────────────
      {
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: [
            'src/main/**/*.test.ts',
            'src/shared/**/*.test.ts',
            'tests/**/*.test.ts',
          ],
          setupFiles: ['./tests/setup.ts'],
          clearMocks: true,
        },
        resolve: { alias: sharedAlias },
      },
      // ── jsdom project: renderer / React component tests ───────────────────
      {
        plugins: [react()],
        test: {
          name: 'renderer',
          globals: true,
          environment: 'jsdom',
          include: [
            'src/renderer/**/*.test.tsx',
            'src/renderer/**/*.test.ts',
          ],
          setupFiles: ['./tests/setup-renderer.ts'],
          clearMocks: true,
        },
        resolve: { alias: sharedAlias },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75,
      },
    },
  },
});
