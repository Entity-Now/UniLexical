import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      unilexical: resolve(__dirname, '../../src/index.ts'),
    },
  },
  server: { port: 5175 },
});
