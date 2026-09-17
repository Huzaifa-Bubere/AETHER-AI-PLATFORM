import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  Clock,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  Sparkles,
  Shield,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { AIAvatar } from '../components/interview/AIAvatar';
import { VideoRecorder } from '../components/interview/VideoRecorder';
import { SpeechRecognition } from '../components/interview/SpeechRecognition';
import { useIntegrityMonitor } from '../features/integrity/useIntegrityMonitor';
import { DEFAULT_POLICIES } from '../features/integrity/integrity.types';
import { IntegrityIndicator } from '../features/integrity/IntegrityIndicator';
import { IntegrityWarningModal } from '../features/integrity/IntegrityWarningModal';
import { useInterviewStore } from '../stores/interviewStore';
import toast from 'react-hot-toast';

/**
 * AETHER AI Mock Interview room — light theme.
 * Integrity uses the shared backend-authoritative system: 5 recorded violations
 * automatically conclude the interview and generate the final assessment.
 */
export function InterviewRoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get('id');

  const {
    activeQuestion,
    phase,
    isSpeaking,
    isMuted,
    isListening,
    isSubmitting,
    isLoading,
    error,
    questionsAnswered,
    plannedQuestions,
    elapsedSeconds,
    resumeInterview,
    submitAnswer,
    endInterview,
    speakCurrentQuestion,
    stopSpeech,
    toggleMute,
    setIsListening,
    incrementElapsed,
    reset,
  } = useInterviewStore();

  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Resume or start interview on mount
  useEffect(() => {
    if (!interviewId) {
      toast.error('No interview ID specified.');
      navigate('/interview-setup');
      return;
    }

    void resumeInterview(interviewId);
    setQuestionStartTime(Date.now());

    return () => {
      stopSpeech();
      reset();
    };
  }, [interviewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer interval
  useEffect(() => {
    if (phase !== 'active') return;
    const interval = setInterval(() => {
      incrementElapsed();
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared integrity system (3 warnings → auto-conclude) ──────────────────
  const concludedRef = useRef(false);
  const concludeInterview = useCallback(async () => {
    if (concludedRef.current) return;
    concludedRef.current = true;
    stopSpeech();
    setIsListening(false);
    const id = await endInterview();
    if (id) {
      toast.error('Interview concluded — maximum integrity warnings reached.', { duration: 6000 });
      navigate(`/feedback/${interviewId}`);
    }
  }, [endInterview, interviewId, navigate, setIsListening, stopSpeech]);

  const integrity = useIntegrityMonitor({
    policy: DEFAULT_POLICIES.INTERVIEW,
    attemptId: interviewId ?? null,
    active: phase === 'active',
    onAutoSubmit: concludeInterview,
  });

  useEffect(() => {
    if (interviewId && phase === 'active') void integrity.restoreState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, phase]);

  useEffect(() => {
    if (phase === 'active') integrity.requestFullscreen();
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [phase]);

  // Face monitoring hooks are available for future camera frame loops:
  // integrity.reportFaceAbsent(seconds), integrity.reportMultipleFaces(seconds)

  const handleTranscript = (text: string, isFinal: boolean) => {
    if (isFinal) {
      setCandidateAnswer(prev => (prev + ' ' + text).trimStart());
    }
  };

  // Submit current answer
  const handleSubmit = async () => {
    const finalAnswer = candidateAnswer.trim();
    if (!finalAnswer) {
      toast.error('Please speak or type your answer before submitting.');
      return;
    }

    setIsListening(false);
    stopSpeech();

    const responseDuration = Math.max(5, Math.round((Date.now() - questionStartTime) / 1000));
    const result = await submitAnswer(finalAnswer, 'voice', responseDuration);

    if (result) {
      setCandidateAnswer('');
      setQuestionStartTime(Date.now());

      if (result.finished) {
        toast.success('Interview concluded! Generating explainable assessment...');
        navigate(`/feedback/${interviewId}`);
      }
    }
  };

  // Conclude interview early
  const handleEndEarly = async () => {
    setShowEndModal(false);
    stopSpeech();
    setIsListening(false);

    const res = await endInterview();
    if (res) {
      toast.success('Interview finished. Opening performance report...');
      navigate(`/feedback/${interviewId}`);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getDifficultyBadgeColor = (diff?: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'hard':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStageDisplay = (stage?: string) => {
    if (!stage) return 'Interview';
    return stage.replace(/_/g, ' ');
  };

  if (isLoading && !activeQuestion) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold">Connecting to AETHER Adaptive Interviewer...</h2>
        <p className="text-muted-foreground text-sm mt-1">Calibrating context & preparing session</p>
      </div>
    );
  }

  const locked = integrity.shouldAutoSubmit;

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden font-sans select-none">

      {/* ── Top Bar ── */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-muted-foreground hover:text-foreground px-2.5 py-1 text-xs"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>

          <span className="w-px h-4 bg-border" />

          {/* Current Stage Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {getStageDisplay(activeQuestion?.stage)}
            </span>
            {activeQuestion?.difficulty && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyBadgeColor(activeQuestion.difficulty)}`}>
                {activeQuestion.difficulty.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Integrity indicator — shared system across all assessments */}
        <div className="hidden md:flex items-center gap-2">
          <IntegrityIndicator
            warningCount={integrity.warningCount}
            maximumWarnings={integrity.maximumWarnings}
            active={phase === 'active' && !locked}
          />
        </div>

        {/* Right Timer & End button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary border border-border text-xs font-mono text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          <span className="text-xs font-semibold text-muted-foreground">
            Q {questionsAnswered + 1} / {plannedQuestions}
          </span>

          <Button
            variant="ghost"
            size="sm"
            disabled={locked}
            onClick={() => setShowEndModal(true)}
            className="text-destructive hover:bg-red-50 hover:text-destructive text-xs px-2.5 py-1 border border-red-200"
          >
            End Interview
          </Button>
        </div>
      </header>

      {/* ── Main 2-Column Layout ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">

        {/* ── Left / Center Area: AI Interviewer & Candidate Input (8 Cols) ── */}
        <div className="lg:col-span-8 flex flex-col gap-3 h-full min-h-0">

          {/* AI Question & Avatar Banner */}
          <Card className="p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-sm relative overflow-hidden shrink-0">
            {/* Avatar Container */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-indigo-50 to-secondary border border-border shrink-0 overflow-hidden relative">
              <AIAvatar
                isListening={isListening}
                isSpeaking={isSpeaking}
                emotion="thinking"
                className="w-full h-full"
              />
              {isSpeaking && (
                <span className="absolute bottom-1.5 left-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            {/* Question Text */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Topic: {activeQuestion?.topic || 'Core Engineering'}
                </span>

                {/* Audio Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute Interviewer Voice' : 'Mute Interviewer Voice'}
                    className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-destructive" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={speakCurrentQuestion}
                    title="Replay Question"
                    className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Replay</span>
                  </button>
                </div>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                {activeQuestion?.question || 'Preparing your customized interview question...'}
              </h2>

              {activeQuestion?.intent && (
                <p className="text-xs text-muted-foreground italic">
                  Focus: {activeQuestion.intent}
                </p>
              )}
            </div>
          </Card>

          {/* Candidate Response Workspace */}
          <Card className="flex-1 p-4 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm min-h-0">
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-primary" />
                  Your Response (Speak or Type)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {candidateAnswer.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              {/* Editable Answer Area */}
              <textarea
                value={candidateAnswer}
                onChange={e => setCandidateAnswer(e.target.value)}
                disabled={locked}
                placeholder={
                  isListening
                    ? 'Listening to your voice... (Live transcript will stream here, and you can edit anytime)'
                    : 'Click "Start Microphone" below to speak your answer, or type your answer directly here...'
                }
                className="flex-1 w-full p-3 bg-input-background border border-border rounded-xl text-foreground text-sm leading-relaxed resize-none focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
            </div>

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <SpeechRecognition
                  isListening={isListening}
                  onStartListening={() => setIsListening(true)}
                  onStopListening={() => setIsListening(false)}
                  onTranscript={handleTranscript}
                />
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {isListening ? 'Microphone Active · Speak clearly' : 'Microphone Paused'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !candidateAnswer.trim() || locked}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluating Answer...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answer</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right Column: Camera Preview & Session Metrics (4 Cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-3 h-full min-h-0">

          {/* Candidate Webcam */}
          <Card className="p-3 rounded-2xl flex flex-col overflow-hidden shadow-sm shrink-0">
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-border">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-primary" />
                Candidate Video Stream
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Monitoring
              </span>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-secondary relative border border-border flex items-center justify-center">
              <VideoRecorder
                isRecording={phase === 'active'}
                onStartRecording={() => {}}
                onStopRecording={() => {}}
                className="w-full h-full object-cover"
              />
            </div>
          </Card>

          {/* Interview Progress Card */}
          <Card className="flex-1 p-4 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm min-h-0">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Session Flow & Topics
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-foreground">
                  <span>Questions Progress</span>
                  <span className="font-bold text-primary">
                    {Math.round((questionsAnswered / Math.max(1, plannedQuestions)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (questionsAnswered / Math.max(1, plannedQuestions)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary border border-border space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase">Adaptive Engine Telemetry</div>
                <div className="text-xs text-foreground flex justify-between">
                  <span>Current Difficulty:</span>
                  <span className="font-semibold text-amber-600 capitalize">{activeQuestion?.difficulty || 'Medium'}</span>
                </div>
                <div className="text-xs text-foreground flex justify-between">
                  <span>Active Stage:</span>
                  <span className="font-semibold text-primary">{getStageDisplay(activeQuestion?.stage)}</span>
                </div>
                <div className="text-xs text-foreground flex justify-between">
                  <span>Mode:</span>
                  <span className="font-semibold text-emerald-600">Adaptive Dynamic Follow-ups</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground leading-relaxed pt-1">
                Tip: Speak naturally. State your technical reasoning, trade-offs, and examples from your experience.
              </div>
            </div>

            <div className="pt-2">
              <div className="p-2.5 rounded-xl bg-accent border border-border text-[11px] text-accent-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Proctored: tab switches, leaving the window, and clipboard use are recorded. At 5 warnings the interview is automatically concluded and assessed on the answers submitted so far.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Shared integrity warning modal (warnings 1–2) ── */}
      {integrity.modalEvent && !locked && (
        <IntegrityWarningModal
          event={integrity.modalEvent}
          warningNumber={integrity.modalWarningNumber}
          maximumWarnings={integrity.maximumWarnings}
          onContinue={integrity.dismissModal}
        />
      )}

      {/* ── Final-warning overlay: auto-concluding — huge full-screen red ── */}
      {integrity.submittingWork && (
        <div className="fixed inset-0 z-[210] bg-red-700 flex flex-col items-center justify-center gap-4">
          <ShieldAlert className="w-20 h-20 text-white animate-pulse" />
          <p className="text-4xl font-black tracking-tight text-white text-center px-4">INTERVIEW TERMINATED</p>
          <p className="text-lg font-bold text-red-100 text-center px-4">Maximum integrity warnings reached (5 of 5)</p>
          <p className="text-sm text-red-200 text-center px-4">Your answers are being saved and your report is being generated.</p>
        </div>
      )}

      {/* ── End Interview Confirmation Modal ── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-foreground">Conclude Interview Now?</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have answered {questionsAnswered} of {plannedQuestions} planned questions. Ending the interview now will finalize your performance assessment based on the answers submitted so far.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowEndModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Continue Interview
              </Button>
              <Button
                onClick={handleEndEarly}
                className="bg-destructive text-white hover:bg-destructive/90 font-bold"
              >
                End & View Report
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
