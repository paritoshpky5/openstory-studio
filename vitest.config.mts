import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'threads',
    isolate: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(configDirectory, './src'),
    },
  },
});
