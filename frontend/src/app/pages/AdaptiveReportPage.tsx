import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Brain, Trophy, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert,
  BookOpen, Target, ArrowRight, Loader2, AlertTriangle, RefreshCw, Clock, MessageSquare, Video,
} from 'lucide-react';
import adaptiveInterviewApi, { AdaptiveReport, RecordingInfo, TranscriptItem } from '../../lib/adaptiveInterviewApi';

const READINESS_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  'placement-ready': { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'Placement Ready 🎯' },
  strong: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', label: 'Strong' },
  competent: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', label: 'Competent' },
  developing: { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)', label: 'Developing' },
  'needs-work': { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', label: 'Needs Work' },
};

const VERDICT_COLOR: Record<string, string> = {
  excellent: '#10b981', good: '#34d399', average: '#fbbf24', 'below-average': '#fb923c', poor: '#f87171',
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#34d399' : score >= 55 ? '#fbbf24' : score >= 35 ? '#fb923c' : '#f87171';
  const angle = Math.round((score / 100) * 360);
  return (
    <div style={{
      width: 130, height: 130, borderRadius: '50%', position: 'relative', flexShrink: 0,
      background: `conic-gradient(${color} ${angle}deg, rgba(255,255,255,0.06) ${angle}deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#0b1020', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 30, fontWeight: 800, color }}>{score}</span>
        <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, letterSpacing: '0.06em' }}>/ 100</span>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon style={{ width: 15, height: 15, color }} />
        <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, color, marker }: { items: string[]; color: string; marker: 'up' | 'down' | 'arrow' | 'book' }) {
  const icons = { up: TrendingUp, down: TrendingDown, arrow: ArrowRight, book: BookOpen };
  const M = icons[marker];
  if (!items.length) return <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>—</p>;
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <M style={{ width: 13, height: 13, color, flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

export function AdaptiveReportPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ domain: string; difficulty: string; durationSeconds: number; report: AdaptiveReport; transcript: TranscriptItem[]; recording: RecordingInfo } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (!sessionId) { navigate('/ai-interview', { replace: true }); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await adaptiveInterviewApi.getReport(sessionId);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) {
          const status = e?.response?.status;
          setError(status === 409 ? 'Your report is still being generated. Try again in a moment.' : (e?.response?.data?.error || 'Failed to load report'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sessionId, navigate]);

  // Load the webcam recording for playback (owner-only via auth header).
  useEffect(() => {
    if (!sessionId || !data?.recording?.available || !data.recording.playbackUrl) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    adaptiveInterviewApi.fetchRecordingBlob(sessionId)
      .then(blob => {
        if (cancelled) { URL.revokeObjectURL(URL.createObjectURL(blob)); return; }
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setVideoError(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionId, data?.recording?.available, data?.recording?.playbackUrl]);

  const retry = () => { setLoading(true); setError(null); window.location.reload(); };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1020', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#94a3b8' }}>
        <Loader2 style={{ width: 28, height: 28, color: '#818cf8', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13 }}>Loading your performance report…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1020', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#94a3b8', padding: 16 }}>
        <AlertTriangle style={{ width: 30, height: 30, color: '#f59e0b' }} />
        <p style={{ fontSize: 14, textAlign: 'center' }}>{error || 'Report not found'}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={retry} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13 }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Retry
          </button>
          <button onClick={() => navigate('/ai-interview')} style={{ all: 'unset', cursor: 'pointer', padding: '9px 16px', borderRadius: 10, background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            New interview
          </button>
        </div>
      </div>
    );
  }

  const { report, transcript, domain, durationSeconds } = data;
  const rs = READINESS_STYLES[report.domainReadiness] || READINESS_STYLES.competent;
  const integrity = report.integrity;
  const integrityGood = integrity.score >= 85;
  const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;
  const fmtSize = (b?: number) => (!b ? '' : b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

  return (
    <div style={{ minHeight: '100vh', background: '#0b1020', color: '#e2e8f0', fontFamily: "'Sora', system-ui, sans-serif", padding: '32px 16px 60px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>

        {/* ── Header card ── */}
        <div style={{ padding: 28, borderRadius: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.05))', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreRing score={report.overallScore} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Brain style={{ width: 15, height: 15, color: '#a5b4fc' }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a5b4fc' }}>AI Interview Report · {domain}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 99, background: rs.bg, border: `1px solid ${rs.border}`, marginBottom: 14 }}>
              <Trophy style={{ width: 13, height: 13, color: rs.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: rs.color }}>{rs.label}</span>
            </div>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{report.summary}</p>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}><MessageSquare style={{ width: 12, height: 12 }} /> {transcript.length} questions answered</span>
              <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}><Clock style={{ width: 12, height: 12 }} /> {fmtDur(durationSeconds)}</span>
              <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                {integrityGood ? <ShieldCheck style={{ width: 12, height: 12, color: '#34d399' }} /> : <ShieldAlert style={{ width: 12, height: 12, color: '#fbbf24' }} />}
                Integrity: {integrity.score}/100
              </span>
            </div>
          </div>
        </div>

        {/* ── Topic performance ── */}
        <Section icon={Target} title="Topic-by-topic performance" color="#818cf8">
          <div style={{ display: 'grid', gap: 10 }}>
            {report.topicPerformance.map(t => {
              const c = VERDICT_COLOR[t.verdict] || '#94a3b8';
              return (
                <div key={t.topic} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#e2e8f0' }}>{t.topic}</span>
                    <span style={{ fontSize: 12, color: c, fontWeight: 700 }}>{t.avgScore}/100 · {t.verdict} · {t.questionsAsked} Q</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${t.avgScore}%`, background: c, borderRadius: 99, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              );
            })}
            {!report.topicPerformance.length && <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>No questions were answered.</p>}
          </div>
        </Section>

        {/* ── Webcam recording ── */}
        {data.recording?.available && (
          <Section icon={Video} title="Webcam recording" color="#a78bfa">
            {videoError ? (
              <p style={{ fontSize: 12.5, color: '#fbbf24', margin: 0 }}>Recording could not be loaded. It may have been archived or failed to upload.</p>
            ) : videoUrl ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <video src={videoUrl} controls playsInline style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }} />
                <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>
                  {fmtSize(data.recording.sizeBytes)}{data.recording.durationSeconds ? ` · ${fmtDur(data.recording.durationSeconds)}` : ''} · stored as {data.recording.storageType} · visible only to you
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Loader2 style={{ width: 15, height: 15, color: '#a78bfa', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12.5, color: '#94a3b8' }}>Loading recording…</span>
              </div>
              )}
          </Section>
        )}

        {/* ── Strengths / weaknesses ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <Section icon={TrendingUp} title="Strengths" color="#34d399">
            <BulletList items={report.strengths} color="#34d399" marker="up" />
          </Section>
          <Section icon={TrendingDown} title="Weaknesses" color="#fb923c">
            <BulletList items={report.weaknesses} color="#fb923c" marker="down" />
          </Section>
        </div>

        {/* ── Recommendations + learning path ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <Section icon={ArrowRight} title="What to do next" color="#a5b4fc">
            <BulletList items={report.recommendations} color="#a5b4fc" marker="arrow" />
          </Section>
          <Section icon={BookOpen} title="Suggested learning path" color="#fbbf24">
            <BulletList items={report.suggestedLearningPath} color="#fbbf24" marker="book" />
          </Section>
        </div>

        {/* ── Integrity ── */}
        <Section icon={integrityGood ? ShieldCheck : ShieldAlert} title={`Integrity report — ${integrity.score}/100`} color={integrityGood ? '#34d399' : '#fbbf24'}>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px', lineHeight: 1.6 }}>{integrity.note}</p>
          {Object.keys(integrity.eventCounts).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(integrity.eventCounts).map(([type, count]) => (
                <span key={type} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 99, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fcd34d', fontWeight: 600 }}>
                  {type.replace(/-/g, ' ')} × {count}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: '#34d399', margin: 0 }}>No suspicious activity was recorded. Clean interview. ✅</p>
          )}
        </Section>

        {/* ── Transcript ── */}
        <Section icon={MessageSquare} title="Full transcript" color="#94a3b8">
          <div style={{ display: 'grid', gap: 14 }}>
            {transcript.map((t, i) => (
              <div key={t.questionId} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#e2e8f0' }}>Q{i + 1}. {t.questionText}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: VERDICT_COLOR[t.verdict] || '#94a3b8', flexShrink: 0 }}>{t.overallScore}/100</span>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{t.answer || '(no answer)'}</p>
                {t.aiSummary && <p style={{ fontSize: 12, color: '#818cf8', margin: 0, lineHeight: 1.6 }}>🤖 {t.aiSummary}</p>}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#475569' }}>{t.topic} · {t.durationSeconds}s</span>
                </div>
              </div>
            ))}
            {!transcript.length && <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>No answers were recorded in this session.</p>}
          </div>
        </Section>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 20 }}>
          <button onClick={() => navigate('/ai-interview')} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', fontSize: 14, fontWeight: 700 }}>
            <Brain style={{ width: 15, height: 15 }} /> Practice Again
          </button>
          <button onClick={() => navigate('/dashboard')} style={{ all: 'unset', cursor: 'pointer', padding: '13px 26px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdaptiveReportPage;
