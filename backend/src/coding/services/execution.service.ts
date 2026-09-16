import axios from 'axios';
import { codeExecutionService } from '../../services/codeExecution';
import logger from '../../utils/logger';
import {
  CodingLanguage,
  IExecutionResult,
  ITestOutcome,
  ExecutionStatus,
  ITestCase,
} from '../types/coding.types';

/**
 * AETHER Coding — execution layer.
 *
 * Primary:  self-hosted or RapidAPI Judge0 (server-side only, credentials never leave backend).
 * Fallback: existing AETHER runner (Piston → local) — reused, not duplicated.
 *
 * Judge0 submit → poll → normalized IExecutionResult, with per-test-case execution
 * for problem test suites.
 */
class CodingExecutionService {
  private judge0Url: string;
  private judge0Key: string | undefined;
  private judge0Host: string | undefined;
  private useJudge0: boolean;
  private maxSourceBytes = 50_000;
  private maxTestsPerSubmit = 50;
  private submitTimeoutMs = 15_000;
  private pollTimeoutMs = 60_000;
  private userRateWindowMs = 60_000;
  private userRateMax = 30;
  private userRateMap = new Map<string, number[]>();

  // Judge0 status ids → normalized status
  private static JUDGE0_STATUS: Record<number, { status: ExecutionStatus; kind: 'ok' | 'wa' | 'ce' | 're' | 'tle' | 'mle' }> = {
    3: { status: 'Accepted', kind: 'ok' },
    4: { status: 'Wrong Answer', kind: 'wa' },
    5: { status: 'Time Limit Exceeded', kind: 'tle' },
    6: { status: 'Compilation Error', kind: 'ce' },
    7: { status: 'Runtime Error', kind: 're' },
    8: { status: 'Runtime Error', kind: 're' },
    9: { status: 'Runtime Error', kind: 're' },
    10: { status: 'Runtime Error', kind: 're' },
    11: { status: 'Runtime Error', kind: 're' },
    12: { status: 'Runtime Error', kind: 're' },
    13: { status: 'Internal Error', kind: 're' },
    14: { status: 'Internal Error', kind: 're' },
  };

  private static JUDGE0_LANG_IDS: Record<CodingLanguage, number> = {
    javascript: 63, python: 71, java: 62, cpp: 54, c: 50, typescript: 74,
  };

  constructor() {
    this.judge0Url = (process.env.JUDGE0_URL || '').replace(/\/+$/, '');
    this.judge0Key = process.env.JUDGE0_API_KEY;
    this.judge0Host = process.env.JUDGE0_HOST;
    this.useJudge0 = process.env.CODE_EXECUTION_SERVICE === 'judge0' && !!this.judge0Url;
  }

