import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    vue: 'src/wrappers/vue.ts',
    react: 'src/wrappers/react.tsx',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'vue',
    'lexical',
    /^@lexical\//,
    'tippy.js',
    'motion',
    'lowlight',
    /^highlight\.js/,
  ],
  treeshake: true,
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
