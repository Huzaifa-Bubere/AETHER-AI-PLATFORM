import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Brain, Mic, MicOff, AlertTriangle, Loader2, Square, ChevronLeft, CheckCircle2,
  Sparkles, Volume2, VolumeX, RotateCcw, Send, ShieldAlert,
} from 'lucide-react';
import { VideoRecorder } from '../components/interview/VideoRecorder';
import { SpeechRecognition } from '../components/interview/SpeechRecognition';
import { AIInterviewerOrb } from '../components/interview/AIInterviewerOrb';
import { IntegrityIndicator } from '../features/integrity/IntegrityIndicator';
import { IntegrityWarningModal } from '../features/integrity/IntegrityWarningModal';
import { useIntegrityMonitor } from '../features/integrity/useIntegrityMonitor';
import { DEFAULT_POLICIES } from '../features/integrity/integrity.types';
import { toIntegrityEventType } from '../features/integrity/rules/integrityRules';
import { useEyeTracking } from '../features/integrity/eyeTracking/useEyeTracking';
import { EyeTrackingOverlay } from '../features/integrity/eyeTracking/EyeTrackingOverlay';
import { CameraStatusPanel } from '../features/integrity/eyeTracking/CameraStatusPanel';
import { CalibrationPanel, CameraRequiredModal } from '../features/integrity/eyeTracking/CalibrationPanel';
import { useInterviewVoice } from '../features/interview/useInterviewVoice';
import { useAdaptiveInterviewStore } from '../../store/adaptiveInterviewStore';
import adaptiveInterviewApi from '../../lib/adaptiveInterviewApi';
import toast from 'react-hot-toast';

/**
 * AETHER Adaptive Interview Room — light theme.
 * AI orb state machine (IDLE/THINKING/SPEAKING/LISTENING/PROCESSING/COMPLETE)
 * synchronized to real TTS events; shared integrity monitor with 5-warning auto-end.
 */
export function AdaptiveInterviewRoomPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const {
    question, lastFeedback, answeredCount, plannedQuestions, phase, submitting, ending,
    error, domain, difficulty, consentRecording, submitAnswer, endInterview, resumeSession, reset,
  } = useAdaptiveInterviewStore();

  const [answer, setAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [answerStart, setAnswerStart] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const busy = useRef(false);
  const recordingBlobRef = useRef<Blob | null>(null);
  const recordingStartedAt = useRef<number | null>(null);
  // Shared with VideoRecorder: the landmark overlay and the <video> must occupy
  // EXACTLY the same box, and MediaPipe must read the same live stream.
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [cameraLost, setCameraLost] = useState(false);
  const [cameraRetryToken, setCameraRetryToken] = useState(0);

  const voice = useInterviewVoice();

  // ── Resume session on reload ───────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { navigate('/interview', { replace: true }); return; }
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

  useEffect(() => { if (error) toast.error(error); }, [error]);

  // ── Integrity monitor (shared system) ──────────────────────────────────
  const integrityActive = (phase === 'active' || phase === 'evaluating') && !finishing;

  const finishAndNavigate = useCallback(async (submitPending: boolean, integrityTermination = false) => {
    if (finishing || busy.current) return;
    busy.current = true;
    setFinishing(true);
    setShowEnd(false);
    setIsListening(false);
    voice.stop();
    try {
      const store = useAdaptiveInterviewStore.getState();
      if (submitPending && answer.trim() && question) {
        await submitAnswer(answer, Math.round((Date.now() - answerStart) / 1000)).catch(() => {});
      }
      setStreamReady(false);
      // Grab the final recording blob (best effort — never blocks the report).
      const blob = await new Promise<Blob | null>(resolve => {
        const startedAt = Date.now();
        const tick = () => {
          if (recordingBlobRef.current) return resolve(recordingBlobRef.current);
          if (Date.now() - startedAt > 4000) return resolve(null);
          setTimeout(tick, 250);
        };
        if (integrityTermination) resolve(null); else tick();
      });
      const fresh = useAdaptiveInterviewStore.getState();
      let id = fresh.sessionId;
      if (fresh.phase !== 'ended') id = (await endInterview(integrityTermination ? 'INTEGRITY_WARNING_LIMIT' : undefined)) || id;
      if (id && blob) {
        // Never upload a zero-byte Blob (spec §4D) — say exactly what happened.
        if (blob.size <= 0) {
          toast.error('Recording contains no media data. Your report is still available.', { id: 'recording-upload' });
        } else {
          const durationSeconds = recordingStartedAt.current
            ? Math.round((Date.now() - recordingStartedAt.current) / 1000)
            : undefined;
          try {
            toast.loading('Uploading your recording…', { id: 'recording-upload' });
            await adaptiveInterviewApi.uploadRecording(id, blob, durationSeconds);
            toast.success('Recording attached', { id: 'recording-upload' });
          } catch (err: any) {
            // Bounded retry already happened inside uploadRecording; surface the cause.
            const reason = err?.response?.data?.error || err?.message || 'upload failed';
            toast.error(`Recording not uploaded (${reason}) — your report is still available`, { id: 'recording-upload', duration: 6000 });
          }
        }
      }
      if (id) navigate(`/interview/${id}/report${integrityTermination ? '?integrity=terminated' : ''}`, { replace: true });
    } finally {
      busy.current = false;
      setFinishing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishing, answer, question, answerStart, endInterview, navigate, submitAnswer, voice]);

  const integrity = useIntegrityMonitor({
    policy: DEFAULT_POLICIES.INTERVIEW,
    attemptId: sessionId ?? null,
    active: integrityActive,
    onAutoSubmit: () => finishAndNavigate(false, true),
  });

  useEffect(() => { integrity.requestFullscreen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sessionId && phase === 'active') void integrity.restoreState(); }, [sessionId, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MediaPipe eye tracking (spec Parts C–T) ────────────────────────────
  // ONE observation stream → ONE rules engine → the ONE existing backend event
  // log. No second proctoring system, no local warning counter: the engine
  // coalesces each incident into a single event and `integrity.report` remains
  // the only thing that talks to the backend.
  const eyeTracking = useEyeTracking({
    videoRef: cameraVideoRef,
    active: integrityActive,
    enabled: Boolean(sessionId),
    onEvent: (event, decision) => {
      // The engine's timestamps are monotonic (performance.now) so a whole
      // interview can be replayed in tests; the backend needs wall-clock, so the
      // incident's start is reconstructed from its real measured duration.
      void integrity.report(
        toIntegrityEventType(event.type),
        {
          ...event.metadata,
          trackingState: decision.trackingState,
          eyeState: decision.eyeState,
          gaze: decision.debug.gaze,
        },
        {
          severity: event.severity,
          startedAt: new Date(Date.now() - event.durationMs),
          endedAt: null,
          durationMs: event.durationMs,
        },
      );
    },
    onMediaTrackEnded: () => setCameraLost(true),
  });

  // ── AI speaks every new question (real TTS events drive the orb) ───────
  const spokenQuestionId = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'active' || !question) return;
    if (spokenQuestionId.current === question.id) return;
    spokenQuestionId.current = question.id;
    voice.setThinking();
    const t = setTimeout(() => {
      voice.speak(question.text);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, phase]);

  // Mic pressed while AI speaks → stop the voice first (never talk over the candidate)
  const handleMicToggle = () => {
    if (!isListening && voice.interviewerState === 'SPEAKING') voice.stop();
    setIsListening(v => !v);
  };

  // ── Recording + camera state ───────────────────────────────────────────
  // Recording starts ONLY after explicit consent (spec §4E). If the candidate
  // declined, the camera stream is never recorded and the report shows no
  // recording without treating it as an error.
  useEffect(() => {
    if (!consentRecording) { setStreamReady(false); return; }
    if (phase === 'active' || phase === 'evaluating') {
      if (recordingStartedAt.current == null) recordingStartedAt.current = Date.now();
      setStreamReady(true);
    }
  }, [phase, consentRecording]);

  // ── Submit answer ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!answer.trim()) { toast.error('Say or type an answer first'); return; }
    if (busy.current || submitting) return;
    busy.current = true;
    setIsListening(false);
    voice.setProcessing();
    const durationSeconds = Math.round((Date.now() - answerStart) / 1000);
    const ok = await submitAnswer(answer, durationSeconds);
    if (ok) {
      setAnswer('');
      setAnswerStart(Date.now());
    } else {
      voice.setListening();
    }
    busy.current = false;
  };

  // Auto end when completed
  useEffect(() => {
    if (phase === 'ended' && sessionId && !finishing) voice.setComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId]);

  const handleTranscript = (t: string, isFinal: boolean) => {
    if (isFinal) setAnswer(prev => (prev + ' ' + t).trimStart());
  };

  const locked = integrity.shouldAutoSubmit || finishing;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  const progress = plannedQuestions ? Math.min(100, (answeredCount / plannedQuestions) * 100) : 0;

  // ── Loading gate ───────────────────────────────────────────────────────
  if (phase === 'idle' || (phase === 'creating' && !question)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        {error ? (
          <div className="text-center space-y-3 p-6">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-700">{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-white border border-border text-sm font-medium">Retry</button>
              <button onClick={() => navigate('/interview')} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold">New interview</button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Preparing your adaptive interview…</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => setShowEnd(true)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" aria-label="Exit interview">
            <ChevronLeft className="w-4 h-4" /> Exit
          </button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/15">
            <Brain className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">{domain || 'AI Interview'}</span>
            <span className="text-[11px] text-muted-foreground">· {difficulty}</span>
          </div>
          <span className="text-xs font-semibold text-slate-600">Question {Math.min(answeredCount + 1, plannedQuestions)} of {plannedQuestions}</span>
          <div className="ml-auto flex items-center gap-2.5">
            <IntegrityIndicator warningCount={integrity.warningCount} maximumWarnings={integrity.maximumWarnings} active={integrityActive} />
            <span className="text-sm font-semibold tabular-nums text-slate-700">{fmt(elapsed)}</span>
          </div>
        </div>
        <div className="h-0.5 bg-slate-100"><div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      </header>

      {/* Main grid */}
      <main className="flex-1 min-h-0 max-w-[1400px] w-full mx-auto px-4 py-4 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)] gap-4 overflow-y-auto lg:overflow-hidden">
        {/* Left: interviewer + camera */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* AI interviewer card */}
          <div className="rounded-2xl bg-white border border-border p-6 flex flex-col items-center justify-center gap-3">
            <AIInterviewerOrb state={voice.interviewerState} size={190} />
            {/* voice controls */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button onClick={() => question && voice.replay(question.text)} disabled={!question || voice.interviewerState === 'SPEAKING'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium hover:bg-slate-50 disabled:opacity-40" aria-label="Replay question">
                <RotateCcw className="w-3.5 h-3.5" /> Replay
              </button>
              <button onClick={() => { voice.setMuted(m => !m); voice.stop(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium hover:bg-slate-50" aria-label={voice.muted ? 'Unmute interviewer' : 'Mute interviewer'}>
                {voice.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />} {voice.muted ? 'Muted' : 'Voice on'}
              </button>
              <input type="range" min={0} max={1} step={0.1} value={voice.volume} aria-label="Voice volume"
                onChange={e => voice.setVolume(Number(e.target.value))} className="w-20 accent-blue-600" />
            </div>
          </div>

          {/* camera — live video with the real landmark overlay on top */}
          <div className="relative rounded-2xl overflow-hidden border border-border bg-slate-900 h-[240px] lg:h-[220px] shrink-0">
            <VideoRecorder
              isRecording={streamReady}
              onStartRecording={() => setStreamReady(true)}
              onStopRecording={() => setStreamReady(false)}
              onVideoData={blob => { recordingBlobRef.current = blob; }}
              videoRef={cameraVideoRef}
              mirror={false}
              retryToken={cameraRetryToken}
              onVideoEnabledChange={enabled => { if (!enabled) integrity.reportCameraDisabled(); }}
            >
              {/* Every stroke below is drawn from the current frame's REAL
                  MediaPipe landmarks — never a decorative shape. */}
              <EyeTrackingOverlay
                videoRef={cameraVideoRef}
                frameRef={eyeTracking.frameRef}
                active={integrityActive}
                showOverlay={showOverlay}
                mirrored={false}
                eyeState={eyeTracking.status.eyeState}
              />
            </VideoRecorder>
          </div>

          {/* Assessment integrity card (spec Part Z) — text always accompanies colour */}
          <CameraStatusPanel
            cameraActive={streamReady && !cameraLost}
            facePresent={eyeTracking.status.facePresent}
            faceCount={eyeTracking.status.faceCount}
            eyeState={eyeTracking.status.eyeState}
            trackingState={cameraLost ? 'CAMERA_LOST' : eyeTracking.status.trackingState}
            gaze={eyeTracking.status.gaze}
            warningCount={integrity.warningCount}
            maximumWarnings={integrity.maximumWarnings}
            trackingError={eyeTracking.status.error}
          />

          {/* Calibration (spec Part H) — offered until a neutral baseline exists */}
          {eyeTracking.calibrationPhase !== 'READY' && (
            <CalibrationPanel
              phase={eyeTracking.calibrationPhase}
              progress={eyeTracking.calibrationProgress}
              hasBaseline={Boolean(eyeTracking.baseline)}
              cameraReady={streamReady && !cameraLost}
              onStart={eyeTracking.startCalibration}
              onCancel={eyeTracking.cancelCalibration}
              onSkip={eyeTracking.cancelCalibration}
            />
          )}

          <label className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={e => setShowOverlay(e.target.checked)}
              className="accent-blue-600"
            />
            Show tracking overlay (eye landmarks)
          </label>
        </div>

        {/* Right: question + answer */}
        <div className="flex flex-col gap-4 min-h-0">
          {question ? (
            <div className="rounded-2xl bg-white border border-border p-6">
              <div className="flex items-center gap-2 mb-3">
                {question.depth === 'follow-up' || question.depth === 'deep-dive'
                  ? <><Sparkles className="w-3.5 h-3.5 text-indigo-500" /><span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">AI follow-up · based on your last answer</span></>
                  : <><Volume2 className="w-3.5 h-3.5 text-blue-600" /><span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">{question.topic} · {question.difficulty}</span></>}
              </div>
              <p className="text-[17px] font-semibold leading-relaxed text-slate-900">{question.text}</p>
              <p className="text-xs text-slate-400 mt-2">Expected speaking time: ~{question.expectedDuration} min</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">All questions completed!</p>
            </div>
          )}

          {/* transcript / answer */}
          <div className="rounded-2xl bg-white border border-border p-5 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live transcript</span>
              <span className={`text-xs font-semibold ${wordCount >= 50 ? 'text-emerald-600' : wordCount >= 20 ? 'text-amber-600' : 'text-slate-400'}`}>
                {wordCount} words
              </span>
            </div>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={submitting || !question || locked}
              placeholder="Your spoken answer appears here — or type directly."
              className="w-full flex-1 min-h-[140px] resize-y rounded-xl border border-border bg-slate-50 p-3.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-60"
              aria-label="Your answer"
            />
            <div className="mt-3 flex gap-2.5">
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || submitting || !question || locked}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing your response…</>
                  : <><Send className="w-4 h-4" /> Submit answer</>}
              </button>
              <button onClick={() => setShowEnd(true)} disabled={submitting || locked}
                className="flex items-center gap-1.5 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold disabled:opacity-50">
                <Square className="w-3.5 h-3.5" /> End
              </button>
            </div>
          </div>

          {/* speech recognition */}
          <div className="rounded-2xl bg-white border border-border p-4 shrink-0">
            <div className="flex items-center gap-2 mb-2.5">
              {isListening ? <Mic className="w-3.5 h-3.5 text-emerald-600" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isListening ? 'Listening — speak your answer' : 'Microphone'}
              </span>
              <button onClick={handleMicToggle} disabled={locked}
                className="ml-auto px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-40">
                {isListening ? 'Stop recording' : 'Start answering'}
              </button>
            </div>
            <SpeechRecognition
              isListening={isListening}
              onStartListening={() => setIsListening(true)}
              onStopListening={() => setIsListening(false)}
              onTranscript={handleTranscript}
            />
          </div>
        </div>
      </main>

      {/* Camera required (spec Part AA) — blocking, because a protected
          interview cannot continue without a live feed. */}
      {cameraLost && !locked && (
        <CameraRequiredModal
          onRetry={() => { setCameraLost(false); setCameraRetryToken(t => t + 1); }}
          onEnd={() => void finishAndNavigate(true)}
        />
      )}

      {/* integrity warning modal (warnings 1–4) */}
      {integrity.modalEvent && !locked && (
        <IntegrityWarningModal
          event={integrity.modalEvent}
          warningNumber={integrity.modalWarningNumber}
          maximumWarnings={integrity.maximumWarnings}
          onContinue={integrity.dismissModal}
        />
      )}

      {/* auto-submit overlay (warning 5) — huge full-screen red */}
      {integrity.submittingWork && (
        <div className="fixed inset-0 z-[210] bg-red-700 flex flex-col items-center justify-center gap-4">
          <ShieldAlert className="w-20 h-20 text-white animate-pulse" />
          <p className="text-4xl font-black tracking-tight text-white text-center px-4">INTERVIEW TERMINATED</p>
          <p className="text-lg font-bold text-red-100 text-center px-4">Maximum integrity warnings reached (5 of 5)</p>
          <p className="text-sm text-red-200 text-center px-4">Your completed answers are being saved and assessed.</p>
        </div>
      )}

      {/* End modal */}
      {showEnd && !locked && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-border p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
              <h3 className="text-base font-bold">End this interview?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              You've answered <strong className="text-slate-900">{answeredCount}</strong> of {plannedQuestions} planned questions.
              Your report will be generated immediately.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowEnd(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold hover:bg-slate-200">Keep going</button>
              <button onClick={() => void finishAndNavigate(true)} disabled={ending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60">
                {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdaptiveInterviewRoomPage;
