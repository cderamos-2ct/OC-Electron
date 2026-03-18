import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    // Electron is launched via a custom fixture — see tests/e2e/fixtures.ts
    headless: false,
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.e2e.ts',
      use: {
        // Path to the compiled Electron entry point (built via electron-vite)
        executablePath: path.resolve(__dirname, 'node_modules/.bin/electron'),
      },
    },
  ],
});
