import { apiService } from '../../../services/api';

/**
 * AETHER Coding — Execution Visualizer client.
 * Real traces only: the backend runs instrumented code in a sandbox and
 * returns actual events. Never AI-generated state.
 */

export interface ITraceEvent {
  step: number;
  line: number;
  event: string;
  function: string;
  variables?: Record<string, unknown>;
  collections?: Record<string, unknown>;
  stdout?: string;
  callDepth: number;
  callStack?: string[];
  note?: string;
}

export interface ITraceMetadata {
  language: string;
  functionName?: string;
  inputPreview: string;
  totalSteps: number;
  truncated: boolean;
  finalOutput: string;
  runtimeMs: number;
  patterns: Array<{ pattern: string; variables?: string[] }>;
  returnValue?: string;
  engine: string;
}

export interface ITraceResult {
  ok: boolean;
  supported: boolean;
  reason?: string;
  events: ITraceEvent[];
  metadata: ITraceMetadata;
  inputLabel?: string;
}

export interface ITraceInputOption {
  id: string;
  label: string;
  input: string;
  expectedOutput: string;
}

export interface ITraceCapabilities {
  fullTrace: string[];
  functionTrace: string[];
  unavailable: string[];
  limits: { maxTraceSteps: number; maxTraceBytes: number; timeoutMs: number };
}

class TraceService {
  async getCapabilities(): Promise<ITraceCapabilities | null> {
    try {
      const res = await apiService.get('/coding/trace/capabilities');
      return res.success ? (res.data as ITraceCapabilities) : null;
    } catch {
      return null;
    }
  }

  async listInputs(submissionId: string): Promise<{ language: string; functionName?: string; inputs: ITraceInputOption[] } | null> {
    try {
      const res = await apiService.get(`/coding/submissions/${submissionId}/trace-inputs`);
      return res.success ? (res.data as { language: string; functionName?: string; inputs: ITraceInputOption[] }) : null;
    } catch {
      return null;
    }
  }

  async trace(submissionId: string, inputId: string, customInput?: string): Promise<ITraceResult> {
    const res = await apiService.post(
      `/coding/submissions/${submissionId}/trace`,
      { inputId, customInput },
      { timeout: 120000 }
    );
    if (!res.success) throw new Error(res.error || res.message || 'Trace failed');
    return res.data as ITraceResult;
  }
}

export const traceService = new TraceService();
