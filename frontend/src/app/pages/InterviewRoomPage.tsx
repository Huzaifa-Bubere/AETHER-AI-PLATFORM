import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  Square,
  Clock,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Shield,
  Layers,
  HelpCircle,
  Video,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { AIAvatar } from '../components/interview/AIAvatar';
import { VideoRecorder } from '../components/interview/VideoRecorder';
import { SpeechRecognition } from '../components/interview/SpeechRecognition';
import { ProctoringHUD } from '../components/interview/ProctoringHUD';
import { useProctor, ProctorEventType } from '../hooks/useProctor';
import { useInterviewStore } from '../stores/interviewStore';
import toast from 'react-hot-toast';

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
    transcript,
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
    setTranscript,
    appendTranscript,
    setIsListening,
    incrementElapsed,
    recordIntegrityEvent,
    reset,
  } = useInterviewStore();

  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [proctorWarningOpen, setProctorWarningOpen] = useState(false);
  const [proctorWarningMsg, setProctorWarningMsg] = useState('');
  const [strikes, setStrikes] = useState(0);

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
    };
  }, [interviewId]);

  // Timer interval
  useEffect(() => {
    if (phase !== 'active') return;
    const interval = setInterval(() => {
      incrementElapsed();
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Sync candidateAnswer with speech transcript
  const handleTranscript = (text: string, isFinal: boolean) => {
    if (isFinal) {
      setCandidateAnswer(prev => (prev + ' ' + text).trimStart());
    }
  };

  // Integrity / Proctoring hook
  const handleProctorEvent = useCallback(
    (type: ProctorEventType, detail?: string) => {
      if (!interviewId || phase !== 'active') return;

      recordIntegrityEvent(type, detail);

      if (['tab-switch', 'window-blur', 'fullscreen-exit', 'copy-attempt', 'paste-attempt'].includes(type)) {
        setStrikes(prev => {
          const next = prev + 1;
          setProctorWarningMsg(`Integrity Warning: ${type.replace(/-/g, ' ')}. Please stay on the interview room screen.`);
          setProctorWarningOpen(true);
          return next;
        });
      }
    },
    [interviewId, phase, recordIntegrityEvent]
  );

  const proctor = useProctor({
    active: phase === 'active',
    onEvent: handleProctorEvent,
  });

  const requestFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'hard':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
  };

  const getStageDisplay = (stage?: string) => {
    if (!stage) return 'Interview';
    return stage.replace(/_/g, ' ');
  };

  if (isLoading && !activeQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold">Connecting to AETHER Adaptive Interviewer...</h2>
        <p className="text-slate-400 text-sm mt-1">Calibrating context & preparing session</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-none">

      {/* ── Top Bar ── */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white px-2.5 py-1 text-xs"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>

          <span className="w-px h-4 bg-slate-800" />

          {/* Current Stage Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {getStageDisplay(activeQuestion?.stage)}
            </span>
            {activeQuestion?.difficulty && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyBadgeColor(activeQuestion.difficulty)}`}>
                {activeQuestion.difficulty.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Proctoring status */}
        <div className="hidden md:flex items-center gap-2">
          <ProctoringHUD
            isFullscreen={isFullscreen}
            strikes={strikes}
            maxStrikes={3}
            isFlagged={strikes >= 3}
            warningModalOpen={proctorWarningOpen}
            warningMessage={proctorWarningMsg}
            onRequestFullscreen={requestFullscreen}
            onAcknowledgeWarning={() => setProctorWarningOpen(false)}
          />
        </div>

        {/* Right Timer & End button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          <span className="text-xs font-semibold text-slate-400">
            Q {questionsAnswered + 1} / {plannedQuestions}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEndModal(true)}
            className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs px-2.5 py-1 border border-rose-500/20"
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
          <Card className="bg-slate-900/80 border-slate-800/80 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-xl relative overflow-hidden shrink-0">
            {/* 3D / Visual Avatar Container */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/20 shrink-0 overflow-hidden relative shadow-inner">
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Topic: {activeQuestion?.topic || 'Core Engineering'}
                </span>

                {/* Audio Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute Interviewer Voice' : 'Mute Interviewer Voice'}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={speakCurrentQuestion}
                    title="Replay Question"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Replay</span>
                  </button>
                </div>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                {activeQuestion?.question || 'Preparing your customized interview question...'}
              </h2>

              {activeQuestion?.intent && (
                <p className="text-xs text-slate-400 italic">
                  Focus: {activeQuestion.intent}
                </p>
              )}
            </div>
          </Card>

          {/* Candidate Response Workspace */}
          <Card className="flex-1 bg-slate-900/60 border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl min-h-0">
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  Your Response (Speak or Type)
                </span>
                <span className="text-[11px] text-slate-500">
                  {candidateAnswer.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              {/* Editable Answer Area */}
              <textarea
                value={candidateAnswer}
                onChange={e => setCandidateAnswer(e.target.value)}
                placeholder={
                  isListening
                    ? 'Listening to your voice... (Live transcript will stream here, and you can edit anytime)'
                    : 'Click "Start Microphone" below to speak your answer, or type your answer directly here...'
                }
                className="flex-1 w-full p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 font-sans"
              />
            </div>

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <SpeechRecognition
                  isListening={isListening}
                  onStartListening={() => setIsListening(true)}
                  onStopListening={() => setIsListening(false)}
                  onTranscript={handleTranscript}
                />
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {isListening ? 'Microphone Active · Speak clearly' : 'Microphone Paused'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !candidateAnswer.trim()}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 flex items-center gap-2"
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
          <Card className="bg-slate-900/80 border-slate-800/80 p-3 rounded-2xl flex flex-col overflow-hidden shadow-xl shrink-0">
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-indigo-400" />
                Candidate Video Stream
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Monitoring
              </span>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 relative border border-slate-800 flex items-center justify-center">
              <VideoRecorder
                isRecording={phase === 'active'}
                onStartRecording={() => {}}
                onStopRecording={() => {}}
                className="w-full h-full object-cover"
              />
            </div>
          </Card>

          {/* Interview Progress Card */}
          <Card className="flex-1 bg-slate-900/70 border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl min-h-0">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Session Flow & Topics
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Questions Progress</span>
                  <span className="font-bold text-indigo-400">
                    {Math.round((questionsAnswered / Math.max(1, plannedQuestions)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (questionsAnswered / Math.max(1, plannedQuestions)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Adaptive Engine Telemetry</div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>Current Difficulty:</span>
                  <span className="font-semibold text-amber-400 capitalize">{activeQuestion?.difficulty || 'Medium'}</span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>Active Stage:</span>
                  <span className="font-semibold text-indigo-300">{getStageDisplay(activeQuestion?.stage)}</span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>Mode:</span>
                  <span className="font-semibold text-emerald-400">Adaptive Dynamic Follow-ups</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed pt-1">
                Tip: Speak naturally. State your technical reasoning, trade-offs, and examples from your experience.
              </div>
            </div>

            <div className="pt-2">
              <div className="p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Explainable AI Evaluation is recorded after every answer.</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── End Interview Confirmation Modal ── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-md w-full p-6 bg-slate-900 border-slate-800 text-slate-100 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Conclude Interview Now?</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              You have answered {questionsAnswered} of {plannedQuestions} planned questions. Ending the interview now will finalize your performance assessment based on the answers submitted so far.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowEndModal(false)}
                className="text-slate-400 hover:text-white"
              >
                Continue Interview
              </Button>
              <Button
                onClick={handleEndEarly}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
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
