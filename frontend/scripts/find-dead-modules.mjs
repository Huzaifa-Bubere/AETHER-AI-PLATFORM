/**
 * find-dead-modules — reports frontend source modules that are UNREACHABLE from
 * the application entrypoint.
 *
 * Why an import walk instead of counting importers per file: shadcn-style UI
 * primitives import each other (ui/sidebar → ui/button → ui/separator), so a
 * simple "how many files import X" count reports false negatives. Reachability
 * from src/main.tsx is the only sound test.
 *
 * It resolves:
 *   - relative imports ('./x', '../y')
 *   - the '@' path alias (→ src/)
 *   - extensionless specifiers and /index files
 *   - CSS / asset imports (followed, but they are reported as reachable)
 *
 * Usage:  node scripts/find-dead-modules.mjs [--json]
 * Read-only: it never modifies or deletes anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ENTRY = path.join(SRC, 'main.tsx');

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.json'];

const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

/** Every source file we consider removable. */
function allSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      allSourceFiles(full, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** All import-like specifiers in a file. */
function specifiersOf(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const specs = new Set();
  // import x from '...' / export ... from '...'
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    specs.add(m[1]);
  }
  // bare `import '...'`
  for (const m of text.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) specs.add(m[1]);
  return [...specs];
}

/** Resolve a specifier to a file on disk, or null when it is a package/asset. */
function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // bare package specifier — not our source

  const candidates = [base, ...EXTS.map(e => base + e), ...EXTS.map(e => path.join(base, `index${e}`))];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch { /* keep trying */ }
  }
  return null;
}

const reachable = new Set();
const queue = [ENTRY];
let guard = 0;
while (queue.length && guard++ < 20000) {
  const file = queue.pop();
  const key = path.resolve(file);
  if (reachable.has(key)) continue;
  reachable.add(key);
  for (const spec of specifiersOf(key)) {
    const resolved = resolveSpecifier(spec, key);
    if (resolved && !reachable.has(resolved)) queue.push(resolved);
  }
}

// Declaration files are pulled in by tsconfig, not by imports, so they are
// never "reachable" in this graph — keep them out of the dead set.
const all = allSourceFiles(SRC).filter(f => !f.endsWith('.d.ts'));
const dead = all.filter(f => !reachable.has(path.resolve(f)));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: all.length, reachable: reachable.size, dead: dead.map(rel) }, null, 2));
} else {
  console.log(`Reachable from ${rel(ENTRY)}: ${[...reachable].filter(f => f.startsWith(SRC)).length} module(s)`);
  console.log(`Total source modules:        ${all.length}`);
  console.log(`UNREACHABLE:                 ${dead.length}\n`);
  for (const f of dead.sort()) console.log(`  ${rel(f)}`);
  console.log('\nNothing was deleted. Review before removing.');
}