  // ── Rate limiting (per user, sliding window, in-process) ───────────────────
  checkRate(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.userRateWindowMs;
    const timestamps = (this.userRateMap.get(userId) || []).filter(t => t > windowStart);
    if (timestamps.length >= this.userRateMax) return false;
    timestamps.push(now);
    this.userRateMap.set(userId, timestamps);
    return true;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Run code against sample (visible) tests or a single custom input. Not an official submission. */
  async runCode(
    userId: string,
    language: CodingLanguage,
    sourceCode: string,
    testCases: ITestCase[],
    functionName?: string
  ): Promise<IExecutionResult> {
    const guard = this.precheck(userId, sourceCode, testCases);
    if (guard) return guard;
    const tests = testCases.slice(0, this.maxTestsPerSubmit);

    try {
      const tagged: Array<ITestCase & { hidden: boolean }> = tests.map(t => ({ ...t, hidden: false }));
      if (this.useJudge0) {
        return await this.executeViaJudge0(language, sourceCode, tagged, functionName);
      }
      return await this.executeViaLegacyRunner(language, sourceCode, tagged, functionName);
    } catch (err: any) {
      logger.error('Coding run failed:', err);
      return this.errorResult(err?.message || 'Code execution failed unexpectedly.');
    }
  }

  /** Official submission: sample + hidden tests, per-test outcomes, aggregate status. */
  async submitCode(
    userId: string,
    language: CodingLanguage,
    sourceCode: string,
    sampleTests: ITestCase[],
    hiddenTests: ITestCase[],
    functionName?: string
  ): Promise<IExecutionResult> {
    const all: Array<ITestCase & { hidden: boolean }> = [
      ...sampleTests.map(t => ({ ...t, hidden: false })),
      ...hiddenTests.map(t => ({ ...t, hidden: true })),
    ];
    const guard = this.precheck(userId, sourceCode, all);
    if (guard) return guard;

    try {
      if (this.useJudge0) {
        return await this.executeViaJudge0(language, sourceCode, all, functionName);
      }
      return await this.executeViaLegacyRunner(language, sourceCode, all, functionName, true);
    } catch (err: any) {
      logger.error('Coding submit failed:', err);
      return this.errorResult(err?.message || 'Submission execution failed unexpectedly.');
    }
  }

  // ── Pre-checks ──────────────────────────────────────────────────────────────
  private precheck(userId: string, sourceCode: string, tests: Array<{ input?: string }>): IExecutionResult | null {
    if (!this.checkRate(userId)) {
      return this.errorResult('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (!sourceCode || sourceCode.trim().length === 0) {
      return this.errorResult('Source code is empty.');
    }
    if (Buffer.byteLength(sourceCode, 'utf8') > this.maxSourceBytes) {
      return this.errorResult('Source code exceeds the 50KB size limit.');
    }
    if (!tests || tests.length === 0) {
      return this.errorResult('No test cases available for this problem.');
    }
    if (tests.length > this.maxTestsPerSubmit) {
      return this.errorResult(`Too many test cases (max ${this.maxTestsPerSubmit}).`);
    }
    return null;
  }

  private errorResult(message: string): IExecutionResult {
    return {
      status: 'Internal Error',
      passedTests: 0,
      totalTests: 0,
      tests: [],
      runtimeMs: 0,
      memoryKb: null,
      stderr: message,
      executor: this.useJudge0 ? 'judge0' : 'piston',
    };
  }

  // ── Legacy runner path (existing AETHER service — Piston/local fallbacks) ──
  private async executeViaLegacyRunner(
    language: CodingLanguage,
    sourceCode: string,
    tests: Array<ITestCase & { hidden: boolean }>,
    functionName: string | undefined,
    isSubmit = false
  ): Promise<IExecutionResult> {
    if (!isSubmit) {
      // Run: single execution (custom input) or sample tests via harness
      const result = await codeExecutionService.executeWithTestCases({
        language,
        code: sourceCode,
        testCases: tests.map(t => ({ input: t.input, expectedOutput: t.expectedOutput })),
        functionName,
      });
      return this.normalizeLegacyResult(result, tests, 'piston');
    }

    // Submit: run all tests, classify aggregate status
    const outcomes: ITestOutcome[] = [];
    let runtimeMs = 0;
    let sawCompileError = false;
    let sawRuntimeError = false;
    let sawTle = false;

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      const result = await codeExecutionService.executeWithTestCases({
        language,
        code: sourceCode,
        testCases: [{ input: t.input, expectedOutput: t.expectedOutput }],
        functionName,
      });
      const r = result.testResults?.[0];
      const passed = !!r?.passed;
      const execTime = r?.executionTime || 0;
      runtimeMs += execTime;

      let outcome: ITestOutcome = {
        index: i,
        input: t.input,
        expectedOutput: t.expectedOutput,
        actualOutput: r?.actualOutput ?? '',
        passed,
        executionTimeMs: execTime,
        hidden: t.hidden,
      };

      const errText = r?.error || result.error || '';
      if (errText) {
        if (/compil|syntax/i.test(errText)) sawCompileError = true;
        else if (/time.?limit|timed? ?out/i.test(errText)) sawTle = true;
        else sawRuntimeError = true;
        outcome.error = errText;
      }
      outcomes.push(outcome);
    }

    const passedTests = outcomes.filter(o => o.passed).length;
    const status: ExecutionStatus = sawCompileError
      ? 'Compilation Error'
      : sawTle
        ? 'Time Limit Exceeded'
        : sawRuntimeError && passedTests < tests.length
          ? 'Runtime Error'
          : passedTests === tests.length
            ? 'Accepted'
            : 'Wrong Answer';

    return {
      status,
      passedTests,
      totalTests: tests.length,
      tests: outcomes,
      runtimeMs,
      memoryKb: null,
      executor: 'piston',
    };
  }

  private normalizeLegacyResult(
    result: { success: boolean; output?: string; error?: string; executionTime?: number; memory?: number; testResults?: any[] },
    tests: Array<ITestCase & { hidden: boolean }>,
    executor: 'piston' | 'local'
  ): IExecutionResult {
    const outcomes: ITestOutcome[] = (result.testResults || []).map((r: any, i: number) => ({
      index: i,
      input: r.input ?? tests[i]?.input ?? '',
      expectedOutput: r.expectedOutput ?? tests[i]?.expectedOutput ?? '',
      actualOutput: r.actualOutput ?? '',
      passed: !!r.passed,
      executionTimeMs: r.executionTime,
      error: r.error,
      hidden: tests[i]?.hidden ?? false,
    }));
    const passedTests = outcomes.filter(o => o.passed).length;
    const errText = result.error || '';
    const status: ExecutionStatus = errText
      ? /compil|syntax/i.test(errText)
        ? 'Compilation Error'
        : /time.?limit/i.test(errText)
          ? 'Time Limit Exceeded'
          : 'Runtime Error'
      : outcomes.length > 0 && passedTests === outcomes.length
        ? 'Accepted'
        : outcomes.length > 0
          ? 'Wrong Answer'
          : 'Internal Error';

    return {
      status,
      passedTests,
      totalTests: outcomes.length,
      tests: outcomes,
      runtimeMs: result.executionTime || outcomes.reduce((s, o) => s + (o.executionTimeMs || 0), 0),
      memoryKb: result.memory ?? null,
      compileOutput: /compil|syntax/i.test(errText) ? errText : undefined,
      stderr: errText || undefined,
      executor,
    };
  }

  // ── Judge0 path (sandboxed, primary when configured) ───────────────────────
  private async executeViaJudge0(
    language: CodingLanguage,
    sourceCode: string,
    tests: Array<ITestCase & { hidden: boolean }>,
    functionName: string | undefined
  ): Promise<IExecutionResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.judge0Key) {
      headers['X-RapidAPI-Key'] = this.judge0Key;
      if (this.judge0Host) headers['X-RapidAPI-Host'] = this.judge0Host;
    }

