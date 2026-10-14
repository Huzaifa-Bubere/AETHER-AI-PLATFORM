/**
 * Java test harness (spec §57–§70).
 *
 * These tests exist because the admin log panel surfaced a real, reproducible
 * failure:
 *
 *   Local execution failed for java: Main.java:24: error: duplicate class: Main
 *
 * The harness file is `Main.java` and it declares `public class Main`, so any
 * candidate who submitted their own `class Main` produced two declarations of the
 * same class and every Java test case failed to compile. The harness grades a
 * `Solution` class reflectively, so the submitted entry class is renamed to
 * Solution before it is appended.
 *
 * The structural assertions always run. When a JDK is present on the machine the
 * generated file is also handed to the real `javac`/`java`, which is what actually
 * proves the fix rather than merely describing it.
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { codeExecutionService } = require('../dist/services/codeExecution');

const javacPath = (() => {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac'));
  candidates.push('javac');
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
})();

const buildJava = (code) =>
  codeExecutionService.buildHarness('java', code, '[2,7,11,15]\n9', 'twoSum');

function compileAndRun(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-java-harness-'));
  try {
    fs.writeFileSync(path.join(dir, 'Main.java'), source, 'utf8');
    const javaPath = path.join(path.dirname(javacPath), process.platform === 'win32' ? 'java.exe' : 'java');
    const compile = spawnSync(javacPath, ['Main.java'], { cwd: dir, encoding: 'utf8' });
    if (compile.status !== 0) return { compiled: false, error: `${compile.stdout || ''}${compile.stderr || ''}` };
    const run = spawnSync(javaPath, ['-cp', dir, 'Main'], { cwd: dir, encoding: 'utf8' });
    return { compiled: true, status: run.status, stdout: (run.stdout || '').trim(), stderr: (run.stderr || '').trim() };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }
  }
}

describe('a submitted class Main no longer collides with the harness class', () => {
  const submittedMain = 'public class Main {\n' +
    '  public static void main(String[] a) { System.out.println("hello"); }\n' +
    '  public int[] twoSum(int[] nums, int target) { return new int[]{0, 1}; }\n' +
    '}';

  test('the generated file declares exactly one class Main', () => {
    const harness = buildJava(submittedMain);
    expect((harness.match(/class\s+Main\b/g) || []).length).toBe(1);
    expect(harness).not.toMatch(/public\s+class\s+Solution/);   // illegal in Main.java
    expect(harness).toContain('class Solution');
  });

  test('the renamed class keeps the candidate code intact', () => {
    const harness = buildJava(submittedMain);
    expect(harness).toContain('public int[] twoSum(int[] nums, int target)');
    expect(harness).toContain('System.out.println("hello")');
  });

  test('references to the submitted class are renamed with it', () => {
    const harness = buildJava('class Main {\n  public int twoSum(int[] n, int t) { return new Main().helper(n); }\n  int helper(int[] n) { return n.length; }\n}');
    expect(harness).not.toMatch(/new\s+Main\s*\(/);
    expect(harness).toContain('new Solution().helper(n)');
    expect((harness.match(/class\s+Main\b/g) || []).length).toBe(1);
  });

  test('static calls on the submitted class are renamed too', () => {
    const harness = buildJava('class Main {\n  public int twoSum(int[] n, int t) { return Main.helper(n); }\n  static int helper(int[] n) { return n.length; }\n}');
    expect(harness).not.toMatch(/\bMain\s*\./);
    expect(harness).toContain('Solution.helper(n)');
  });

  test('a submission that already uses the graded class name is untouched', () => {
    const template = 'class Solution {\n  public int[] twoSum(int[] nums, int target) { return new int[]{0, 1}; }\n}';
    const harness = buildJava(template);
    expect(harness).toContain(template);
    expect((harness.match(/class\s+Main\b/g) || []).length).toBe(1);
  });

  (javacPath ? describe : describe.skip)('against the real compiler', () => {
    test('a submission declaring its own Main compiles and runs', () => {
      const result = compileAndRun(buildJava(submittedMain));
      expect(result.compiled).toBe(true);
      // The harness is the entry point, so the candidate's own main does not print.
      expect(result.stdout).toBe('[0,1]');
    });

    test('the same submission used to fail to compile', () => {
      // Pre-fix shape: candidate class Main + harness class Main, verbatim.
      const broken = `public class Main {\n  public int[] twoSum(int[] nums, int target) { return new int[]{0,1}; }\n}\n\npublic class Main {\n  public static void main(String[] a) {}\n}`;
      const result = compileAndRun(broken);
      expect(result.compiled).toBe(false);
      expect(result.error).toMatch(/duplicate class: Main/);
    });

    test('the graded template still compiles and prints the result', () => {
      const result = compileAndRun(buildJava('class Solution {\n  public int[] twoSum(int[] nums, int target) { return new int[]{2, 7}; }\n}'));
      expect(result.compiled).toBe(true);
      expect(result.stdout).toBe('[2,7]');
    });

    test('a helper class in the submission is not renamed', () => {
      const result = compileAndRun(buildJava(
        'class Helper { static int[] of(int a, int b) { return new int[]{a, b}; } }\n' +
        'class Main { public int[] twoSum(int[] n, int t) { return Helper.of(1, 2); } }',
      ));
      expect(result.compiled).toBe(true);
      expect(result.stdout).toBe('[1,2]');
    });
  });
});
