// Production bundles: the worker (main.mjs) and the hourly retention run (cleanup.mjs). hyperframes is not imported
// (its CLI is run from node_modules), and the templates and migrations are found through their packages, so the
// release keeps the workspace's node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: { main: 'src/main.ts', cleanup: 'src/cleanup-main.ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  external: ['@electric-sql/pglite', 'drizzle-orm/pglite', 'drizzle-orm/pglite/migrator', 'pg-native'],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  sourcemap: true,
  logLevel: 'info',
});
