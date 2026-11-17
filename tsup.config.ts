import { defineConfig, type Options } from 'tsup';

// Peers and Node built-ins (used only by the server-side `next` entry) stay external.
const external = ['react', 'react-dom', 'lucide-react', 'react-hot-toast', /^next(\/.*)?$/, /^node:/];

const shared: Options = {
  format: ['cjs', 'esm'],
  dts: true,
  external,
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
};

export default defineConfig([
  // Framework-free core, adapters and Next.js server helpers: no "use client".
  {
    ...shared,
    clean: false,
    entry: {
      index: 'src/index.ts',
      adapters: 'src/adapters/index.ts',
      next: 'src/next/index.ts',
    },
  },
  // React UI (public-site hooks and admin studio): every output is a client module.
  {
    ...shared,
    clean: false,
    entry: {
      site: 'src/site/index.ts',
      admin: 'src/admin/index.ts',
    },
    banner: { js: '"use client";' },
  },
  // `visual-cms` command line tool (Node only, no React).
  {
    format: ['cjs'],
    platform: 'node',
    target: 'node18',
    clean: false,
    dts: false,
    entry: { cli: 'src/cli/index.ts' },
    banner: { js: '#!/usr/bin/env node' },
  },
]);
