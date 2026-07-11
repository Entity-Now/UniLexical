import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * GitHub Pages project sites are served under /<repo>/ .
 * Set GITHUB_PAGES=true (and optionally GITHUB_REPOSITORY=owner/repo)
 * in CI so the base path is correct.
 */
function pagesBase(): string {
  if (process.env.GITHUB_PAGES !== 'true') return '/';
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  return repo ? `/${repo}/` : './';
}

export default defineConfig({
  root: resolve(__dirname),
  base: pagesBase(),
  resolve: {
    alias: {
      unilexical: resolve(__dirname, '../../src/index.ts'),
    },
  },
  server: { port: 5173 },
  build: {
    outDir: resolve(__dirname, '../../dist-demo'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
