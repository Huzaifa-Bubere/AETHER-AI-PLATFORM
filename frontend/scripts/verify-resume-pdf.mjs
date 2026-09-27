/**
 * Cross-platform wrapper: render the sample resume PDFs, then run the AETHER
 * resume parser roundtrip check (spec §24, §69).
 *
 *   cd frontend && npm run resume:pdf-verify
 *
 * Interpreter candidates are tried in order; the project virtualenv is used when
 * present so the check exercises the real parser dependencies.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const aiServer = join(repoRoot, 'ai-server');

const candidates = [
  join(aiServer, '.venv', 'Scripts', 'python.exe'),
  join(aiServer, '.venv', 'bin', 'python'),
  join(aiServer, 'venv', 'Scripts', 'python.exe'),
  join(aiServer, 'venv', 'bin', 'python'),
  'python',
  'python3',
];

function run(command, args, label) {
  console.log(`\n$ ${command} ${args.join(' ')}   (${label})`);
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: label === 'render' ? join(repoRoot, 'frontend') : aiServer });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

// 1. Render the PDFs from the real builder templates.
const render = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['esbuild', 'scripts/render-sample-resume.tsx', '--bundle', '--platform=node', '--format=cjs',
    '--outfile=tmp/render-sample-resume.cjs', '--external:@react-pdf/renderer'],
  { stdio: 'inherit', cwd: join(repoRoot, 'frontend'), shell: process.platform === 'win32' },
);
if (render.status !== 0) {
  console.error('✗ Could not bundle the PDF renderer.');
  process.exit(render.status ?? 1);
}
const node = spawnSync(process.execPath, ['tmp/render-sample-resume.cjs'], { stdio: 'inherit', cwd: join(repoRoot, 'frontend') });
if (node.status !== 0) {
  console.error('✗ Could not render the sample resume PDFs.');
  process.exit(node.status ?? 1);
}

// 2. Parse them back with the real parser service.
const script = join(aiServer, 'scripts', 'verify_resume_roundtrip.py');
const python = candidates.find(c => c === 'python' || c === 'python3' || existsSync(c));
if (!python) {
  console.error('✗ No Python interpreter found. Run ai-server/scripts/verify_resume_roundtrip.py manually.');
  process.exit(2);
}

const status = run(python, [script], 'python');
process.exit(status);
