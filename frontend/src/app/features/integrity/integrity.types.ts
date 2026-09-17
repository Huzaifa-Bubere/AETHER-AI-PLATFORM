/**
 * AETHER — shared Assessment Integrity types + API client.
 * One system for Aptitude, Technical MCQ, Coding and AI Interview.
 * Warning limit is 5: the fifth violation auto-submits the assessment.
 */

export type IntegrityModule = 'APTITUDE' | 'TECHNICAL_MCQ' | 'CODING' | 'INTERVIEW';

export type IntegrityEventType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'COPY_ATTEMPT'
  | 'PASTE_ATTEMPT'
  | 'CONTEXT_MENU'
  | 'CAMERA_DISABLED'
  | 'CAMERA_PERMISSION_REVOKED'
  | 'FACE_NOT_VISIBLE'
  | 'MULTIPLE_FACES'
  | 'MICROPHONE_DISABLED'
  | 'PAGE_RELOAD_ATTEMPT';

export interface IntegrityState {
  warningCount: number;
  maximumWarnings: number;
  shouldAutoSubmit: boolean;
  deduped?: boolean;
  status?: string;
}

/**
 * Coerce an untrusted integrity payload into a valid IntegrityState.
 * Guarantees finite non-negative integers so the UI can never render
 * "Warning NaN of undefined" from a malformed/legacy response.
 */
export function sanitizeIntegrityState(raw: any, fallbackMax: number): IntegrityState {
  const toCount = (value: unknown): number => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const max = (() => {
    const n = Math.floor(Number(raw?.maximumWarnings));
    return Number.isFinite(n) && n > 0 ? n : fallbackMax;
  })();
  const warningCount = Math.min(toCount(raw?.warningCount), max);
  const shouldAutoSubmit = raw?.shouldAutoSubmit === true || raw?.autoSubmitted === true || warningCount >= max;
  return {
    warningCount,
    maximumWarnings: max,
    shouldAutoSubmit,
    deduped: raw?.deduped === true,
    status: typeof raw?.status === 'string' ? raw.status : undefined,
  };
}

export interface IntegritySummary {
  warningCount: number;
  maximumWarnings: number;
  status: 'clean' | 'warning' | 'terminated';
  autoSubmitted: boolean;
  events: Array<{ type: IntegrityEventType; timestamp: string; warningNumber: number }>;
}

/** Coerce an untrusted summary payload; used by report pages. */
export function sanitizeIntegritySummary(raw: any, fallbackMax = 5): IntegritySummary {
  const toCount = (value: unknown): number => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const max = (() => {
    const n = Math.floor(Number(raw?.maximumWarnings));
    return Number.isFinite(n) && n > 0 ? n : fallbackMax;
  })();
  const warningCount = Math.min(toCount(raw?.warningCount), max);
  const events = Array.isArray(raw?.events)
    ? raw.events
        .filter((e: any) => e && typeof e.type === 'string')
        .map((e: any) => ({
          type: e.type as IntegrityEventType,
          timestamp: typeof e.timestamp === 'string' || e.timestamp instanceof Date ? String(e.timestamp) : '',
          warningNumber: toCount(e.warningNumber) || 1,
        }))
    : [];
  const status: IntegritySummary['status'] =
    raw?.status === 'terminated' || warningCount >= max ? 'terminated'
    : raw?.status === 'warning' || warningCount > 0 ? 'warning' : 'clean';
  return { warningCount, maximumWarnings: max, status, autoSubmitted: raw?.autoSubmitted === true || warningCount >= max, events };
}

export interface IntegrityPolicy {
  module: IntegrityModule;
  maxWarnings: number;
  requireFullscreen: boolean;
  cameraRequired: boolean;
  microphoneRequired: boolean;
  blockCopyPaste: boolean;
  monitorTabSwitch: boolean;
  monitorWindowBlur: boolean;
  monitorFullscreenExit: boolean;
}

const API_BASE = '/api/integrity';

async function authedFetch(path: string, init?: RequestInit): Promise<any> {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Integrity API error ${res.status}`);
  return json?.data ?? json;
}

export const integrityApi = {
  async recordEvent(module: IntegrityModule, attemptId: string, type: IntegrityEventType, metadata?: Record<string, unknown>): Promise<IntegrityState> {
    return authedFetch('/event', {
      method: 'POST',
      body: JSON.stringify({ module, attemptId, type, metadata }),
    });
  },
  async getSummary(module: IntegrityModule, attemptId: string): Promise<IntegritySummary> {
    return authedFetch(`/${module}/${attemptId}`);
  },
};

/** Per-module default policies. Coding deliberately keeps editor shortcuts working. */
export const DEFAULT_POLICIES: Record<IntegrityModule, IntegrityPolicy> = {
  APTITUDE: {
    module: 'APTITUDE', maxWarnings: 5, requireFullscreen: true, cameraRequired: false,
    microphoneRequired: false, blockCopyPaste: true, monitorTabSwitch: true,
    monitorWindowBlur: true, monitorFullscreenExit: true,
  },
  TECHNICAL_MCQ: {
    module: 'TECHNICAL_MCQ', maxWarnings: 5, requireFullscreen: true, cameraRequired: false,
    microphoneRequired: false, blockCopyPaste: true, monitorTabSwitch: true,
    monitorWindowBlur: true, monitorFullscreenExit: true,
  },
  CODING: {
    module: 'CODING', maxWarnings: 5, requireFullscreen: false, cameraRequired: false,
    microphoneRequired: false,
    // Monaco copy/cut/paste stays allowed; only leaving the page is monitored.
    blockCopyPaste: false, monitorTabSwitch: true, monitorWindowBlur: true,
    monitorFullscreenExit: false,
  },
  INTERVIEW: {
    module: 'INTERVIEW', maxWarnings: 5, requireFullscreen: true, cameraRequired: true,
    microphoneRequired: true, blockCopyPaste: true, monitorTabSwitch: true,
    monitorWindowBlur: true, monitorFullscreenExit: true,
  },
};
