import axios from 'axios';
import logger from '../utils/logger';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

interface CodeExecutionRequest {
  language: string;
  code: string;
  stdin?: string;
  functionName?: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
}

interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  memory?: number;
  testResults?: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    executionTime?: number;
    error?: string;
  }>;
}

// Language ID mapping for Piston API
const LANGUAGE_MAP: { [key: string]: string } = {
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  typescript: 'typescript',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
};

class CodeExecutionService {
  private pistonUrl: string;
  private judge0Url: string;
  private useJudge0: boolean;

  constructor() {
    this.pistonUrl = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston';
    this.judge0Url = process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com';
    this.useJudge0 = process.env.CODE_EXECUTION_SERVICE === 'judge0';
  }

  // Locates javac/java without relying on PATH: checks JAVA_HOME first, then
  // scans the common Windows install roots for JDK distributions (Microsoft,
  // Eclipse Adoptium/Temurin, Oracle). Falls back to the bare command name so
  // it still works wherever PATH resolution is fine (Linux/Mac dev, CI, etc).
  private async resolveJavaBinary(name: 'javac' | 'java'): Promise<string> {
    const exe = process.platform === 'win32' ? `${name}.exe` : name;

    const javaHome = process.env.JAVA_HOME;
    if (javaHome) {
      const candidate = path.join(javaHome, 'bin', exe);
      try { await fs.access(candidate); return candidate; } catch { /* keep looking */ }
    }

    if (process.platform === 'win32') {
      const roots = [
        'C:\\Program Files\\Microsoft',
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Java',
        'C:\\Program Files\\AdoptOpenJDK',
        'C:\\Program Files (x86)\\Java',
      ];
      for (const root of roots) {
        try {
          const entries = await fs.readdir(root);
          // Prefer the lexicographically-last entry (newest version string sorts last, e.g. jdk-21 > jdk-17)
          for (const entry of entries.sort().reverse()) {
            const candidate = path.join(root, entry, 'bin', exe);
            try { await fs.access(candidate); return candidate; } catch { /* try next */ }
          }
        } catch { /* root doesn't exist on this machine — skip */ }
      }
    }

    return name; // last resort: hope it's on PATH
  }

  // ── Local execution fallback ────────────────────────────────────────────────
  private async executeLocally(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_UNSAFE_LOCAL_CODE_EXECUTION !== 'true') {
      return { success: false, error: 'Local code execution is disabled. Configure an isolated execution service.' };
    }
    const language = request.language;
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mock-interview-exec-'));
    const fileName = this.getFileName(language);
    const filePath = path.join(tmpDir, fileName);
    await fs.writeFile(filePath, request.code, 'utf8');

    // Plain spawn() (no shell) already handles absolute paths containing spaces
    // correctly on Windows — using shell:true here would be counterproductive,
    // since shell mode concatenates args without escaping (see Node's DEP0190),
    // which corrupts a spaced path instead of fixing it.
    const spawnOpts = { cwd: tmpDir, windowsHide: true };

    const run = (command: string, args: string[]) =>
      new Promise<CodeExecutionResult>((resolve) => {
        const start = Date.now();
        const proc = spawn(command, args, spawnOpts);
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          try { proc.kill(); } catch { /* ignore */ }
          resolve({ success: false, error: 'Local execution timeout', output: stdout.trim(), executionTime: Date.now() - start });
        }, 12000);

