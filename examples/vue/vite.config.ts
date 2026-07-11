import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue()],
  resolve: {
    alias: {
      // Enable runtime template compilation for the string-template demo App
      vue: 'vue/dist/vue.esm-bundler.js',
      unilexical: resolve(__dirname, '../../src/index.ts'),
    },
  },
  server: { port: 5174 },
});
