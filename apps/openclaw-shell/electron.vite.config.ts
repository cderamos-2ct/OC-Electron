import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['ws', 'pg', '@noble/ed25519', '@octokit/rest', '@googleworkspace/cli', '@openclaw/core', '@openclaw/gateway-client', 'openclaw-db', 'zustand'],
      }),
    ],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main'),
        '@openclaw/core': resolve('../../packages/openclaw-core/src/index.ts'),
        'openclaw-db': resolve('../../packages/openclaw-db/src/index.ts'),
        '@openclaw/gateway-client': resolve('../../packages/openclaw-gateway-client/src/index.ts'),
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: resolve('src/main/preload.ts'),
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer'),
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
  },
});
