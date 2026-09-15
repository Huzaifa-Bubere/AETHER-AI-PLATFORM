import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Brain, Mic, MicOff, AlertTriangle, Loader2, SkipForward, Square,
  ShieldCheck, ShieldAlert, Eye, ChevronLeft, CheckCircle2, Sparkles, RefreshCw, Volume2, X,
} from 'lucide-react';
import { VideoRecorder } from '../components/interview/VideoRecorder';
import { SpeechRecognition } from '../components/interview/SpeechRecognition';
import { useProctor } from '../hooks/useProctor';
import { useAdaptiveInterviewStore } from '../../store/adaptiveInterviewStore';
import adaptiveInterviewApi from '../../lib/adaptiveInterviewApi';
import toast from 'react-hot-toast';

export function AdaptiveInterviewRoomPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const {
    question, lastFeedback, answeredCount, plannedQuestions, phase, submitting, ending,
    error, domain, difficulty, submitAnswer, endInterview, resumeSession, reset,
  } = useAdaptiveInterviewStore();

  const [answer, setAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [answerStart, setAnswerStart] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const busy = useRef(false);
  const frameCount = useRef(0);
  const recordingBlobRef = useRef<Blob | null>(null);

  // ── Resume session on reload ───────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { navigate('/ai-interview', { replace: true }); return; }
    const store = useAdaptiveInterviewStore.getState();
    if (!store.sessionId || store.sessionId !== sessionId) {
      void resumeSession(sessionId);
    }
    return () => { if (useAdaptiveInterviewStore.getState().phase === 'ended') reset(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Session timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' && phase !== 'evaluating') return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ── Error toast ────────────────────────────────────────────────────────
  useEffect(() => { if (error) toast.error(error); }, [error]);

  // ── Proctoring ─────────────────────────────────────────────────────────
  const reportEvent = useCallback((type: any, detail?: string) => {
    if (!sessionId) return;
    // Integrity score is authoritative server-side; it is shown again on the report.
    adaptiveInterviewApi.reportProctorEvent(sessionId, type, detail).catch(() => {
      /* keep the interview running; server logs what it receives */
    });
  }, [sessionId]);

  const proctor = useProctor({ active: phase === 'active' || phase === 'evaluating', onEvent: reportEvent });

  useEffect(() => { proctor.enterFullscreen(); /* request once on mount */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start recording as soon as the session goes live (VideoRecorder begins capturing
  // once its own media is ready; the final blob is captured on stop for upload).
  useEffect(() => {
    if (phase === 'active' || phase === 'evaluating') setStreamReady(true);
  }, [phase]);

  // ── Submit answer ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!answer.trim()) { toast.error('Say or type an answer first'); return; }
    if (busy.current || submitting) return;
    busy.current = true;
    setIsListening(false);
    const durationSeconds = Math.round((Date.now() - answerStart) / 1000);
    const ok = await submitAnswer(answer, durationSeconds);
    if (ok) {
      setAnswer('');
      setAnswerStart(Date.now());
      setTimeout(() => setIsListening(true), 600);
    }
    busy.current = false;
  };

  // Auto end when completed — stop the recorder, save the recording, then go to the report
  useEffect(() => {
    if (phase === 'ended' && sessionId && !finishing) {
      void finishAndNavigate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId]);

  // Wait (max timeoutMs) for VideoRecorder's MediaRecorder to emit the final blob after stop.
  const waitForRecordingBlob = (timeoutMs: number): Promise<Blob | null> =>
    new Promise(resolve => {
      const startedAt = Date.now();
      const tick = () => {
        if (recordingBlobRef.current) return resolve(recordingBlobRef.current);
        if (Date.now() - startedAt > timeoutMs) return resolve(null);
        setTimeout(tick, 250);
      };
      tick();
    });

  const finishAndNavigate = async (submitPending: boolean) => {
    if (finishing || busy.current) return;
    busy.current = true;
    setFinishing(true);
    setShowEnd(false);
    setIsListening(false);
    try {
      const store = useAdaptiveInterviewStore.getState();
      // 1. Save any in-progress answer (manual end only).
      if (submitPending && answer.trim() && question) {
        await submitAnswer(answer, Math.round((Date.now() - answerStart) / 1000)).catch(() => {});
      }
      // 2. Stop the MediaRecorder and grab the final webm blob.
      setStreamReady(false);
      const blob = await waitForRecordingBlob(6000);
      // 3. Close the interview server-side (generates the report) if not already done.
      const fresh = useAdaptiveInterviewStore.getState();
      let id = fresh.sessionId;
      if (fresh.phase !== 'ended') {
        id = (await endInterview()) || id;
      }
      // 4. Attach the webcam recording — report is still generated if this fails.
      if (blob && id) {
        try {
          toast.loading('Uploading your recording…', { id: 'recording-upload' });
          const totalSeconds = fresh.startedAt ? Math.round((Date.now() - fresh.startedAt) / 1000) : undefined;
          await adaptiveInterviewApi.uploadRecording(id, blob, totalSeconds);
          toast.success('Recording attached to your report', { id: 'recording-upload' });
        } catch {
          toast.error('Recording could not be uploaded — your report is still available', { id: 'recording-upload' });
        }
      }
      if (id) navigate(`/ai-interview/${id}/report`, { replace: true });
    } finally {
      busy.current = false;
      setFinishing(false);
    }
  };

  const handleEnd = () => { void finishAndNavigate(true); };

  // ── Transcript → answer text ───────────────────────────────────────────
  const handleTranscript = (t: string, isFinal: boolean) => {
    if (isFinal) setAnswer(prev => (prev + ' ' + t).trimStart());
  };

  // ── Face analysis frames from VideoRecorder ────────────────────────────
  const handleVideoFrame = useCallback((frameData: string) => {
    frameCount.current += 1;
    if (frameCount.current % 2 === 0) void proctor.analyzeFrameForFace(frameData);
  }, [proctor]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  const progress = plannedQuestions ? Math.min(100, (answeredCount / plannedQuestions) * 100) : 0;

  // ── Loading / error gates ──────────────────────────────────────────────
  if (phase === 'idle' || (phase === 'creating' && !question)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: '#94a3b8', fontFamily: "'Sora', sans-serif" }}>
        {error
          ? <>
              <AlertTriangle style={{ width: 30, height: 30, color: '#f59e0b' }} />
              <p style={{ fontSize: 14 }}>{error}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.location.reload()} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13 }}>
                  <RefreshCw style={{ width: 13, height: 13 }} /> Retry
                </button>
                <button onClick={() => navigate('/ai-interview')} style={{ all: 'unset', cursor: 'pointer', padding: '9px 16px', borderRadius: 10, background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  New interview
                </button>
              </div>
            </>
          : <><Loader2 style={{ width: 28, height: 28, color: '#818cf8', animation: 'spin 1s linear infinite' }} /><p style={{ fontSize: 13 }}>Loading your interview…</p></>}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b1020', color: '#e2e8f0', fontFamily: "'Sora', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,16,32,0.9)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #a78bfa)', transition: 'width 0.6s' }} />
        </div>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowEnd(true)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
            <ChevronLeft style={{ width: 14, height: 14 }} /> Exit
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Brain style={{ width: 13, height: 13, color: '#a5b4fc' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#c7d2fe' }}>{domain || 'AI Interview'}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>· {difficulty}</span>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>
            Q <span style={{ color: '#a5b4fc' }}>{Math.min(answeredCount + 1, plannedQuestions)}</span>/{plannedQuestions}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <Eye style={{ width: 12, height: 12, color: proctor.warnings.length ? '#f59e0b' : '#10b981' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: proctor.warnings.length ? '#fbbf24' : '#34d399' }}>
                {proctor.warnings.length ? 'Proctoring' : 'Monitored'}
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsed)}</span>
          </div>
        </div>
      </header>

      {/* ── Proctor warnings ── */}
      {proctor.warnings.length > 0 && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'grid', gap: 8, width: 'min(420px, 90vw)' }}>
          {proctor.warnings.map((w, i) => (
            <div key={`${w.at}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, background: '#451a03', border: '1px solid #b45309', animation: 'fadeUp 0.25s ease' }}>
              <ShieldAlert style={{ width: 16, height: 16, color: '#fbbf24', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#fde68a', flex: 1 }}>{w.message}</span>
              <button onClick={proctor.dismissWarning} style={{ all: 'unset', cursor: 'pointer', color: '#d97706' }}><X style={{ width: 13, height: 13 }} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main grid ── */}
      <main style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.6fr)', gap: 14, alignItems: 'start' }}>
        {/* Left: camera + integrity */}
        <div style={{ display: 'grid', gap: 12, position: 'sticky', top: 76 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#0f172a', height: 300 }}>
            <VideoRecorder
              isRecording={streamReady}
              onStartRecording={() => setStreamReady(true)}
              onStopRecording={() => setStreamReady(false)}
              onVideoData={blob => { recordingBlobRef.current = blob; }}
              onVideoFrame={handleVideoFrame}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <ShieldCheck style={{ width: 15, height: 15, color: '#34d399', flexShrink: 0 }} />
            <p style={{ fontSize: 11.5, color: '#6ee7b7', margin: 0, lineHeight: 1.5 }}>
              Proctoring active: tab switches, copy-paste, leaving fullscreen and camera events are recorded and affect your integrity score.
            </p>
          </div>
          {lastFeedback && (
            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>Previous answer</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: lastFeedback.overallScore >= 70 ? '#34d399' : lastFeedback.overallScore >= 55 ? '#fbbf24' : '#f87171' }}>
                  {lastFeedback.overallScore}/100
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>{lastFeedback.aiSummary || 'Saved.'}</p>
            </div>
          )}
        </div>

        {/* Right: question + answer */}
        <div style={{ display: 'grid', gap: 12 }}>
          {question ? (
            <div style={{ padding: 22, borderRadius: 16, background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(168,85,247,0.06))', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {question.depth === 'follow-up' || question.depth === 'deep-dive'
                  ? <><Sparkles style={{ width: 13, height: 13, color: '#a78bfa' }} /><span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI follow-up — based on your last answer</span></>
                  : <><Volume2 style={{ width: 13, height: 13, color: '#818cf8' }} /><span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{question.topic} · {question.difficulty}</span></>}
              </div>
              <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.65, margin: 0, color: '#f1f5f9' }}>{question.text}</p>
              <p style={{ fontSize: 11.5, color: '#64748b', margin: '10px 0 0' }}>Expected speaking time: ~{question.expectedDuration} min</p>
            </div>
          ) : (
            <div style={{ padding: 22, borderRadius: 16, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 style={{ width: 18, height: 18, color: '#34d399' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#6ee7b7', margin: 0 }}>All questions completed!</p>
            </div>
          )}

          {/* Answer box */}
          <div style={{ padding: 18, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>Your answer</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: wordCount >= 50 ? '#34d399' : wordCount >= 20 ? '#fbbf24' : '#64748b' }}>
                {wordCount} words {wordCount >= 50 ? '· great length' : wordCount >= 20 ? '· keep going' : ''}
              </span>
            </div>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={submitting || !question}
              placeholder="Your spoken answer appears here — or type directly. Pasting is disabled."
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 150, resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#e2e8f0', fontSize: 14, lineHeight: 1.7, outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || submitting || !question}
                style={{ all: 'unset', cursor: !answer.trim() || submitting ? 'not-allowed' : 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, background: submitting ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', fontSize: 13.5, fontWeight: 700, opacity: !answer.trim() ? 0.5 : 1 }}
              >
                {submitting
                  ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> AI is evaluating & picking your next question…</>
                  : <><SkipForward style={{ width: 15, height: 15 }} /> Submit & Continue</>}
              </button>
              <button
                onClick={() => setShowEnd(true)}
                disabled={submitting}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '13px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600 }}
              >
                <Square style={{ width: 13, height: 13 }} /> End
              </button>
            </div>
          </div>

          {/* Speech recognition */}
          <div style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {isListening ? <Mic style={{ width: 13, height: 13, color: '#34d399' }} /> : <MicOff style={{ width: 13, height: 13, color: '#64748b' }} />}
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                {isListening ? 'Listening — speak your answer' : 'Speech recognition'}
              </span>
              <button
                onClick={() => setIsListening(v => !v)}
                style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#a5b4fc', padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.1)' }}
              >
                {isListening ? 'Pause mic' : 'Start mic'}
              </button>
            </div>
            <SpeechRecognition
              isListening={isListening}
              onStartListening={() => setIsListening(true)}
              onStopListening={() => setIsListening(false)}
              onTranscript={handleTranscript}
            />
          </div>

          {/* Evaluating banner */}
          {submitting && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Brain style={{ width: 15, height: 15, color: '#a5b4fc' }} />
              <p style={{ fontSize: 12.5, color: '#c7d2fe', margin: 0 }}>The AI is scoring your answer and deciding what to ask next…</p>
            </div>
          )}
        </div>
      </main>

      {/* ── End modal ── */}
      {showEnd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ width: 'min(420px, 100%)', padding: 26, borderRadius: 18, background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle style={{ width: 18, height: 18, color: '#f87171' }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>End this interview?</h3>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, margin: '0 0 20px' }}>
              You've answered <strong style={{ color: '#e2e8f0' }}>{answeredCount}</strong> of {plannedQuestions} planned questions.
              Your report — including the integrity score — will be generated immediately.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowEnd(false)} style={{ all: 'unset', cursor: 'pointer', flex: 1, padding: 12, borderRadius: 11, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                Keep going
              </button>
              <button onClick={handleEnd} disabled={ending} style={{ all: 'unset', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12, borderRadius: 11, background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {ending ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 style={{ width: 14, height: 14 }} />} Finish
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}

export default AdaptiveInterviewRoomPage;
