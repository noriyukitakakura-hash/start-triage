import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { serviceWorkerPlugin } from './vite.sw-plugin';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // public/ 配下のうちオフライン動作に要るものを明示する。
    // og-image.png はクローラ向けで、端末側では不要なので含めない
    serviceWorkerPlugin({
      extraAssets: [
        '/manifest.webmanifest',
        '/apple-touch-icon.png',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/icon-maskable-512.png',
      ],
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // SPEC §4.5: 初回ロード gzip 300KB 未満
    chunkSizeWarningLimit: 300,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.{ts,tsx}'],
  },
});