    const languageId = CodingExecutionService.JUDGE0_LANG_IDS[language] || 63;
    const outcomes: ITestOutcome[] = [];
    let totalRuntime = 0;
    let totalMemory: number | null = null;
    let compileOutput: string | undefined;

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      const harnessCode = codeExecutionService.buildHarness(language, sourceCode, t.input, functionName);

      try {
        const submitRes = await axios.post(
          `${this.judge0Url}/submissions?base64_encoded=false&wait=false`,
          {
            language_id: languageId,
            source_code: harnessCode,
            stdin: '',
            cpu_time_limit: 5,
            memory_limit: 256000,
          },
          { headers, timeout: this.submitTimeoutMs }
        );
        const token = submitRes.data?.token;
        if (!token) throw new Error('Judge0 did not return a submission token');

        const final = await this.pollJudge0(token, headers);
        const statusId = final?.status?.id ?? 13;
        const mapped = CodingExecutionService.JUDGE0_STATUS[statusId] || { status: 'Internal Error' as ExecutionStatus, kind: 're' as const };
        const runtime = final?.time != null ? Math.round(parseFloat(final.time) * 1000) : 0;
        const memory = final?.memory != null ? Math.round(final.memory) : null;
        totalRuntime += runtime;
        if (memory != null) totalMemory = Math.max(totalMemory ?? 0, memory);

        const stdout = (final?.stdout || '').trim();
        const expected = t.expectedOutput.trim();
        const passed = mapped.kind === 'ok' && this.normalize(stdout) === this.normalize(expected);

        if (mapped.kind === 'ce') compileOutput = final?.compile_output || final?.message || 'Compilation failed';

        outcomes.push({
          index: i,
          input: t.input,
          expectedOutput: t.expectedOutput,
          actualOutput: stdout || (final?.stderr ? `[stderr] ${final.stderr}` : '') || (final?.compile_output ? `[compile] ${final.compile_output}` : ''),
          passed,
          executionTimeMs: runtime,
          error: mapped.kind === 'ce' ? final?.compile_output : mapped.kind === 're' ? (final?.stderr || final?.message) : undefined,
          hidden: t.hidden,
        });

        if (mapped.kind === 'ce') break; // no point running more tests after compile error
      } catch (err: any) {
        logger.warn(`Judge0 test ${i} failed: ${err?.message}`);
        throw new Error(`Judge0 execution unavailable: ${err?.message || 'request failed'}`);
      }
    }

    const passedTests = outcomes.filter(o => o.passed).length;
    const ceCount = outcomes.filter(o => /compil/i.test(o.error || '')).length > 0;
    const status: ExecutionStatus = ceCount
      ? 'Compilation Error'
      : outcomes.some(o => /Time.?limit/i.test(o.error || ''))
        ? 'Time Limit Exceeded'
        : outcomes.length === 0
          ? 'Internal Error'
          : passedTests === outcomes.length
            ? 'Accepted'
            : 'Wrong Answer';

    return {
      status,
      passedTests,
      totalTests: outcomes.length,
      tests: outcomes,
      runtimeMs: totalRuntime,
      memoryKb: totalMemory,
      compileOutput,
      executor: 'judge0',
    };
  }

  private async pollJudge0(token: string, headers: Record<string, string>): Promise<any> {
    const deadline = Date.now() + this.pollTimeoutMs;
    while (Date.now() < deadline) {
      const res = await axios.get(
        `${this.judge0Url}/submissions/${token}?base64_encoded=false`,
        { headers, timeout: 10_000 }
      );
      // status.id >= 3 means finished processing (3=Accepted, 4=WA, 5=TLE, 6=CE, 7+=RE/SIG)
      if (res.data?.status?.id >= 3) return res.data;
      await new Promise(r => setTimeout(r, 750));
    }
    throw new Error('Judge0 polling timed out');
  }

  // Same normalization contract as the existing service (whitespace-insensitive)
  private normalize(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    try {
      return JSON.stringify(JSON.parse(trimmed)).replace(/\s+/g, '').toLowerCase();
    } catch {
      const lower = trimmed.toLowerCase();
      if (lower === 'true') return 'true';
      if (lower === 'false') return 'false';
      if (lower === 'none' || lower === 'null') return 'null';
      return trimmed.replace(/\s+/g, '').toLowerCase();
    }
  }
}

export const codingExecutionService = new CodingExecutionService();
