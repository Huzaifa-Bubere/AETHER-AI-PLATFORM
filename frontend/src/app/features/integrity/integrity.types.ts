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
  | 'PAGE_RELOAD_ATTEMPT'
  // Interview camera integrity (spec §15). Sustained screen-attention deviation —
  // an observable event, never an inference about honesty.
  | 'GAZE_AWAY'
  | 'HEAD_AWAY'
  // Both eyes remained confidently closed past the closure threshold (spec
  // Part K). Observable and reportable; never proof of misconduct.
  | 'EYES_CLOSED_LONG'
  | 'MEDIA_TRACK_ENDED';

/** Severity of an observable event (spec §16). Only WARNING/CRITICAL count. */
export type IntegritySeverity = 'OBSERVATION' | 'WARNING' | 'CRITICAL';

export interface IntegrityState {
  warningCount: number;
  maximumWarnings: number;
  shouldAutoSubmit: boolean;
  deduped?: boolean;
  status?: string;
  severity?: IntegritySeverity;
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
  events: Array<{
    type: IntegrityEventType;
    timestamp: string;
    warningNumber: number;
    /** Severity as recorded by the backend; absent on legacy rows. */
    severity?: IntegritySeverity;
    /** Measured length of a sustained incident (0 for a point event). */
    durationMs?: number;
  }>;
  /** Informational events that were shown but never counted (spec §21). */
  observationCount?: number;
  /**
   * Observable evidence grouped for the report (spec §27). Deliberately named
   * "observed" — these are assessment events, not proof of misconduct.
   */
  observed?: {
    attentionDeviations?: number;
    faceNotVisible?: number;
    multipleFaces?: number;
    /** Sustained eye closures (spec Part K) — reported separately from gaze. */
    eyeClosures?: number;
    cameraInterruptions?: number;
    tabSwitches?: number;
    windowBlur?: number;
    fullscreenExits?: number;
  };
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
          severity: (e.severity === 'OBSERVATION' || e.severity === 'CRITICAL' || e.severity === 'WARNING'
            ? e.severity
            : undefined) as IntegritySeverity | undefined,
          durationMs: toCount(e.durationMs),
        }))
    : [];
  const status: IntegritySummary['status'] =
    raw?.status === 'terminated' || warningCount >= max ? 'terminated'
    : raw?.status === 'warning' || warningCount > 0 ? 'warning' : 'clean';
  // Grouped evidence is preserved (spec §27/§AE): the report groups observations
  // by behaviour, so dropping this would force it to re-derive counts from rows
  // or, worse, to display nothing at all.
  const observed = raw?.observed && typeof raw.observed === 'object'
    ? {
        attentionDeviations: toCount(raw.observed.attentionDeviations),
        faceNotVisible: toCount(raw.observed.faceNotVisible),
        multipleFaces: toCount(raw.observed.multipleFaces),
        eyeClosures: toCount(raw.observed.eyeClosures),
        cameraInterruptions: toCount(raw.observed.cameraInterruptions),
        tabSwitches: toCount(raw.observed.tabSwitches),
        windowBlur: toCount(raw.observed.windowBlur),
        fullscreenExits: toCount(raw.observed.fullscreenExits),
      }
    : undefined;
  return {
    warningCount,
    maximumWarnings: max,
    status,
    autoSubmitted: raw?.autoSubmitted === true || warningCount >= max,
    events,
    observationCount: toCount(raw?.observationCount),
    observed,
  };
}

export interface IntegrityEventPayload {
  severity?: IntegritySeverity;
  startedAt?: string | Date;
  endedAt?: string | Date | null;
  durationMs?: number;
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
  /** Camera-based observation monitoring (face presence/gaze/multiple faces). */
  monitorCameraIntegrity: boolean;
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
  /**
   * Record one observable event. `payload` carries the incident timing/severity
   * so the backend can store the real duration of a sustained event instead of
   * treating every report as an instantaneous point (spec §16).
   */
  async recordEvent(
    module: IntegrityModule,
    attemptId: string,
    type: IntegrityEventType,
    metadata?: Record<string, unknown>,
    payload?: IntegrityEventPayload,
  ): Promise<IntegrityState> {
    const startedAt = payload?.startedAt instanceof Date ? payload.startedAt.toISOString() : payload?.startedAt;
    const endedAt = payload?.endedAt instanceof Date ? payload.endedAt.toISOString() : payload?.endedAt;
    return authedFetch('/event', {
      method: 'POST',
      body: JSON.stringify({
        module, attemptId, type, metadata,
        severity: payload?.severity,
        startedAt,
        endedAt: endedAt ?? undefined,
        durationMs: payload?.durationMs,
      }),
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
    monitorWindowBlur: true, monitorFullscreenExit: true, monitorCameraIntegrity: false,
  },
  TECHNICAL_MCQ: {
    module: 'TECHNICAL_MCQ', maxWarnings: 5, requireFullscreen: true, cameraRequired: false,
    microphoneRequired: false, blockCopyPaste: true, monitorTabSwitch: true,
    monitorWindowBlur: true, monitorFullscreenExit: true, monitorCameraIntegrity: false,
  },
  CODING: {
    module: 'CODING', maxWarnings: 5, requireFullscreen: false, cameraRequired: false,
    microphoneRequired: false,
    // Monaco copy/cut/paste stays allowed; only leaving the page is monitored.
    blockCopyPaste: false, monitorTabSwitch: true, monitorWindowBlur: true,
    monitorFullscreenExit: false, monitorCameraIntegrity: false,
  },
  INTERVIEW: {
    module: 'INTERVIEW', maxWarnings: 5, requireFullscreen: true, cameraRequired: true,
    microphoneRequired: true,    blockCopyPaste: true, monitorTabSwitch: true,
    monitorWindowBlur: true, monitorFullscreenExit: true,
    // Interview-only camera integrity (spec §1–§12). Called out explicitly so the
    // interview policy self-documents what is monitored and nothing else picks it up.
    monitorCameraIntegrity: true,
  },
};
