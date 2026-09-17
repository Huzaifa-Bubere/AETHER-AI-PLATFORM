import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * AETHER — useInterviewVoice
 * AI interviewer voice: speaks questions via browser SpeechSynthesis with
 * state synchronized to REAL TTS events (onstart/onend/onerror) — never timers.
 *
 * State machine: IDLE → THINKING → SPEAKING → LISTENING → PROCESSING → COMPLETE
 */

export type InterviewerState = 'IDLE' | 'THINKING' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETE';

interface SpeakOptions {
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
}

export function useInterviewVoice() {
  const [interviewerState, setInterviewerState] = useState<InterviewerState>('IDLE');
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [ttsSupported, setTtsSupported] = useState(true);

  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const currentOnEnd = useRef<(() => void) | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);

  /** Speak text. Sets SPEAKING on real speech start, LISTENING on real end. */
  const speak = useCallback((text: string, opts: SpeakOptions = {}) => {
    if (!('speechSynthesis' in window)) {
      setTtsSupported(false);
      setInterviewerState('LISTENING'); // text-mode fallback: candidate reads the question
      opts.onEnd?.();
      return;
    }
    window.speechSynthesis.cancel(); // stop anything in flight — never talk over
    if (mutedRef.current) {
      setInterviewerState('LISTENING');
      opts.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.volume = volumeRef.current;
    u.onstart = () => setInterviewerState('SPEAKING');
    u.onend = () => {
      setInterviewerState('LISTENING');
      currentUtterance.current = null;
      opts.onEnd?.();
    };
    u.onerror = () => {
      // TTS failed — fall back to text: let the candidate read and continue.
      setInterviewerState('LISTENING');
      currentUtterance.current = null;
      opts.onEnd?.();
    };
    currentUtterance.current = u;
    currentOnEnd.current = opts.onEnd ?? null;
    setInterviewerState('SPEAKING');
    window.speechSynthesis.speak(u);
  }, []);

  /** Stop speech immediately (mic pressed, final warning, unmount). */
  const stop = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    currentUtterance.current = null;
    if (currentOnEnd.current) { const cb = currentOnEnd.current; currentOnEnd.current = null; cb(); }
  }, []);

  /** Replay the last spoken text. */
  const replay = useCallback((text: string) => {
    speak(text);
  }, [speak]);

  const setThinking = useCallback(() => setInterviewerState('THINKING'), []);
  const setProcessing = useCallback(() => setInterviewerState('PROCESSING'), []);
  const setListening = useCallback(() => setInterviewerState('LISTENING'), []);
  const setComplete = useCallback(() => setInterviewerState('COMPLETE'), []);
  const setIdle = useCallback(() => setInterviewerState('IDLE'), []);

  return {
    interviewerState, ttsSupported,
    muted, setMuted, volume, setVolume,
    speak, stop, replay,
    setThinking, setProcessing, setListening, setComplete, setIdle,
  };
}
