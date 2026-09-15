import { useCallback, useEffect, useRef, useState } from 'react';

export type ProctorEventType =
  | 'tab-switch' | 'window-blur' | 'copy-attempt' | 'paste-attempt' | 'screenshot-key'
  | 'devtools-shortcut' | 'fullscreen-exit' | 'camera-off' | 'mic-off' | 'face-missing' | 'no-face-long';

export interface ProctorWarning {
  type: ProctorEventType;
  message: string;
  at: number;
}

interface Options {
  active: boolean;               // proctoring only while the interview is active
  onEvent: (type: ProctorEventType, detail?: string) => void;
}

const WARNINGS: Record<ProctorEventType, string> = {
  'tab-switch': 'Tab switch detected — stay on the interview page.',
  'window-blur': 'You left the interview window. This has been recorded.',
  'copy-attempt': 'Copying text is disabled during the interview.',
  'paste-attempt': 'Pasting answers is not allowed. Type your own answer.',
  'screenshot-key': 'Screenshots are discouraged during the interview.',
  'devtools-shortcut': 'Developer tools shortcuts are disabled during the interview.',
  'fullscreen-exit': 'You exited fullscreen. Please return to fullscreen mode.',
  'camera-off': 'Your camera turned off — turn it back on immediately.',
  'mic-off': 'Your microphone turned off.',
  'face-missing': 'No face detected in frame. Sit in front of the camera.',
  'no-face-long': 'You have been away from the camera for too long.',
};

/**
 * Browser-side proctoring: detects and reports suspicious activity, shows live warnings.
 * Detection is best-effort by design — the server keeps the authoritative event log and score.
 */
export function useProctor({ active, onEvent }: Options) {
  const [warnings, setWarnings] = useState<ProctorWarning[]>([]);
  const [integrityScore, setIntegrityScore] = useState<number | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const fullscreenRequestedRef = useRef(false);
  const noFaceSinceRef = useRef<number | null>(null);

  const record = useCallback((type: ProctorEventType, detail?: string) => {
    if (!active) return;
    onEventRef.current(type, detail);
    setWarnings(prev => [{ type, message: WARNINGS[type], at: Date.now() }, ...prev].slice(0, 4));
  }, [active]);

  // Clear a warning after 6s
  useEffect(() => {
    if (!warnings.length) return;
    const t = setTimeout(() => setWarnings(prev => prev.slice(0, -1)), 6000);
    return () => clearTimeout(t);
  }, [warnings]);

  // ── Tab switch / window blur ─────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') record('tab-switch', 'visibilitychange');
    };
    const onBlur = () => record('window-blur', 'window blur');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [active, record]);

  // ── Clipboard, screenshot & devtools shortcuts ──────────────────────────
  useEffect(() => {
    if (!active) return;
    const onCopy = (e: Event) => { e.preventDefault(); record('copy-attempt'); };
    const onPaste = (e: Event) => { e.preventDefault(); record('paste-attempt'); };
    const onCut = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's', 'u'].includes(k)) {
        // Allow typing aids but block clipboard/print/source shortcuts.
        e.preventDefault();
        record(k === 'v' ? 'paste-attempt' : k === 'c' ? 'copy-attempt' : 'screenshot-key', `Ctrl+${k}`);
        return;
      }
      // DevTools shortcuts: F12, Ctrl+Shift+I/J/C
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
        e.preventDefault();
        record('devtools-shortcut', e.key);
      }
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [active, record]);

  // ── Fullscreen enforcement ───────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => { fullscreenRequestedRef.current = true; }).catch(() => { /* denied — continue anyway */ });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const onFsChange = () => {
      if (!document.fullscreenElement && fullscreenRequestedRef.current) {
        record('fullscreen-exit');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [active, record]);

  // ── Camera / mic track monitoring (wired to stream from the room page) ──
  const watchStream = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    videoTrack?.addEventListener('ended', () => record('camera-off', 'track ended'));
    audioTrack?.addEventListener('ended', () => record('mic-off', 'track ended'));
    if (videoTrack) {
      (videoTrack as MediaStreamTrack & { onmute: ((this: MediaStreamTrack) => void) | null }).onmute = () => record('camera-off', 'track muted');
    }
    if (audioTrack) {
      (audioTrack as MediaStreamTrack & { onmute: ((this: MediaStreamTrack) => void) | null }).onmute = () => record('mic-off', 'track muted');
    }
  }, [record]);

  // ── Face detection from camera frames ────────────────────────────────────
  // Called ~every 2-5s by the room page with a canvas frame from the webcam.
  const analyzeFrameForFace = useCallback(async (frameDataUrl: string) => {
    if (!active) return;
    try {
      // Lightweight detection via the experimental Shape Detection API when available.
      const FD = (window as any).FaceDetector;
      if (FD) {
        const detector = new FD({ fastMode: true, maxDetectedFaces: 1 });
        const bitmap = await createImageBitmap(await (await fetch(frameDataUrl)).blob());
        const faces = await detector.detect(bitmap);
        const facePresent = faces.length > 0;
        const now = Date.now();
        if (!facePresent) {
          if (noFaceSinceRef.current == null) noFaceSinceRef.current = now;
          else if (now - noFaceSinceRef.current > 10000) record('no-face-long', 'no face for 10s+');
          else if (now - noFaceSinceRef.current > 4000) record('face-missing');
        } else {
          noFaceSinceRef.current = null;
        }
      }
      // Without the Shape Detection API we simply skip visual face detection
      // (Chrome behind flag only) — camera-off/track events still cover the basics.
    } catch {
      /* detection is best-effort; never break the interview over it */
    }
  }, [active, record]);

  const dismissWarning = useCallback(() => setWarnings([]), []);

  return { warnings, integrityScore, record, watchStream, analyzeFrameForFace, enterFullscreen, dismissWarning };
}
