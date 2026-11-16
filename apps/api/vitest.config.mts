import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@organza/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    pool: 'forks',
  },
});
