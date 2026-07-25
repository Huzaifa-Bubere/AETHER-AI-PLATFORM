import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface SpeechRecognitionProps {
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  className?: string;
}

const SR: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function SpeechRecognition({
  isListening,
  onStartListening,
  onStopListening,
  onTranscript,
  onSpeechStart,
  onSpeechEnd,
  className,
}: SpeechRecognitionProps) {
  // Use refs for everything that the recognition callbacks close over
  // so we never have stale-closure problems
  const recRef          = useRef<any>(null);
  const wantActiveRef   = useRef(false);
  const restartTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onStartRef      = useRef(onSpeechStart);
  const onEndRef        = useRef(onSpeechEnd);
  const onStopRef       = useRef(onStopListening);

  // Keep callback refs fresh without triggering re-renders
  onTranscriptRef.current = onTranscript;
  onStartRef.current      = onSpeechStart;
  onEndRef.current        = onSpeechEnd;
  onStopRef.current       = onStopListening;

  const [supported]     = useState(() => !!SR);
  const [interim, setInterim] = useState('');
  const [error, setError]     = useState('');

  // ── Volume meter — uses the stream already held by VideoRecorder ──────
  // We do NOT call getUserMedia here to avoid mic conflicts.
  // Instead we use a simple CSS animation driven by isListening state.

  // ── Create and start a fresh recognition instance ─────────────────────
  function startRecognition() {
    // Abort any existing instance first
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      recRef.current = null;
    }

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setError('');
      onStartRef.current?.();
    };

    rec.onresult = (e: any) => {
      let fin = '', intr = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else intr += t;
      }
      // Always update interim so user sees live text
      setInterim(intr);
      if (fin)  onTranscriptRef.current(fin, true);
      if (intr) onTranscriptRef.current(intr, false);
    };

    rec.onerror = (e: any) => {
      const code: string = e.error || '';
      if (code === 'aborted')  return;                    // we triggered this
      if (code === 'no-speech') {                         // silence — restart
        if (wantActiveRef.current) scheduleRestart(800);
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone permission denied. Allow mic access and retry.');
        wantActiveRef.current = false;
        onStopRef.current();
        return;
      }
      if (code === 'audio-capture') {
        setError('No microphone found. Connect a mic and retry.');
        wantActiveRef.current = false;
        onStopRef.current();
        return;
      }
      // network / unknown — restart
      if (wantActiveRef.current) scheduleRestart(1000);
    };

    rec.onend = () => {
      setInterim('');
      onEndRef.current?.();
      // Restart only if we still want to be active
      if (wantActiveRef.current) scheduleRestart(300);
    };

    recRef.current = rec;

    try {
      rec.start();
    } catch (err: any) {
      // "already started" — ignore
      if (!err.message?.includes('already started')) {
        console.warn('SpeechRecognition start error:', err);
      }
    }
  }

  function scheduleRestart(delay = 300) {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      if (wantActiveRef.current) startRecognition();
    }, delay);
  }

  function stopRecognition() {
    wantActiveRef.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
    setInterim('');
  }

  // ── React to isListening prop ─────────────────────────────────────────
  useEffect(() => {
    if (!supported) return;
    if (isListening) {
      wantActiveRef.current = true;
      startRecognition();
    } else {
      stopRecognition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, supported]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => () => {
    wantActiveRef.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  if (!supported) {
    return (
      <div className={`p-3 text-center text-xs text-yellow-700 bg-yellow-50 rounded-lg border border-yellow-200 ${className}`}>
        Speech recognition not supported in this browser.<br />
        Use Chrome or Edge, or type your answer manually.
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Mic toggle */}
      <button
        onClick={isListening ? onStopListening : onStartListening}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          isListening
            ? 'bg-green-100 border border-green-300 text-green-600 shadow-sm'
            : 'bg-gray-100 border border-gray-200 text-gray-400 hover:bg-gray-200'
        }`}
        title={isListening ? 'Stop listening' : 'Start listening'}
      >
        {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
      </button>

      {/* Animated waveform bars — CSS only, no random values */}
      {isListening && (
        <div className="flex items-end gap-0.5 h-5" aria-hidden>
          {[0, 0.15, 0.3, 0.45, 0.6, 0.45, 0.3].map((delay, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full bg-indigo-400"
              style={{
                height: '60%',
                animation: `srWave 0.8s ease-in-out ${delay}s infinite alternate`,
              }}
            />
          ))}
          <style>{`
            @keyframes srWave {
              from { transform: scaleY(0.3); }
              to   { transform: scaleY(1.0); }
            }
          `}</style>
        </div>
      )}

      {/* Status text */}
      <div className="flex-1 min-w-0 text-xs">
        {error ? (
          <span className="text-red-500">{error}</span>
        ) : isListening ? (
          interim
            ? <span className="text-gray-600 italic">{interim}</span>
            : <span className="text-gray-400">Listening… speak now</span>
        ) : (
          <span className="text-gray-400">Click mic to start</span>
        )}
      </div>
    </div>
  );
}
