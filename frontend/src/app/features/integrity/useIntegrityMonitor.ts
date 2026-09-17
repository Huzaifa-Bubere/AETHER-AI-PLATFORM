import { useCallback, useEffect, useRef, useState } from 'react';
import {
  integrityApi, IntegrityEventType, IntegrityModule, IntegrityPolicy, IntegrityState,
  sanitizeIntegrityState,
} from './integrity.types';

/**
 * AETHER — useIntegrityMonitor
 * Detects observable integrity events, reports them to the backend (authoritative),
 * exposes the live warning state and a pending 5th-warning trigger.
 *
 * The warning limit is 5 — the fifth violation auto-submits the assessment.
 *
 * Deduplication: one real leave action fires blur + visibilitychange (+fullscreenchange)
 * nearly together — local 1500ms guard mirrors the backend dedup so the UI shows
 * ONE warning per action even before the backend responds.
 */

interface Options {
  policy: IntegrityPolicy;
  attemptId: string | null;
  active: boolean;
  /** Called ONCE when the backend confirms warning 5 — run module auto-submit here. */
  onAutoSubmit?: () => void | Promise<void>;
  /** Camera state hooks (optional): call reportFace/faceSeen/multipleFaces from camera loop. */
}

export function useIntegrityMonitor({ policy, attemptId, active, onAutoSubmit }: Options) {
  const [state, setState] = useState<IntegrityState>(() => sanitizeIntegrityState(null, policy.maxWarnings));
  const [modalEvent, setModalEvent] = useState<IntegrityEventType | null>(null);
  // Explicit warning number for the modal — never derived, never NaN.
  const [modalWarningNumber, setModalWarningNumber] = useState(0);
  const [submittingWork, setSubmittingWork] = useState(false);

  const lastLeaveAt = useRef(0);
  const autoSubmitFired = useRef(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  /**
   * Core reporter: POST event → update state → fire auto-submit once.
   * Offline-safe: when the API call fails (network/server down), the warning is
   * counted LOCALLY against the module policy so cheating cannot slip through
   * just because an event request failed. The backend remains authoritative
   * whenever it responds; restoreState() reconciles counts after a reload.
   */
  const report = useCallback(async (type: IntegrityEventType, metadata?: Record<string, unknown>) => {
    if (!active || !attemptId || autoSubmitFired.current) return;
    // Local dedup for leave-style events (backend dedups too — this avoids double modals).
    if (['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT'].includes(type)) {
      const now = Date.now();
      if (now - lastLeaveAt.current < 1500) return;
      lastLeaveAt.current = now;
    }
    try {
      const raw = await integrityApi.recordEvent(policy.module, attemptId, type, metadata);
      const next = sanitizeIntegrityState(raw, policy.maxWarnings);
      setState(next);
      if (next.deduped) return; // backend saw this as a duplicate of an in-flight action
      if (next.shouldAutoSubmit) {
        autoSubmitFired.current = true;
        setModalEvent(null);
        setSubmittingWork(true);
        try { await onAutoSubmitRef.current?.(); } finally { setSubmittingWork(false); }
      } else {
        setModalWarningNumber(next.warningCount || 1);
        setModalEvent(type); // professional warning modal (warnings 1–4)
      }
    } catch {
      // Network/server failure: never mark the candidate as innocent for an outage.
      // Count the observable event locally; the backend reconciles on next success.
      const fallbackMax = policy.maxWarnings;
      setState(prev => {
        const max = prev.maximumWarnings || fallbackMax;
        const warningCount = Math.min((prev.warningCount || 0) + 1, max);
        const shouldAutoSubmit = warningCount >= max;
        if (shouldAutoSubmit) {
          autoSubmitFired.current = true;
          Promise.resolve().then(async () => {
            setModalEvent(null);
            setSubmittingWork(true);
            try { await onAutoSubmitRef.current?.(); } finally { setSubmittingWork(false); }
          });
        } else {
          Promise.resolve().then(() => {
            setModalWarningNumber(warningCount);
            setModalEvent(type);
          });
        }
        return { ...prev, warningCount, maximumWarnings: max, shouldAutoSubmit };
      });
    }
  }, [active, attemptId, policy.module, policy.maxWarnings]);

  // ── Tab switch (visibilitychange) ─────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && policy.monitorTabSwitch) {
        void report('TAB_SWITCH', { via: 'visibilitychange' });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, policy.monitorTabSwitch, report]);

  // ── Window blur (deduped with tab switch) ────────────────────────────────
  useEffect(() => {
    if (!active || !policy.monitorWindowBlur) return;
    const onBlur = () => { void report('WINDOW_BLUR', { via: 'blur' }); };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [active, policy.monitorWindowBlur, report]);

  // ── Fullscreen exit (no request loop — request is explicit, exit is warned) ──
  const requestFullscreen = useCallback(() => {
    if (!policy.requireFullscreen) return;
    document.documentElement.requestFullscreen?.().catch(() => { /* denied — continue windowed */ });
  }, [policy.requireFullscreen]);

  useEffect(() => {
    if (!active || !policy.monitorFullscreenExit) return;
    const onFsChange = () => {
      if (!document.fullscreenElement) void report('FULLSCREEN_EXIT');
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [active, policy.monitorFullscreenExit, report]);

  // ── Copy/paste policy (never inside Monaco — coding opts out) ────────────
  useEffect(() => {
    if (!active || !policy.blockCopyPaste) return;
    const onCopy = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.monaco-editor')) return; // safety: never block editor actions
      e.preventDefault();
      void report('COPY_ATTEMPT');
    };
    const onPaste = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.monaco-editor')) return;
      e.preventDefault();
      void report('PASTE_ATTEMPT');
    };
    const onContextMenu = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.monaco-editor, textarea, input')) return;
      e.preventDefault();
      void report('CONTEXT_MENU');
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [active, policy.blockCopyPaste, report]);

  // ── Reload protection (beforeunload + restore warning count) ─────────────
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);

  /** Restore authoritative warning count after a reload (backend wins). */
  const restoreState = useCallback(async () => {
    if (!attemptId || !active) return;
    try {
      const raw = await integrityApi.getSummary(policy.module, attemptId);
      const summary = sanitizeIntegrityState(
        { warningCount: raw?.warningCount, maximumWarnings: raw?.maximumWarnings, shouldAutoSubmit: raw?.autoSubmitted },
        policy.maxWarnings,
      );
      setState(prev => ({
        ...prev,
        warningCount: Math.max(prev.warningCount, summary.warningCount),
        maximumWarnings: summary.maximumWarnings,
        shouldAutoSubmit: summary.shouldAutoSubmit,
      }));
      if (summary.shouldAutoSubmit && !autoSubmitFired.current) {
        autoSubmitFired.current = true;
        setSubmittingWork(true);
        try { await onAutoSubmitRef.current?.(); } finally { setSubmittingWork(false); }
      }
    } catch { /* summary unavailable — keep local state */ }
  }, [attemptId, active, policy.module, policy.maxWarnings]);

  // Camera-state helpers for module pages with a camera loop (interview).
  const faceSeen = useCallback(() => { /* state reset happens client-side via thresholds */ }, []);
  const reportFaceAbsent = useCallback((seconds: number) => {
    void report('FACE_NOT_VISIBLE', { continuousSeconds: seconds });
  }, [report]);
  const reportMultipleFaces = useCallback((seconds: number) => {
    void report('MULTIPLE_FACES', { continuousSeconds: seconds });
  }, [report]);
  const reportCameraDisabled = useCallback(() => { void report('CAMERA_DISABLED'); }, [report]);
  const reportMicDisabled = useCallback(() => { void report('MICROPHONE_DISABLED'); }, [report]);

  const dismissModal = useCallback(() => setModalEvent(null), []);

  return {
    warningCount: state.warningCount,
    maximumWarnings: state.maximumWarnings,
    shouldAutoSubmit: state.shouldAutoSubmit,
    modalEvent,
    modalWarningNumber,
    submittingWork,
    report,
    restoreState,
    requestFullscreen,
    faceSeen, reportFaceAbsent, reportMultipleFaces, reportCameraDisabled, reportMicDisabled,
    dismissModal,
  };
}
