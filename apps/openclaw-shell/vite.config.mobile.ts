import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/mobile'),
  publicDir: resolve(__dirname, 'src/mobile/public'),
  build: {
    outDir: resolve(__dirname, 'dist/mobile'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/mobile/index.html'),
        sw: resolve(__dirname, 'src/mobile/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'sw') return 'sw.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 3002,
    host: '0.0.0.0', // Accessible over Tailscale
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@mobile': resolve(__dirname, 'src/mobile'),
    },
  },
});
