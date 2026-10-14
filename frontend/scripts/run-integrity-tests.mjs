/**
 * Run the interview-integrity test suites (pure, camera-free).
 *
 * WHY THIS EXISTS: this project has no frontend test runner (no Jest, no Vitest,
 * no test script), but the integrity rules engine and the MediaPipe landmark
 * geometry must be testable without webcam hardware. Rather than add a test
 * framework the project does not otherwise use, this bundles the pure
 * TypeScript with the esbuild that is already a build dependency and runs it on
 * Node's built-in test runner.
 *
 * Zero new dependencies. `node:test` and `node:assert` stay external so Node's
 * native implementations are used.
 *
 * Suites:
 *   rules/integrityRules.test.ts              — the integrity state machine
 *   eyeTracking/landmarkGeometry.test.ts      — MediaPipe landmark geometry,
 *                                               gaze, head pose, overlay mapping
 */
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tmp', 'integrity-tests');

const SUITES = [
  'src/app/features/integrity/rules/integrityRules.test.ts',
  'src/app/features/integrity/eyeTracking/landmarkGeometry.test.ts',
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function runSuite(outFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [outFile], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`${path.basename(outFile)} killed by ${signal}`));
      resolve(code ?? 1);
    });
  });
}

let failed = 0;
for (const suite of SUITES) {
  const outFile = path.join(outDir, `${path.basename(suite, '.ts')}.cjs`);
  console.log(`\n=== ${suite} ===`);
  await build({
    entryPoints: [path.join(root, suite)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: outFile,
    external: ['node:test', 'node:assert', 'node:assert/strict'],
    logLevel: 'warning',
  });
  const code = await runSuite(outFile);
  if (code !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} integrity suite(s) FAILED`);
  process.exit(1);
}
console.log('\nall integrity suites passed');
