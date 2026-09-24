import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Brain, Trophy, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert,
  BookOpen, Target, ArrowRight, Loader2, AlertTriangle, RefreshCw, Clock, MessageSquare, Video,
} from 'lucide-react';
import adaptiveInterviewApi, {
  AdaptiveReport, RecordingInfo, TranscriptItem,
  EnglishAnalysis, SpeakingMetrics, FollowUpTrailItem, LearningRecommendation, StarResult,
} from '../../lib/adaptiveInterviewApi';
import { integrityApi, IntegritySummary, sanitizeIntegritySummary } from '../features/integrity/integrity.types';

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
      background: `conic-gradient(${color} ${angle}deg, #E2E8F0 ${angle}deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 30, fontWeight: 800, color }}>{score}</span>
        <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>/ 100</span>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-border p-5">
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
  const [data, setData] = useState<{
    domain: string; difficulty: string; durationSeconds: number; report: AdaptiveReport;
    transcript: TranscriptItem[]; recording: RecordingInfo;
    speakingMetrics?: SpeakingMetrics | null;
    englishAnalysis?: EnglishAnalysis | null;
    followUpTrail?: FollowUpTrailItem[];
    learningRecommendations?: LearningRecommendation[];
    starByQuestion?: Array<{ questionId: string; star: StarResult | null }>;
  } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  // Shared integrity event log (backend-authoritative) enriches the report's own summary.
  // NOTE: declared before any early return — conditional hooks crash the page after data loads.
  const [integritySummary, setIntegritySummary] = useState<IntegritySummary | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    integrityApi.getSummary('INTERVIEW', sessionId)
      .then(raw => setIntegritySummary(sanitizeIntegritySummary(raw)))
      .catch(() => {});
  }, [sessionId]);

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

  const { report: rawReport, transcript: rawTranscript, domain, durationSeconds } = data;
  // Defensive: reports generated by older server versions may miss fields.
  const report = {
    ...rawReport,
    topicPerformance: Array.isArray(rawReport?.topicPerformance) ? rawReport.topicPerformance : [],
    strengths: Array.isArray(rawReport?.strengths) ? rawReport.strengths : [],
    weaknesses: Array.isArray(rawReport?.weaknesses) ? rawReport.weaknesses : [],
    recommendations: Array.isArray(rawReport?.recommendations) ? rawReport.recommendations : [],
    suggestedLearningPath: Array.isArray(rawReport?.suggestedLearningPath) ? rawReport.suggestedLearningPath : [],
    integrity: rawReport?.integrity ?? { score: 100, eventCounts: {}, note: 'Integrity data not available for this session.' },
  };
  const transcript = Array.isArray(rawTranscript) ? rawTranscript : [];
  const rs = READINESS_STYLES[report.domainReadiness] || READINESS_STYLES.competent;
  const integrity = report.integrity;
  const integrityGood = (integrity?.score ?? 100) >= 85;
  const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;
  const fmtSize = (b?: number) => (!b ? '' : b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

  const integrityTerminated = !!integritySummary?.autoSubmitted || new URLSearchParams(window.location.search).get('integrity') === 'terminated';
  const integrityEventCounts = integrity?.eventCounts ?? {};

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-14 px-4 text-slate-900">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>

        {/* ── Integrity termination banner ── */}
        {integrityTerminated && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3" role="alert">
            <ShieldAlert style={{ width: 18, height: 18, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-bold text-red-700">Assessment automatically submitted</p>
              <p className="text-xs text-red-600 mt-0.5">This interview was automatically ended after the maximum number of assessment integrity warnings was reached. Your completed answers were evaluated and scored.</p>
            </div>
          </div>
        )}

        {/* ── Header card ── */}
        <div className="rounded-2xl bg-white border border-border p-7 flex flex-wrap items-center gap-6">
          <ScoreRing score={report.overallScore} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Brain style={{ width: 15, height: 15, color: '#2563EB' }} />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">AI Interview Report · {domain}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 99, background: rs.bg, border: `1px solid ${rs.border}`, marginBottom: 14 }}>
              <Trophy style={{ width: 13, height: 13, color: rs.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: rs.color }}>{rs.label}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
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

        {/* ── Speaking delivery (objective metrics only — spec §29–31) ── */}
        {data.speakingMetrics && data.speakingMetrics.responseCount > 0 && (
          <Section icon={MessageSquare} title="Speaking delivery" color="#38bdf8">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                ['Speaking rate', data.speakingMetrics.wordsPerMinute != null ? `${data.speakingMetrics.wordsPerMinute} WPM` : '—'],
                ['Filler words', `${data.speakingMetrics.fillerCount} (${data.speakingMetrics.fillerRatePerMinute ?? '—'}/min)`],
                ['Avg response', data.speakingMetrics.averageResponseSeconds != null ? `${data.speakingMetrics.averageResponseSeconds}s` : '—'],
                ['Words spoken', String(data.speakingMetrics.totalWords)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="text-lg font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-slate-400 mt-3">
              Measured from your transcript and response durations. These are objective delivery metrics — they do not measure
              personality, confidence as a trait, or suitability for a role. Accent is never scored.
            </p>
          </Section>
        )}

        {/* ── English communication (transcript evidence — spec §32–33) ── */}
        {data.englishAnalysis && (
          <Section icon={BookOpen} title="English communication" color="#f59e0b">
            <div style={{ display: 'grid', gap: 10 }}>
              {([['Grammar', data.englishAnalysis.grammar], ['Clarity', data.englishAnalysis.clarity], ['Vocabulary', data.englishAnalysis.vocabulary], ['Coherence', data.englishAnalysis.coherence]] as const).map(([label, score]) => {
                const c = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={label} style={{ display: 'grid', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{score}/100</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${score}%`, background: c, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {data.englishAnalysis.evidence.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-slate-500 mb-1">Evidence from your transcript</p>
                <BulletList items={data.englishAnalysis.evidence} color="#f59e0b" marker="arrow" />
              </div>
            )}
            {data.englishAnalysis.improvements.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-slate-500 mb-1">To improve</p>
                <BulletList items={data.englishAnalysis.improvements} color="#fb923c" marker="book" />
              </div>
            )}
            <p className="text-[11.5px] text-slate-400 mt-3">Based on comprehensibility and language usage — never accent similarity.</p>
          </Section>
        )}

        {/* ── Cross-question trail (spec §42) ── */}
        {data.followUpTrail && data.followUpTrail.some(f => f.parentQuestionId) && (
          <Section icon={Target} title="Cross-questioning trail" color="#818cf8">
            <div style={{ display: 'grid', gap: 8 }}>
              {data.followUpTrail.filter(f => f.parentQuestionId).map(f => (
                <div key={f.questionId} className="rounded-xl border border-border bg-slate-50 p-3.5">
                  <p className="text-xs font-bold text-indigo-600">Follow-up · {f.depth}{f.reason ? ` · ${f.reason}` : ''}</p>
                  <p className="text-[13px] text-slate-700 mt-1">{f.questionText}</p>
                  {f.triggerText && <p className="text-[11.5px] text-slate-400 mt-1">Triggered by: “{f.triggerText}”</p>}
                </div>
              ))}
            </div>
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

        {/* ── Personalized learning recommendations → Career Learning (spec §43) ── */}
        {data.learningRecommendations && data.learningRecommendations.length > 0 && (
          <Section icon={BookOpen} title="Recommended learning — close your gaps" color="#2563EB">
            <div style={{ display: 'grid', gap: 8 }}>
              {data.learningRecommendations.map((rec, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-50 p-3.5">
                  <div>
                    <p className="text-[13.5px] font-bold text-slate-800">{rec.skill}</p>
                    <p className="text-xs text-slate-500">{rec.reason}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/career-learning${rec.learningPath ? `?topic=${encodeURIComponent(rec.learningPath)}` : ''}`)}
                    style={{ all: 'unset', cursor: 'pointer', flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: '#2563EB', color: '#fff', fontSize: 12, fontWeight: 700 }}
                  >
                    Start Learning
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Integrity ── */}
        <Section icon={integrityTerminated ? ShieldAlert : integrityGood ? ShieldCheck : ShieldAlert} title={`Assessment integrity — ${integrity.score}/100`} color={integrityTerminated ? '#DC2626' : integrityGood ? '#16A34A' : '#D97706'}>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">{integrity.note}</p>
          {integrityTerminated && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-3">
              <p className="text-sm font-bold text-red-700">Status: Automatically submitted</p>
              <p className="text-xs text-red-600">Reason: integrity warning limit reached · Warnings: {integritySummary?.warningCount ?? 5} / {integritySummary?.maximumWarnings ?? 5}</p>
            </div>
          )}
          {integritySummary && integritySummary.events.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              {integritySummary.events.map((e, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-xs ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                  <span className="tabular-nums text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className="font-semibold text-slate-700">{e.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span className="ml-auto text-slate-400">Warning {e.warningNumber}</span>
                </div>
              ))}
            </div>
          ) : integritySummary ? (
            <p className="text-sm text-emerald-600">No integrity events were recorded. Clean interview.</p>
          ) : (
            Object.keys(integrityEventCounts).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(integrityEventCounts).map(([type, count]) => (
                  <span key={type} className="text-[11.5px] px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
                    {type.replace(/-/g, ' ')} × {count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-600">No suspicious activity was recorded. Clean interview.</p>
            )
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
