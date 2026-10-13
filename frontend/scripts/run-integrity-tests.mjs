/**
 * Run the integrity rules-engine tests.
 *
 * WHY THIS EXISTS: this project has no frontend test runner (no Jest, no Vitest,
 * no test script), but spec §34 requires the rules engine to be testable without
 * webcam hardware. Rather than add a test framework the project does not
 * otherwise use, this bundles the pure TypeScript with the esbuild that is
 * already a build dependency and runs it on Node's built-in test runner.
 *
 * Zero new dependencies. `node:test` and `node:assert` stay external so Node's
 * native implementations are used.
 */
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tmp', 'integrity-tests');
const outFile = path.join(outDir, 'integrityRules.test.cjs');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/app/features/integrity/rules/integrityRules.test.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: outFile,
  external: ['node:test', 'node:assert', 'node:assert/strict'],
  logLevel: 'warning',
});

const child = spawn(process.execPath, [outFile], { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`integrity rules tests killed by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
