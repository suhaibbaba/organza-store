import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const shared = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const src = fileURLToPath(new URL('./src', import.meta.url));

/** Safari 15.4 (the shop's iPhone 7 Plus) and WebView2 are the oldest engines served. */
export const BROWSER_TARGETS = ['safari15', 'chrome108', 'firefox101', 'edge108'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@organza/shared', replacement: shared },
      { find: /^@web\//, replacement: `${src}/` },
    ],
  },
  build: { target: BROWSER_TARGETS, cssTarget: BROWSER_TARGETS, sourcemap: true },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
