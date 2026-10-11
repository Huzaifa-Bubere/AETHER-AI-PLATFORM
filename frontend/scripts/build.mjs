/**
 * AETHER — frontend production build entry.
 *
 * WHY THIS FILE EXISTS
 * Vite reads `NODE_ENV` from the .env files it loads and uses it to decide
 * whether the build is a production build (`isProduction = process.env.NODE_ENV
 * === "production"`). A stray `NODE_ENV=development` line in `frontend/.env`
 * therefore made `vite build` — which reports success and exits 0 — silently
 * emit a DEVELOPMENT bundle:
 *
 *   - the dev JSX runtime (jsxDEV + file/line info) instead of the prod one
 *   - React development warnings and dev-only diagnostics kept in the output
 *   - ~463 kB entry chunk instead of ~252 kB
 *
 * `vite build --mode production` does NOT fix it, and neither does assigning
 * `process.env.NODE_ENV` inside vite.config.ts (Vite re-applies the .env value
 * after the config file has been evaluated). The only reliable fix is to set
 * NODE_ENV in the environment BEFORE Vite starts, which is what this script
 * does — so the shipped bundle never depends on a local .env file.
 *
 * Verified: `npm run build` now produces 0 `jsxDEV` occurrences.
 */
process.env.NODE_ENV = 'production';

const { build } = await import('vite');

const modeArgIndex = process.argv.indexOf('--mode');
const mode = modeArgIndex !== -1 ? process.argv[modeArgIndex + 1] : 'production';

await build({ mode });
