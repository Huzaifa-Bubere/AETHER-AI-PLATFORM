import os from 'os';

/**
 * AETHER — real system telemetry for the admin dashboard.
 *
 * Why this exists: the admin System Metrics panel used to be a literal array of
 * hardcoded points (a made-up 24h curve with the last value overwritten by the
 * live reading). A dashboard that plots invented history is worse than one that
 * plots nothing.
 *
 * Everything here is measured, never generated:
 *  - CPU  — tick deltas from `os.cpus()`. `os.loadavg()` is hard-zero on Windows,
 *           so the previous loadavg-based number was always 0% there.
 *  - Memory — `os.totalmem()/os.freemem()`.
 *  - Requests — a real counter fed by one middleware in `app.ts`.
 *
 * Samples live in a bounded in-process ring buffer, so the panel is honest about
 * its horizon: "since this server process started", not "the last 24 hours".
 */

const parsedInterval = Number.parseInt(process.env.SYSTEM_METRICS_INTERVAL_MS ?? '', 10);
export const SAMPLE_INTERVAL_MS = Number.isFinite(parsedInterval) && parsedInterval > 0
  ? parsedInterval
  : 60_000;

/** 60 samples ≈ the last hour at the default 60 s interval. */
export const MAX_SAMPLES = 60;

export interface SystemSample {
  /** ISO timestamp of the sample. */
  at: string;
  /** CPU busy % across all cores during the interval; null until a second reading. */
  cpu: number | null;
  /** System memory in use, %. */
  memory: number;
  /** API requests served since the previous sample. */
  requests: number;
}

interface CpuTicks {
  idle: number;
  total: number;
}

let samples: SystemSample[] = [];
let previousTicks: CpuTicks | null = null;
let requestsSinceSample = 0;
let totalRequests = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readCpuTicks(): CpuTicks {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const value of Object.values(cpu.times)) total += value;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

/**
 * CPU busy % since the previous call. Returns null when there is no usable
 * window yet (first call, or a machine that reports no tick movement), so the
 * caller can say "measuring…" rather than print a fabricated 0.
 */
export function cpuUsagePercent(): number | null {
  const current = readCpuTicks();
  if (!previousTicks) {
    previousTicks = current;
    return null;
  }
  const idleDelta = current.idle - previousTicks.idle;
  const totalDelta = current.total - previousTicks.total;
  previousTicks = current;
  if (totalDelta <= 0) return null;
  return clampPercent((1 - idleDelta / totalDelta) * 100);
}

export function memoryUsagePercent(): number {
  const total = os.totalmem();
  if (!total) return 0;
  return clampPercent(((total - os.freemem()) / total) * 100);
}

/** Called once per HTTP request by the counter middleware in `app.ts`. */
export function recordRequest(): void {
  totalRequests += 1;
  requestsSinceSample += 1;
}

export function requestTotals(): { total: number; sinceLastSample: number } {
  return { total: totalRequests, sinceLastSample: requestsSinceSample };
}

/** Capture one sample and reset the per-interval request counter. */
export function takeSample(): SystemSample {
  const sample: SystemSample = {
    at: new Date().toISOString(),
    cpu: cpuUsagePercent(),
    memory: memoryUsagePercent(),
    requests: requestsSinceSample,
  };
  requestsSinceSample = 0;
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples = samples.slice(samples.length - MAX_SAMPLES);
  return sample;
}

export function systemHistory(): SystemSample[] {
  return [...samples];
}

export interface SystemSnapshot {
  cpu: number | null;
  cpuMeasured: boolean;
  memory: number;
  uptimeSeconds: number;
  platform: string;
  nodeVersion: string;
  cores: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  samplingIntervalMs: number;
  /** Horizon of the history buffer, in samples. */
  maxSamples: number;
  requests: { total: number; sinceLastSample: number };
  history: SystemSample[];
  timestamp: string;
}

/**
 * Point-in-time reading plus the buffered history the chart draws. `cpu` is null
 * until two tick readings exist — the first call after boot has no window yet.
 */
export function systemSnapshot(): SystemSnapshot {
  const cpu = cpuUsagePercent();
  return {
    cpu,
    cpuMeasured: cpu !== null,
    memory: memoryUsagePercent(),
    uptimeSeconds: Math.round(process.uptime()),
    platform: os.platform(),
    nodeVersion: process.version,
    cores: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    samplingIntervalMs: SAMPLE_INTERVAL_MS,
    maxSamples: MAX_SAMPLES,
    requests: requestTotals(),
    history: systemHistory(),
    timestamp: new Date().toISOString(),
  };
}

/** Start the sampler. Idempotent; the timer never holds the process open. */
export function startSystemMetricsSampler(): void {
  if (timer) return;
  cpuUsagePercent();  // prime the tick baseline
  takeSample();       // first point so the chart is not empty on load
  timer = setInterval(() => {
    try {
      takeSample();
    } catch {
      // Telemetry must never crash the server.
    }
  }, SAMPLE_INTERVAL_MS);
  timer.unref?.();
}

export function stopSystemMetricsSampler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Test seam: clears buffered samples and counters. */
export function resetSystemMetrics(): void {
  samples = [];
  previousTicks = null;
  requestsSinceSample = 0;
  totalRequests = 0;
}