        proc.stdout.on('data', (d) => { stdout += String(d); });
        proc.stderr.on('data', (d) => { stderr += String(d); });
        proc.on('error', (err) => {
          clearTimeout(timer);
          resolve({ success: false, error: err.message, output: stdout.trim(), executionTime: Date.now() - start });
        });
        proc.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            success: code === 0 && !stderr.trim(),
            output: stdout.trim(),
            error: stderr.trim() || (code === 0 ? undefined : `Process exited with code ${code}`),
            executionTime: Date.now() - start,
          });
        });
      });

    // Compile-only runner: success is based on exit code, since compilers
    // (javac/g++/gcc) commonly print warnings to stderr even on a clean build.
    const compile = (command: string, args: string[]) =>
      new Promise<{ success: boolean; error?: string }>((resolve) => {
        const proc = spawn(command, args, spawnOpts);
        let stderr = '';
        const timer = setTimeout(() => {
          try { proc.kill(); } catch { /* ignore */ }
          resolve({ success: false, error: 'Compilation timeout' });
        }, 15000);
        proc.stderr.on('data', (d) => { stderr += String(d); });
        proc.on('error', (err) => {
          clearTimeout(timer);
          resolve({ success: false, error: err.message });
        });
        proc.on('close', (code) => {
          clearTimeout(timer);
          resolve({ success: code === 0, error: code === 0 ? undefined : (stderr.trim() || `Compilation failed with exit code ${code}`) });
        });
      });

    try {
      if (language === 'python') {
        const py = await run('python', [filePath]);
        if (py.success || !/ENOENT|not recognized/i.test(py.error || '')) return py;
        return run('py', ['-3', filePath]);
      }
      if (language === 'javascript') return run('node', [filePath]);

      // Java: compile with javac, then run the generated .class with java
      if (language === 'java') {
        const javacPath = await this.resolveJavaBinary('javac');
        const javaPath = await this.resolveJavaBinary('java');
        const compileResult = await compile(javacPath, [fileName]);
        if (!compileResult.success) {
          return { success: false, error: compileResult.error || 'Compilation failed' };
        }
        const className = path.basename(fileName, '.java'); // matches getFileName() -> "Main.java"
        return run(javaPath, ['-cp', tmpDir, className]);
      }

      // C++: compile with g++, then run the produced binary
      if (language === 'cpp') {
        const binPath = path.join(tmpDir, process.platform === 'win32' ? 'a.exe' : 'a.out');
        const compileResult = await compile('g++', ['-O2', '-std=c++17', fileName, '-o', binPath]);
        if (!compileResult.success) {
          return { success: false, error: compileResult.error || 'Compilation failed' };
        }
        return run(binPath, []);
      }

      // C: compile with gcc, then run the produced binary
      if (language === 'c') {
        const binPath = path.join(tmpDir, process.platform === 'win32' ? 'a.exe' : 'a.out');
        const compileResult = await compile('gcc', ['-O2', fileName, '-o', binPath]);
        if (!compileResult.success) {
          return { success: false, error: compileResult.error || 'Compilation failed' };
        }
        return run(binPath, []);
      }

      return { success: false, error: `Local execution not supported for '${language}'` };
    } finally {
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // ── Piston API ──────────────────────────────────────────────────────────────
  async executeWithPiston(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const baseCandidates = Array.from(new Set([
      this.pistonUrl.replace(/\/+$/, ''),
      'https://emkc.org/api/v2/piston',
      'https://piston.rs/api/v2',
    ]));
    const payload = {
      language: LANGUAGE_MAP[request.language] || request.language,
      version: '*',
      files: [{ name: this.getFileName(request.language), content: request.code }],
      stdin: request.stdin || '',
      args: [],
      compile_timeout: 10000,
      run_timeout: 5000,
      compile_memory_limit: -1,
      run_memory_limit: -1,
    };

    let lastError: any = null;
    for (const base of baseCandidates) {
      const startTime = Date.now();
      try {
        const response = await axios.post(`${base}/execute`, payload, { timeout: 20000 });
        const executionTime = Date.now() - startTime;
        if (response.data?.run) {
          const output = response.data.run.stdout || '';
          const error = response.data.run.stderr || '';
          return {
            success: !error && response.data.run.code === 0,
            output: output.trim(),
            error: error.trim() || undefined,
            executionTime,
          };
        }
        lastError = new Error(`Invalid execution response from ${base}`);
      } catch (error: any) {
        lastError = error;
        logger.warn(`Piston endpoint failed (${base}): ${error?.response?.status || error?.message}`);
      }
    }

    if (process.env.JUDGE0_API_KEY) {
      logger.warn('All Piston endpoints failed; falling back to Judge0');
      return this.executeWithJudge0(request);
    }

    logger.error('Piston execution error:', lastError);
    return { success: false, error: lastError?.message || 'Code execution failed' };
  }

  // ── Judge0 API ──────────────────────────────────────────────────────────────
  async executeWithJudge0(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    try {
      const apiKey = process.env.JUDGE0_API_KEY;
      if (!apiKey) throw new Error('Judge0 API key not configured');

      const submitResponse = await axios.post(
        `${this.judge0Url}/submissions`,
        {
          source_code: Buffer.from(request.code).toString('base64'),
          language_id: this.getJudge0LanguageId(request.language),
          stdin: request.stdin ? Buffer.from(request.stdin).toString('base64') : undefined,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        }
      );

      const token = submitResponse.data.token;
      let attempts = 0;
      while (attempts < 10) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const resultResponse = await axios.get(`${this.judge0Url}/submissions/${token}`, {
          headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' },
        });
        const result = resultResponse.data;
        if (result.status.id > 2) {
          return {
            success: result.status.id === 3,
            output: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '',
            error: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : undefined,
            executionTime: parseFloat(result.time) * 1000,
            memory: parseFloat(result.memory),
          };
        }
        attempts++;
      }
      return { success: false, error: 'Execution timeout' };
    } catch (error: any) {
      logger.error('Judge0 execution error:', error);
      return { success: false, error: error.message || 'Code execution failed' };
    }
  }

  // ── Execute with test cases ─────────────────────────────────────────────────
  async executeWithTestCases(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    if (!request.testCases || request.testCases.length === 0) {
      return this.execute(request);
    }

    const testResults = [];

    for (const testCase of request.testCases) {
      const wrappedCode = this.wrapCodeWithTestCase(
        request.language,
        request.code,
        testCase.input,
        request.functionName
      );

      logger.info(`Executing test — lang: ${request.language}, input: ${testCase.input.substring(0, 80)}`);

      const result = await this.execute({ ...request, code: wrappedCode, stdin: '' });

      const rawOutput   = (result.output || '').trim();
      const rawExpected = testCase.expectedOutput.trim();

      const normalizedActual   = this.normalizeOutput(rawOutput);
      const normalizedExpected = this.normalizeOutput(rawExpected);
      const passed = normalizedActual === normalizedExpected;

      logger.info(`Test result — actual: "${rawOutput}", expected: "${rawExpected}", passed: ${passed}`);

      testResults.push({
        input: testCase.input,
        expectedOutput: rawExpected,
        actualOutput: rawOutput || (result.error ? `[Error] ${result.error}` : ''),
        passed,
        executionTime: result.executionTime,
        error: result.error,
      });
    }

    return {
      success: testResults.every((r) => r.passed),
      testResults,
      output: testResults.map((r) => r.actualOutput).join('\n'),
    };
  }

  // ── Output normalization ────────────────────────────────────────────────────
  /**
   * Normalize output for comparison.
   * Handles: JSON arrays/objects, strings, integers, floats, booleans, null.
   * Strips all whitespace after normalization so [1, 2] == [1,2].
   */
  private normalizeOutput(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '') return '';

    // Try JSON parse first (handles arrays, objects, booleans, null, numbers)
    try {
      const parsed = JSON.parse(trimmed);
      // Re-stringify then strip all whitespace to normalize [1, 2] vs [1,2]
      return JSON.stringify(parsed).replace(/\s+/g, '').toLowerCase();
    } catch {
      // Not JSON — handle Python True/False/None -> true/false/null
      const lower = trimmed.toLowerCase();
      if (lower === 'true')  return 'true';
      if (lower === 'false') return 'false';
      if (lower === 'none' || lower === 'null') return 'null';
      // Strip whitespace for plain string comparison too
      return trimmed.replace(/\s+/g, '').toLowerCase();
    }
  }

  // ── Code wrapper ────────────────────────────────────────────────────────────
  /**
   * Wraps user code with a test harness that:
   * 1. Parses multi-line test input (e.g. "[2,7,11,15]\n9")
   * 2. Detects the user's function automatically
   * 3. Calls it with the correct arguments
   * 4. Prints the result in the correct format for ALL types:
   *    - Arrays/dicts  → JSON
   *    - Strings       → plain string (no quotes)
   *    - Integers/floats → plain number
   *    - Booleans      → true/false
   *    - None/null     → empty string
   */
  private wrapCodeWithTestCase(
    language: string,
    userCode: string,
    testInput: string,
    functionName?: string
  ): string {
    const inputLines = testInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    switch (language) {

      // ── Python ──────────────────────────────────────────────────────────────
      case 'python': {
        const inputLinesJson = JSON.stringify(inputLines);
        const targetFn = functionName || '';

        return `import json, ast, sys, inspect, types

${userCode}

# ── Test harness ──────────────────────────────────────────────────────────────
def _parse(s):
    s = s.strip()
    try:
        return json.loads(s)
    except Exception:
        try:
            return ast.literal_eval(s)
        except Exception:
            return s

_input_lines = ${inputLinesJson}
_args = [_parse(line) for line in _input_lines]

def _get_param_count(fn):
    try:
        return len(inspect.signature(fn).parameters)
    except Exception:
        return None

def _expand_args(args, fn):
    """Normalize args so fn(*result) always receives the right number of arguments."""
    n_params = _get_param_count(fn)

    # Already the right number of args
    if n_params is not None and len(args) == n_params:
        return args

    # Single dict: map keys to positional params
    if len(args) == 1 and isinstance(args[0], dict):
        payload = args[0]
        try:
            param_names = list(inspect.signature(fn).parameters.keys())
            if param_names and all(name in payload for name in param_names):
                return [payload[name] for name in param_names]
        except Exception:
            pass

    # Single list/tuple with the right number of items
    if len(args) == 1 and isinstance(args[0], (list, tuple)):
        inner = list(args[0])
        if n_params is not None and len(inner) == n_params:
            return inner

    # Single nested list: [[a, b]] -> [a, b]
    if len(args) == 1 and isinstance(args[0], list) and len(args[0]) > 0:
        if isinstance(args[0][0], (list, dict)):
            return args[0]

    return args

# Detect user-defined function
_user_funcs = [
    name for name, obj in list(globals().items())
    if callable(obj) and isinstance(obj, types.FunctionType)
    and not name.startswith('_')
]

if not _user_funcs:
    print("ERROR: No function found in submitted code", file=sys.stderr)
    sys.exit(1)

_preferred = ${JSON.stringify(targetFn)}
if _preferred and _preferred in globals() and callable(globals()[_preferred]):
    _fn = globals()[_preferred]
else:
    _fn = globals()[_user_funcs[-1]]

_call_args = _expand_args(_args, _fn)

# Try calling with progressively simpler argument forms
_result = None
_success = False

for _attempt_args in [
    _call_args,
    [_call_args],
    _args,
    [_args],
]:
    try:
        _result = _fn(*_attempt_args)
        _success = True
        break
    except (TypeError, IndexError, ValueError):
        continue
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if not _success:
    print("ERROR: Could not call function with provided arguments", file=sys.stderr)
    sys.exit(1)

# ── Universal output printer ──────────────────────────────────────────────────
# Arrays/dicts/tuples -> JSON  |  strings -> plain  |  numbers/bools -> str  |  None -> ""
if isinstance(_result, (list, dict, tuple)):
    print(json.dumps(_result))
elif _result is None:
    print("")
else:
    print(str(_result))
`;
      }

      // ── JavaScript / TypeScript ──────────────────────────────────────────────
      case 'javascript':
      case 'typescript': {
        const inputLinesJson = JSON.stringify(inputLines);
        const preferredFn = functionName || '';

        // Escape backticks in user code for template literal embedding
        const escapedCode = userCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

        return `${userCode}

// ── Test harness ──────────────────────────────────────────────────────────────
(function() {
  const _inputLines = ${inputLinesJson};

  function _parse(s) {
    try { return JSON.parse(s); } catch(e) { return s; }
  }

  const _args = _inputLines.map(_parse);

  function _pickFunctionName() {
    const preferred = ${JSON.stringify(preferredFn)};
    if (preferred && typeof eval(preferred) === 'function') return preferred;

    // Scan source for function declarations / arrow functions
    const src = \`${escapedCode}\`;
    const patterns = [
      /function\\s+(\\w+)\\s*\\(/g,
      /(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>/g,
    ];
    let lastName = '';
    for (const re of patterns) {
      let m;
      while ((m = re.exec(src)) !== null) {
        const name = m[1];
        if (name && !['_parse','_pickFunctionName','_getCallable','_expandArgs'].includes(name)) {
          lastName = name;
        }
      }
    }
    return lastName || preferred;
  }

  function _getCallable(name) {
    if (!name) return null;
    try {
      const fn = eval(name);
      if (typeof fn === 'function') return fn;
    } catch {}
    // Class-based: class Solution { methodName(...) {} }
    try {
      if (typeof Solution !== 'undefined') {
        const inst = new Solution();
        if (typeof inst[name] === 'function') return inst[name].bind(inst);
      }
    } catch {}
    return null;
  }

  function _expandArgs(args, fn) {
    // Single object arg: map keys to params
    if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const payload = args[0];
      const sig = String(fn).match(/\\(([^)]*)\\)/);
      if (sig && sig[1]) {
        const params = sig[1].split(',').map(p => p.trim().split('=')[0].trim()).filter(Boolean);
        if (params.length > 0 && params.every(p => Object.prototype.hasOwnProperty.call(payload, p))) {
          return params.map(p => payload[p]);
        }
      }
    }
    return args;
  }

  // ── Universal output printer ────────────────────────────────────────────────
  function _printResult(result) {
    if (result === null || result === undefined) {
      process.stdout.write('\\n');
      return;
    }
    if (Array.isArray(result) || (typeof result === 'object')) {
      console.log(JSON.stringify(result));
    } else if (typeof result === 'boolean') {
      console.log(result.toString());
    } else {
      // string, number, etc. — print as-is
      console.log(String(result));
    }
  }

  const _fnName = _pickFunctionName();
  const _fn = _getCallable(_fnName);

  if (!_fn) {
    process.stderr.write('ERROR: No callable solution function found\\n');
    process.exit(1);
  }

  try {
    const _callArgs = _expandArgs(_args, _fn);
    const _result = _fn(..._callArgs);

    // Handle Promise (async functions)
    if (_result && typeof _result.then === 'function') {
      _result.then(_printResult).catch(e => {
        process.stderr.write('ERROR: ' + e.message + '\\n');
        process.exit(1);
      });
    } else {
      _printResult(_result);
    }
  } catch(e) {
    process.stderr.write('ERROR: ' + e.message + '\\n');
    process.exit(1);
  }
})();
`;
      }

      // ── Java ─────────────────────────────────────────────────────────────────
      // Generic like the Python/JS harnesses: finds the submitted method via
      // reflection instead of assuming a hardcoded name like "twoSum". This
      // supports both classic signatures (e.g. `int[] twoSum(int[], int)`)
      // and the generic `Object solve(Object... args)` template.
      case 'java': {
        const rawInputsJavaArray = inputLines
          .map((l) => `"${l.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
          .join(', ');
        const preferredFn = (functionName || '').replace(/[^a-zA-Z0-9_]/g, '');

        return `import java.util.*;
import java.lang.reflect.*;

${userCode}

public class Main {
    static int[] parseIntArray(String s) {
        s = s.trim().replaceAll("[\\\\[\\\\]]", "");
        if (s.isEmpty()) return new int[0];
        String[] parts = s.split(",");
        int[] arr = new int[parts.length];
        for (int i = 0; i < parts.length; i++) arr[i] = Integer.parseInt(parts[i].trim());
        return arr;
    }

    // Best-effort parse of a raw input line into an Object (int[], Integer, Long, Double, Boolean, or String)
    static Object parseArg(String raw) {
        String t = raw.trim();
        if (t.startsWith("[")) return parseIntArray(t);
        if (t.length() >= 2 && t.startsWith("\\"") && t.endsWith("\\"")) return t.substring(1, t.length() - 1);
        if (t.equalsIgnoreCase("true") || t.equalsIgnoreCase("false")) return Boolean.parseBoolean(t);
        try { return Integer.parseInt(t); } catch (NumberFormatException ignored) {}
        try { return Long.parseLong(t); } catch (NumberFormatException ignored) {}
        try { return Double.parseDouble(t); } catch (NumberFormatException ignored) {}
        return t;
    }

    // Coerce a parsed argument to the exact type a reflected method parameter expects
    static Object coerce(Object value, Class<?> type) {
        if (value == null || type.isInstance(value)) return value;
        if (value instanceof Number) {
            Number n = (Number) value;
            if (type == int.class || type == Integer.class) return n.intValue();
            if (type == long.class || type == Long.class) return n.longValue();
            if (type == double.class || type == Double.class) return n.doubleValue();
            if (type == float.class || type == Float.class) return n.floatValue();
            if (type == short.class || type == Short.class) return n.shortValue();
        }
        return value;
    }

    static String formatResult(Object result) {
        if (result == null) return "";
        if (result instanceof int[]) return Arrays.toString((int[]) result).replace(", ", ",");
        if (result instanceof long[]) return Arrays.toString((long[]) result).replace(", ", ",");
        if (result instanceof double[]) return Arrays.toString((double[]) result).replace(", ", ",");
        if (result instanceof boolean[]) return Arrays.toString((boolean[]) result).replace(", ", ",");
        if (result instanceof Object[]) return Arrays.deepToString((Object[]) result).replace(", ", ",");
        return String.valueOf(result);
    }

    public static void main(String[] args) throws Exception {
        Object[] rawInputs = new Object[] { ${rawInputsJavaArray} };
        Object[] parsedArgs = new Object[rawInputs.length];
        for (int i = 0; i < rawInputs.length; i++) parsedArgs[i] = parseArg((String) rawInputs[i]);

        String preferred = "${preferredFn}";
        Method target = null;

        // 1) explicit function name from the request, if it exists on Solution
        if (!preferred.isEmpty()) {
            for (Method m : Solution.class.getDeclaredMethods()) {
                if (Modifier.isPublic(m.getModifiers()) && !m.isSynthetic() && !m.isBridge() && m.getName().equals(preferred)) {
                    target = m;
                    break;
                }
            }
        }
        // 2) conventional "solve" entry point (matches the generic problem template)
        if (target == null) {
            for (Method m : Solution.class.getDeclaredMethods()) {
                if (Modifier.isPublic(m.getModifiers()) && !m.isSynthetic() && !m.isBridge() && m.getName().equals("solve")) {
                    target = m;
                    break;
                }
            }
        }
        // 3) fall back to the only (or first) public declared method, e.g. twoSum(int[], int)
        if (target == null) {
            for (Method m : Solution.class.getDeclaredMethods()) {
                if (Modifier.isPublic(m.getModifiers()) && !m.isSynthetic() && !m.isBridge()) {
                    target = m;
                    break;
                }
            }
        }
        if (target == null) {
            System.err.println("ERROR: No public method found on Solution");
            System.exit(1);
        }

        target.setAccessible(true);
        Solution sol = new Solution();
        Object result;
        if (target.isVarArgs()) {
            // e.g. Object solve(Object... args) — pass the whole array as the single varargs param
            result = target.invoke(sol, (Object) parsedArgs);
        } else {
            Class<?>[] paramTypes = target.getParameterTypes();
            Object[] callArgs = new Object[paramTypes.length];
            for (int i = 0; i < paramTypes.length && i < parsedArgs.length; i++) {
                callArgs[i] = coerce(parsedArgs[i], paramTypes[i]);
            }
            result = target.invoke(sol, callArgs);
        }
        System.out.println(formatResult(result));
    }
}`;
      }

      // ── C++ ──────────────────────────────────────────────────────────────────
      case 'cpp': {
        const argParsers = inputLines.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('[')) {
            return `    vector<int> arg${i};
    {
        string s = "${trimmed.replace(/"/g, '\\"')}";
        s.erase(remove(s.begin(), s.end(), '['), s.end());
        s.erase(remove(s.begin(), s.end(), ']'), s.end());
        stringstream ss(s);
        string token;
        while(getline(ss, token, ',')) arg${i}.push_back(stoi(token));
    }`;
          }
          return `    int arg${i} = ${trimmed};`;
        }).join('\n');
        const argList = inputLines.map((_, i) => `arg${i}`).join(', ');

        return `#include <bits/stdc++.h>
using namespace std;

${userCode}

int main() {
    Solution sol;
${argParsers}
    auto result = sol.twoSum(${argList});
    cout << "[";
    for (int i = 0; i < (int)result.size(); i++) {
        if (i) cout << ",";
        cout << result[i];
    }
    cout << "]" << endl;
    return 0;
}`;
      }

      // ── C# ───────────────────────────────────────────────────────────────────
      case 'csharp': {
        const argParsers = inputLines.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('[')) {
            return `        int[] arg${i} = "${trimmed.replace(/"/g, '\\"')}".Trim('[',']').Split(',').Select(int.Parse).ToArray();`;
          }
          return `        int arg${i} = int.Parse("${trimmed}");`;
        }).join('\n');
        const argList = inputLines.map((_, i) => `arg${i}`).join(', ');

        return `using System;
using System.Linq;

${userCode}

class Program {
    static void Main() {
${argParsers}
        var sol = new Solution();
        var result = sol.TwoSum(${argList});
        Console.WriteLine("[" + string.Join(",", result) + "]");
    }
}`;
      }

      // ── Go ───────────────────────────────────────────────────────────────────
      case 'go': {
        return `package main

import (
    "encoding/json"
    "fmt"
    "strconv"
    "strings"
)

${userCode}

func parseIntSlice(s string) []int {
    s = strings.Trim(s, "[] ")
    parts := strings.Split(s, ",")
    result := make([]int, 0, len(parts))
    for _, p := range parts {
        n, _ := strconv.Atoi(strings.TrimSpace(p))
        result = append(result, n)
    }
    return result
}

func main() {
    inputLines := ${JSON.stringify(inputLines)}
    _ = inputLines
    nums := parseIntSlice(inputLines[0])
    target, _ := strconv.Atoi(strings.TrimSpace(inputLines[1]))
    result := twoSum(nums, target)
    out, _ := json.Marshal(result)
    fmt.Println(string(out))
}`;
      }

      // ── Ruby ─────────────────────────────────────────────────────────────────
      case 'ruby': {
        return `require 'json'

${userCode}

_lines = ${JSON.stringify(inputLines)}
_args = _lines.map { |l| begin; JSON.parse(l); rescue; l; end }
_result = method(:solution).call(*_args)
if _result.is_a?(Array) || _result.is_a?(Hash)
  puts JSON.generate(_result)
elsif _result.nil?
  puts ""
else
  puts _result.to_s
end
`;
      }

      // ── Rust ─────────────────────────────────────────────────────────────────
      case 'rust': {
        return `use std::str::FromStr;

${userCode}

fn parse_int_vec(s: &str) -> Vec<i32> {
    let s = s.trim().trim_matches(|c| c == '[' || c == ']');
    s.split(',').filter_map(|x| i32::from_str(x.trim()).ok()).collect()
}

fn main() {
    let lines: Vec<&str> = vec![${inputLines.map(l => `"${l.replace(/"/g, '\\"')}"`).join(', ')}];
    let nums = parse_int_vec(lines[0]);
    let target: i32 = lines[1].trim().parse().unwrap();
    let result = two_sum(nums, target);
    let out: Vec<String> = result.iter().map(|x| x.to_string()).collect();
    println!("[{}]", out.join(","));
}`;
      }

      default:
        return `${userCode}\n\nprint(solution(${inputLines.join(', ')}))`;
    }
  }

  // ── Main execute — LOCAL FIRST, remote as fallback ─────────────────────────
  async execute(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    if (!this.isLanguageSupported(request.language)) {
      return { success: false, error: `Language '${request.language}' is not supported` };
    }
    if (request.code.length > 50000) {
      return { success: false, error: 'Code is too long (max 50KB)' };
    }

    // 1. LOCAL EXECUTION FIRST (Python + JS always available on the server)
    const localLanguages = ['python', 'javascript', 'typescript'];
    const allowLocal = process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNSAFE_LOCAL_CODE_EXECUTION === 'true';
    if (allowLocal && localLanguages.includes(request.language)) {
      try {
        const localResult = await this.executeLocally(request);
        // Use local result if it ran (success OR user-code error — not a "not found" error)
        if (
          localResult.success ||
          (localResult.output && localResult.output.length > 0) ||
          (localResult.error && !/ENOENT|not recognized|not supported/i.test(localResult.error))
        ) {
          logger.info(`Local execution used for ${request.language}`);
          return localResult;
        }
      } catch (localErr: any) {
        logger.warn(`Local execution threw: ${localErr?.message} — trying remote`);
      }
    }

    // 2. REMOTE FALLBACK (Piston → Judge0) for languages not available locally
    //    or when local runtime is not installed
    try {
      logger.info(`Trying remote execution for ${request.language}`);
      const remoteResult = this.useJudge0
        ? await this.executeWithJudge0(request)
        : await this.executeWithPiston(request);

      if (
        remoteResult.success ||
        (remoteResult.output && remoteResult.output.length > 0) ||
        (remoteResult.error &&
          !/401|403|429|certificate|ENOTFOUND|ECONN|timeout|rate|forbidden/i.test(remoteResult.error))
      ) {
        return remoteResult;
      }
    } catch (remoteErr: any) {
      logger.warn(`Remote execution failed: ${remoteErr?.message}`);
    }

    // 3. LAST RESORT — local for non-Python/JS languages (Java, C++, etc.)
    //    Will fail gracefully if the runtime isn't installed
    if (!allowLocal) {
      return { success: false, error: 'The isolated code execution service is unavailable. Please try again later.' };
    }
    logger.warn(`All execution paths failed for ${request.language}, trying explicitly enabled local execution`);
    const lastResortResult = await this.executeLocally(request);
    if (!lastResortResult.success) {
      logger.error(`Local execution failed for ${request.language}: ${lastResortResult.error || '(no error message — check that the compiler/runtime is installed and on PATH)'}`);
    }
    return lastResortResult;
  }

  async getSupportedLanguages(): Promise<string[]> {
    return Object.keys(LANGUAGE_MAP);
  }

  isLanguageSupported(language: string): boolean {
    return language in LANGUAGE_MAP;
  }

  private getFileName(language: string): string {
    const extensions: { [key: string]: string } = {
      javascript: 'main.js', python: 'main.py', java: 'Main.java',
      cpp: 'main.cpp', c: 'main.c', csharp: 'Main.cs', go: 'main.go',
      rust: 'main.rs', typescript: 'main.ts', ruby: 'main.rb',
      php: 'main.php', swift: 'main.swift', kotlin: 'Main.kt',
    };
    return extensions[language] || 'main.txt';
  }

  private getJudge0LanguageId(language: string): number {
    const languageIds: { [key: string]: number } = {
      javascript: 63, python: 71, java: 62, cpp: 54, c: 50,
      csharp: 51, go: 60, rust: 73, typescript: 74, ruby: 72,
      php: 68, swift: 83, kotlin: 78,
    };
    return languageIds[language] || 63;
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.execute({ language: 'python', code: 'print("Hello, World!")' });
      return result.success && result.output === 'Hello, World!';
    } catch (error) {
      logger.error('Code execution service test failed:', error);
      return false;
    }
  }
}

export const codeExecutionService = new CodeExecutionService();
export default codeExecutionService;