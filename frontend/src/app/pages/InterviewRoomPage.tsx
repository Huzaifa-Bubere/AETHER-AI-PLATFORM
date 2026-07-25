import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Play, Pause, Square, SkipForward, Clock, MessageSquare,
  ChevronLeft, AlertCircle, Loader2, Mic, MicOff,
  CheckCircle2, X, Video,
} from 'lucide-react';
import { VideoRecorder } from '../components/interview/VideoRecorder';
import { SpeechRecognition } from '../components/interview/SpeechRecognition';
import { useSocket } from '../hooks/useSocket';
import { useInterviewStore } from '../stores/interviewStore';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root { height: 100%; overflow: hidden; }

  .ir {
    font-family: 'Sora', system-ui, sans-serif;
    background: #f0f2f8;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #0f172a;
  }

  /* ── Animations ── */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ripple    { to{transform:scale(2.6);opacity:0} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0.2} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes slidein   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse-glow{ 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.3)} 50%{box-shadow:0 0 0 8px rgba(99,102,241,0)} }
  @keyframes waveform  { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }

  /* ── Cards ── */
  .ir-card {
    background: #ffffff;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .ir-card-inset {
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e9eef5;
  }

  /* ── Buttons ── */
  .ir-btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 7px; padding: 10px 18px; border-radius: 10px;
    font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer; border: none; transition: all 0.15s;
    white-space: nowrap; letter-spacing: -0.01em;
  }
  .ir-btn:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }
  .ir-btn:not(:disabled):hover  { transform: translateY(-1px); }
  .ir-btn:not(:disabled):active { transform: scale(0.97); }

  .btn-primary {
    background: linear-gradient(135deg, #6366f1, #818cf8);
    color: #fff;
    box-shadow: 0 4px 14px rgba(99,102,241,0.3);
  }
  .btn-primary:not(:disabled):hover { box-shadow: 0 6px 20px rgba(99,102,241,0.45); }
  .btn-ghost   { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
  .btn-ghost:not(:disabled):hover   { background: #e8eef5; color: #334155; }
  .btn-pause   { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .btn-pause:not(:disabled):hover   { background: #fef3c7; }
  .btn-danger  { background: #fff1f1; color: #ef4444; border: 1px solid #fecaca; }
  .btn-danger:not(:disabled):hover  { background: #fee2e2; }
  .btn-success {
    background: linear-gradient(135deg, #10b981, #34d399);
    color: #fff;
    box-shadow: 0 4px 14px rgba(16,185,129,0.28);
  }
  .btn-success:not(:disabled):hover { box-shadow: 0 6px 20px rgba(16,185,129,0.4); }

  /* ── Textarea ── */
  .ir-textarea {
    width: 100%; border-radius: 10px; padding: 14px 16px;
    font-family: inherit; font-size: 14px; line-height: 1.75;
    color: #1e293b; background: #f8fafc;
    border: 1.5px solid #e2e8f0; resize: none; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .ir-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
  .ir-textarea::placeholder { color: #b0bac9; font-size: 13px; }

  /* ── Labels ── */
  .section-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #94a3b8;
  }

  /* ── Tags ── */
  .tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 600; }
  .tag-easy   { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .tag-medium { background: #fef9c3; color: #a16207; border: 1px solid #fde68a; }
  .tag-hard   { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
  .tag-type   { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
  .tag-time   { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

  /* ── Live dot ── */
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; animation: blink 1.2s ease infinite; }

  /* ── Progress bar ── */
  .prog-track { height: 2px; background: #e9eef5; }
  .prog-fill  { height: 100%; transition: width 0.6s ease; background: linear-gradient(90deg, #6366f1, #a78bfa); }

  /* VideoRecorder fills its container naturally — no overrides needed */

  /* ── Waveform bars ── */
  .wave-bar {
    width: 3px; border-radius: 99px; background: #6366f1;
    animation: waveform 0.8s ease-in-out infinite;
  }

  /* ── Mono font for timer ── */
  .mono { font-family: 'DM Mono', monospace; }

  /* ── Overlay ── */
  .ir-overlay {
    position: fixed; inset: 0; background: rgba(15,23,42,0.4);
    backdrop-filter: blur(6px); display: flex; align-items: center;
    justify-content: center; z-index: 200; padding: 16px;
  }

  /* ── Divider ── */
  .vdiv { width: 1px; height: 20px; background: #e2e8f0; flex-shrink: 0; }

  /* ── Status pill ── */
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 11px; border-radius: 99px; font-size: 11px; font-weight: 600;
  }
`;

export function InterviewRoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get('id');
  const { user } = useAuthStore();

  const {
    currentInterview, currentSession, currentQuestion,
    currentQuestionIndex, isRecording, isLoading, error,
    startInterview, endInterview, getNextQuestion,
    submitResponse, startRecording, stopRecording, clearError,
  } = useInterviewStore();

  const [sessionState, setSessionState] = useState<'setup'|'active'|'paused'|'ended'>('setup');
  const [currentAnswer, setCurrentAnswer]       = useState('');
  const [timeElapsed, setTimeElapsed]           = useState(0);
  const [isListening, setIsListening]           = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number|null>(null);
  const [showEndConfirm, setShowEndConfirm]     = useState(false);
  const [latestRecordingBlob, setLatestRecordingBlob] = useState<Blob | null>(null);
  const [liveEmotionSummary, setLiveEmotionSummary] = useState<string>('—');
  const [liveFillerPct, setLiveFillerPct] = useState<number | null>(null);
  const { isConnected, joinInterview, leaveInterview, sendVideoFrame, sendAudioChunk, on, off } = useSocket({ autoConnect: true });

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (sessionState === 'active') t = setInterval(() => setTimeElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [sessionState]);

  useEffect(() => {
    if (!interviewId) { toast.error('No interview ID'); navigate('/interview-setup'); return; }
    // Bug 5 fix: always reset session when mounting with a new interviewId
    // so stale currentSession from a previous interview doesn't skip startInterview
    const store = useInterviewStore.getState();
    const existingId = (store.currentSession as any)?.interviewId?.toString()
      || (store.currentInterview as any)?._id?.toString()
      || store.currentInterview?.id;
    if (existingId && existingId !== interviewId) {
      store.resetSession();
    }
    if (!store.currentSession) handleStartInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  useEffect(() => { if (error) toast.error(error); }, [error]);

  useEffect(() => {
    if (!interviewId || !isConnected) return;
    joinInterview(interviewId);
    const videoHandler = (data: any) => {
      const emotions = data?.emotions || {};
      const top = Object.entries(emotions).sort((a: any, b: any) => Number(b[1]) - Number(a[1]))[0];
      setLiveEmotionSummary(top ? `${top[0]} (${Math.round(Number(top[1]) * 100)}%)` : 'neutral');
    };
    const audioHandler = (data: any) => {
      if (typeof data?.fillerPercentage === 'number') {
        setLiveFillerPct(data.fillerPercentage);
      }
    };
    on('video-analysis', videoHandler as any);
    on('audio-analysis', audioHandler as any);
    return () => {
      off('video-analysis', videoHandler as any);
      off('audio-analysis', audioHandler as any);
      leaveInterview(interviewId);
    };
  }, [interviewId, isConnected, joinInterview, leaveInterview, on, off]);

  const handleStartInterview = async () => {
    if (!interviewId) return;
    try {
      await startInterview(interviewId);
      startRecording(); // Bug 8 fix: start recording when interview begins
      setSessionState('active');
      setIsListening(true);
      setResponseStartTime(Date.now());
    } catch { toast.error('Failed to start interview'); }
  };

  const handleEndInterview = async () => {
    setShowEndConfirm(false);
    try {
      await endInterview();
      setSessionState('ended');
      toast.success('Interview completed! Generating report…');
      const id = (currentInterview as any)?._id || currentInterview?.id;
      navigate(id ? `/feedback/${id}` : '/dashboard');
    } catch { toast.error('Failed to end interview'); navigate('/dashboard'); }
  };

  const handleNextQuestion = async () => {
    if (!currentAnswer.trim()) { toast.error('Please provide an answer first'); return; }
    if (!currentQuestion || !responseStartTime) return;
    try {
      const duration = Math.round((Date.now() - responseStartTime) / 1000);
      // Bug 6 fix: await submitResponse so the response is saved before fetching next question
      await submitResponse({ questionId: currentQuestion.id, answer: currentAnswer, duration, timestamp: new Date() });
      setCurrentAnswer('');
      setIsListening(false); // Bug 7 fix: stop listening before fetching next question
      await getNextQuestion();
      // Bug 7 fix: only start listening AFTER new question is loaded
      setIsListening(true);
      setResponseStartTime(Date.now());
    } catch { toast.error('Failed to get next question'); }
  };

  const handleTranscript = (t: string, isFinal: boolean) => {
    if (isFinal) {
      setCurrentAnswer(prev => (prev + ' ' + t).trimStart());
      if (interviewId && t.trim()) {
        sendAudioChunk({
          interviewId,
          transcript: t.trim(),
          timestamp: Date.now(),
        });
      }
    }
  };

  // Auto-show end confirm when all questions are answered
  useEffect(() => {
    if (sessionState === 'active' && !currentQuestion && currentQuestionIndex > 0) {
      // Small delay so the user sees the "All questions completed" state first
      const t = setTimeout(() => setShowEndConfirm(true), 1500);
      return () => clearTimeout(t);
    }
  }, [currentQuestion, sessionState, currentQuestionIndex]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const totalQ    = currentInterview?.questions?.length || 0;
  const qIndex    = currentQuestionIndex || 0 + 1;
  const progress  = totalQ > 0 ? (qIndex / totalQ) * 100 : 0;
  const wordCount = currentAnswer.split(' ').filter(Boolean).length;
  const diffTag   = (d?: string) => d === 'easy' ? 'tag-easy' : d === 'medium' ? 'tag-medium' : 'tag-hard';

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) return (
    <div className="ir" style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:24,minHeight:'100vh' }}>
      <style>{styles}</style>
      <div className="ir-card" style={{ maxWidth:400,width:'100%',padding:32,textAlign:'center' }}>
        <div style={{ width:52,height:52,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
          <AlertCircle style={{ width:24,height:24,color:'#f87171' }} />
        </div>
        <h2 style={{ fontSize:18,fontWeight:700,marginBottom:8,color:'#e2e8f0' }}>Something went wrong</h2>
        <p style={{ color:'#64748b',fontSize:13,marginBottom:24,lineHeight:1.65 }}>{error}</p>
        <div style={{ display:'flex',gap:10 }}>
          <button className="ir-btn btn-ghost" style={{ flex:1 }} onClick={clearError}>Try again</button>
          <button className="ir-btn btn-primary" style={{ flex:1 }} onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </div>
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading && !currentSession) return (
    <div className="ir" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <style>{styles}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:52,height:52,borderRadius:'50%',background:'rgba(99,102,241,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
          <Loader2 style={{ width:24,height:24,color:'#818cf8',animation:'spin 1s linear infinite' }} />
        </div>
        <p style={{ fontWeight:600,color:'#e2e8f0',marginBottom:4 }}>Setting up your interview</p>
        <p style={{ fontSize:13,color:'#4b5578' }}>Just a moment…</p>
      </div>
    </div>
  );

  // ── Main ───────────────────────────────────────────────────────────────
  return (
    <div className="ir">
      <style>{styles}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{ background:'#ffffff',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:50 }}>
        <div className="prog-track">
          <div className="prog-fill" style={{ width:`${progress}%` }} />
        </div>

        <div style={{ maxWidth:1280,margin:'0 auto',padding:'0 20px',height:54,display:'flex',alignItems:'center',gap:10 }}>
          {/* Exit */}
          <button className="ir-btn btn-ghost" style={{ padding:'7px 13px',fontSize:12 }} onClick={() => navigate('/dashboard')}>
            <ChevronLeft style={{ width:14,height:14 }} />Exit
          </button>

          <div className="vdiv" />

          {/* Live / Paused badge */}
          {sessionState === 'active' && (
            <div className="status-pill" style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)' }}>
              <div className="live-dot" />
              <span style={{ color:'#f87171' }}>LIVE</span>
            </div>
          )}
          {sessionState === 'paused' && (
            <div className="status-pill" style={{ background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.2)' }}>
              <span style={{ color:'#fbbf24' }}>PAUSED</span>
            </div>
          )}

          {/* Q progress dots */}
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <MessageSquare style={{ width:13,height:13,color:'#94a3b8' }} />
            <span style={{ fontSize:13,fontWeight:600,color:'#374151' }}>
              Q&nbsp;<span style={{ color:'#6366f1' }}>{qIndex}</span>
              <span style={{ color:'#9ca3af',fontWeight:400 }}> / {totalQ}</span>
            </span>
            <div style={{ display:'flex',gap:3,alignItems:'center' }}>
              {Array.from({ length: totalQ }).map((_, i) => (
                <div key={i} style={{
                  borderRadius:'50%',transition:'all 0.3s',
                  width: i === qIndex - 1 ? 9 : 5,
                  height: i === qIndex - 1 ? 9 : 5,
                  background: i < qIndex ? '#6366f1' : '#dde1eb',
                }} />
              ))}
            </div>
          </div>

          <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:10 }}>
            {/* Timer */}
            <div style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0' }}>
              <Clock style={{ width:12,height:12,color: timeElapsed>2400 ? '#ef4444' : '#94a3b8' }} />
              <span className="mono" style={{ fontSize:13,fontWeight:500,color: timeElapsed>2400 ? '#ef4444' : '#374151',letterSpacing:'0.04em' }}>
                {fmt(timeElapsed)}
              </span>
            </div>
            {/* Avatar */}
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <div style={{ width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',boxShadow:'0 2px 10px rgba(99,102,241,0.3)' }}>
                {user?.profile.firstName?.charAt(0) || 'U'}
              </div>
              <span style={{ fontSize:12,fontWeight:500,color:'#374151' }}>{user?.profile.firstName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══ QUESTION BANNER ════════════════════════════════════════════════ */}
      {currentQuestion && sessionState !== 'setup' && (
        <div style={{ background:'#f8fafc',borderBottom:'1px solid #e2e8f0',animation:'slidein 0.3s ease' }}>
          <div style={{ maxWidth:1280,margin:'0 auto',padding:'14px 24px',display:'flex',alignItems:'flex-start',gap:14 }}>
            <div style={{ width:30,height:30,borderRadius:8,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1,border:'1px solid #ddd6fe' }}>
              <MessageSquare style={{ width:13,height:13,color:'#7c3aed' }} />
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:14.5,fontWeight:600,color:'#1e293b',lineHeight:1.65,margin:'0 0 8px' }}>
                {currentQuestion.text}
              </p>
              <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                <span className={`tag ${diffTag(currentQuestion.difficulty)}`}>{currentQuestion.difficulty}</span>
                <span className="tag tag-type">{currentQuestion.type}</span>
                <span className="tag tag-time">~{currentQuestion.expectedDuration} min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MAIN LAYOUT — 2-column (left area + controls) ══════════════ */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: 10,
        padding: '10px 14px 12px',
        minHeight: 0,
      }}>

        {/* ══ LEFT AREA: Camera + Answer on top row, Speech full-width below ══ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2.2fr 2.2fr',
          gridTemplateRows: '1fr 0.4fr',
          gap: 10,
          minHeight: 0,
          overflow: 'hidden',
        }}>

          {/* Camera — row 1, col 1 — same height as Answer */}
          <div className="ir-card" style={{ overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0, padding:'10px' }}>
            <div style={{ padding:'7px 11px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <Video style={{ width:11,height:11,color:'#94a3b8' }} />
                <span className="section-label" style={{ fontSize:'9px' }}>Your Camera</span>
              </div>
              {isRecording && (
                <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                  <div className="live-dot" style={{ width:5,height:5 }} />
                  <span style={{ fontSize:'9px',fontWeight:700,color:'#ef4444' }}>REC</span>
                </div>
              )}
            </div>
            <div style={{ flex:1,minHeight:0,overflow:'hidden',position:'relative',height:'100%' }}>
              <VideoRecorder
                isRecording={isRecording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onVideoData={(blob) => {
                  setLatestRecordingBlob(blob);
                }}
                onVideoFrame={(frameData) => {
                  if (!interviewId || !isConnected) return;
                  sendVideoFrame({
                    interviewId,
                    frameData,
                    timestamp: Date.now(),
                  });
                }}
              />
            </div>
          </div>

          {/* Answer textarea — row 1, col 2 */}
          <div className="ir-card" style={{ display:'flex',flexDirection:'column',padding:14,minHeight:0,overflow:'hidden' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9,flexShrink:0 }}>
              <span className="section-label">Your Answer</span>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:11,fontWeight:600,color: wordCount>=50 ? '#059669' : wordCount>=20 ? '#d97706' : '#94a3b8',transition:'color 0.3s' }}>
                  {wordCount >= 50 ? `✓ ${wordCount} words` : `${wordCount} words`}
                </span>
                {currentAnswer && (
                  <button
                    onClick={() => setCurrentAnswer('')}
                    style={{ all:'unset',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontSize:11,color:'#94a3b8',padding:'2px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',transition:'all 0.15s' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color='#ef4444'; el.style.borderColor='#fca5a5'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color='#94a3b8'; el.style.borderColor='#e2e8f0'; }}
                  >
                    <X style={{ width:10,height:10 }} />Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              className="ir-textarea"
              style={{ flex:1,resize:'none',minHeight:0,height:'100%' }}
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              placeholder={"Your answer will appear here as you speak…\n\nOr type directly below."}
            />

            {/* Completeness bar */}
            <div style={{ marginTop:10,flexShrink:0 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                <span style={{ fontSize:'9.5px',color:'#94a3b8',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.06em' }}>Completeness</span>
                <span style={{ fontSize:11,fontWeight:600,color: wordCount>=50?'#059669':wordCount>=20?'#d97706':'#94a3b8',transition:'color 0.3s' }}>
                  {wordCount>=50?'✓ Great answer':wordCount>=20?'Getting there':wordCount>0?'Keep going…':'Not started'}
                </span>
              </div>
              <div style={{ height:3,background:'#e9eef5',borderRadius:99,overflow:'hidden' }}>
                <div style={{ height:'100%',borderRadius:99,transition:'width 0.4s,background 0.4s',width:`${Math.min(100,(wordCount/60)*100)}%`,background:wordCount>=50?'#10b981':wordCount>=20?'#f59e0b':'#6366f1' }} />
              </div>
            </div>

            {/* Coaching tip */}
            {sessionState === 'active' && wordCount === 0 && (
              <div style={{ marginTop:6,padding:'6px 10px',background:'rgba(56,189,248,0.06)',borderRadius:8,border:'1px solid rgba(56,189,248,0.15)',flexShrink:0 }}>
                <p style={{ fontSize:11,color:'#38bdf8',lineHeight:1.6,margin:0 }}>
                  💡 <strong>Tip:</strong> Start with a short intro, key points, then a real example. Aim for 50+ words.
                </p>
              </div>
            )}
          </div>

          {/* Speech Recognition — row 2, spans BOTH cols (full width of left area) */}
          <div className="ir-card" style={{ gridColumn:'1 / -1',overflow:'hidden',minHeight:150 }}>
            <div style={{ padding:'7px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <Mic style={{ width:11,height:11,color:'#94a3b8' }} />
                <span className="section-label" style={{ fontSize:'9px' }}>Speech Recognition</span>
              </div>
              {isListening ? (
                <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:2,height:14 }}>
                    {[0.3,0.6,1,0.7,0.4,0.8,0.5].map((delay,i) => (
                      <div key={i} className="wave-bar" style={{ height:12,animationDelay:`${delay*0.3}s` }} />
                    ))}
                  </div>
                  <span style={{ fontSize:10,fontWeight:600,color:'#6366f1' }}>Listening</span>
                </div>
              ) : (
                <span style={{ fontSize:10,color:'#b0bac9' }}>Inactive</span>
              )}
            </div>
            <div style={{ maxHeight:115,overflow:'hidden', margin:'10px' }}>
              <SpeechRecognition
                isListening={isListening}
                onStartListening={() => setIsListening(true)}
                onStopListening={() => setIsListening(false)}
                onTranscript={handleTranscript}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* ══ COL C: Mic + Controls + Stats ══════════════════════════════ */}
        <div style={{ display:'flex',flexDirection:'column',gap:10,minHeight:0,overflow:'hidden' }}>

          {/* Mic status */}
          <div className="ir-card" style={{ padding:'11px 14px',flexShrink:0 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{
                width:32,height:32,borderRadius:9,flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center',
                background: isListening ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${isListening ? '#bbf7d0' : '#e2e8f0'}`,
                transition:'all 0.3s', position:'relative',
              }}>
                {isListening
                  ? <Mic style={{ width:14,height:14,color:'#10b981' }} />
                  : <MicOff style={{ width:14,height:14,color:'#94a3b8' }} />}
                {isListening && (
                  <span style={{ position:'absolute',inset:-4,borderRadius:13,border:'1.5px solid #bbf7d0',animation:'pulse-glow 1.8s ease infinite' }} />
                )}
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:600,color: isListening ? '#059669' : '#64748b',transition:'color 0.3s' }}>
                  {isListening ? 'Mic active' : 'Mic off'}
                </p>
                <p style={{ fontSize:10,color:'#94a3b8' }}>
                  {isListening ? 'Speak clearly' : 'Start to activate'}
                </p>
              </div>
            </div>
          </div>

          {/* Session Controls */}
          <div className="ir-card" style={{ padding:14,flexShrink:0 }}>
            <p className="section-label" style={{ marginBottom:11 }}>Session Controls</p>

            {sessionState === 'setup' && (
              <button className="ir-btn btn-primary" style={{ width:'100%',padding:'13px',fontSize:13 }} onClick={handleStartInterview}>
                <Play style={{ width:14,height:14 }} />Begin Interview
              </button>
            )}

            {sessionState === 'active' && (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                <button
                  className="ir-btn btn-primary"
                  style={{ width:'100%',padding:'12px',fontSize:12 }}
                  onClick={handleNextQuestion}
                  disabled={!currentAnswer.trim() || !currentQuestion}
                >
                  <SkipForward style={{ width:13,height:13 }} />
                  {wordCount > 0 ? 'Submit & Next' : 'Answer required'}
                </button>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7 }}>
                  <button className="ir-btn btn-pause" style={{ padding:'10px',fontSize:12 }} onClick={() => setSessionState('paused')}>
                    <Pause style={{ width:13,height:13 }} />Pause
                  </button>
                  <button className="ir-btn btn-danger" style={{ padding:'10px',fontSize:12 }} onClick={() => setShowEndConfirm(true)}>
                    <Square style={{ width:13,height:13 }} />End
                  </button>
                </div>
              </div>
            )}

            {sessionState === 'paused' && (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                <div style={{ padding:'10px 12px',background:'#fffbeb',borderRadius:9,border:'1px solid #fde68a',display:'flex',alignItems:'center',gap:9 }}>
                  <Pause style={{ width:12,height:12,color:'#d97706',flexShrink:0 }} />
                  <p style={{ fontWeight:600,color:'#92400e',fontSize:11,margin:0 }}>Paused — resume when ready</p>
                </div>
                <button className="ir-btn btn-primary" style={{ width:'100%',padding:'11px',fontSize:12 }} onClick={() => setSessionState('active')}>
                  <Play style={{ width:13,height:13 }} />Resume
                </button>
                <button className="ir-btn btn-danger" style={{ width:'100%',padding:'10px',fontSize:12 }} onClick={() => setShowEndConfirm(true)}>
                  <Square style={{ width:13,height:13 }} />End Interview
                </button>
              </div>
            )}

            {sessionState === 'active' && !currentQuestion && (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                <div style={{ padding:'10px 12px',background:'#f0fdf4',borderRadius:9,border:'1px solid #bbf7d0',display:'flex',alignItems:'center',gap:9 }}>
                  <CheckCircle2 style={{ width:13,height:13,color:'#10b981',flexShrink:0 }} />
                  <p style={{ fontWeight:600,color:'#065f46',fontSize:11,margin:0 }}>All questions completed!</p>
                </div>
                <button className="ir-btn btn-success" style={{ width:'100%',padding:'11px',fontSize:12 }} onClick={() => setShowEndConfirm(true)}>
                  <CheckCircle2 style={{ width:13,height:13 }} />Finish & View Report
                </button>
              </div>
            )}
          </div>

          {/* Session stats */}
          <div className="ir-card" style={{ padding:14,flexShrink:0 }}>
            <p className="section-label" style={{ marginBottom:10 }}>Session Stats</p>
            {latestRecordingBlob && (
              <p style={{ margin:'0 0 8px', fontSize:10, color:'#10b981' }}>
                Recording captured ({Math.round(latestRecordingBlob.size / 1024)} KB)
              </p>
            )}
            <p style={{ margin:'0 0 8px', fontSize:10, color:'#6366f1' }}>
              Live emotion: {liveEmotionSummary}
            </p>
            <p style={{ margin:'0 0 8px', fontSize:10, color:'#0ea5e9' }}>
              Filler words: {liveFillerPct === null ? '—' : `${Math.round(liveFillerPct)}%`}
            </p>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7 }}>
              {[
                { label:'Time',      value: fmt(timeElapsed), mono:true },
                { label:'Questions', value:`${qIndex}/${totalQ}` },
                { label:'Words',     value: wordCount },
                { label:'Status',    value: sessionState.charAt(0).toUpperCase()+sessionState.slice(1) },
              ].map(s => (
                <div key={s.label} className="ir-card-inset" style={{ padding:'9px 11px' }}>
                  <p style={{ margin:'0 0 2px',fontSize:10,color:'#94a3b8' }}>{s.label}</p>
                  <p className={s.mono ? 'mono' : ''} style={{ margin:0,fontWeight:700,fontSize:14,color:'#1e293b' }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* ══ END CONFIRM MODAL ══════════════════════════════════════════════ */}
      {showEndConfirm && (
        <div className="ir-overlay">
          <div className="ir-card" style={{ maxWidth:420,width:'100%',padding:28,animation:'fadeUp 0.25s ease' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
              <div style={{ width:44,height:44,borderRadius:12,background:'#fff1f1',border:'1px solid #fecaca',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <Square style={{ width:18,height:18,color:'#ef4444' }} />
              </div>
              <button onClick={() => setShowEndConfirm(false)} style={{ all:'unset',cursor:'pointer',color:'#94a3b8',padding:4 }}>
                <X style={{ width:16,height:16 }} />
              </button>
            </div>

            <h3 style={{ fontSize:18,fontWeight:700,marginBottom:8,color:'#1e293b' }}>End your interview?</h3>
            <p style={{ fontSize:13,color:'#64748b',lineHeight:1.7,marginBottom:20 }}>
              You've completed <strong style={{ color:'#374151' }}>${qIndex} of {totalQ}</strong> questions.
              Your answers will be saved and an AI feedback report will be generated.
            </p>

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20 }}>
              {[
                { label:'Questions', value:`${qIndex}/${totalQ}` },
                { label:'Time',      value: fmt(timeElapsed) },
                { label:'Last ans',  value:`${wordCount}w` },
              ].map(s => (
                <div key={s.label} className="ir-card-inset" style={{ textAlign:'center',padding:'10px 8px' }}>
                  <p style={{ fontWeight:700,fontSize:15,color:'#1e293b',marginBottom:2 }}>{s.value}</p>
                  <p style={{ fontSize:10,color:'#94a3b8',margin:0,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600 }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display:'flex',gap:10 }}>
              <button className="ir-btn btn-ghost" style={{ flex:1 }} onClick={() => setShowEndConfirm(false)}>
                <ChevronLeft style={{ width:13,height:13 }} />Keep going
              </button>
              <button className="ir-btn btn-success" style={{ flex:1 }} onClick={handleEndInterview}>
                <CheckCircle2 style={{ width:14,height:14 }} />Finish & View Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}