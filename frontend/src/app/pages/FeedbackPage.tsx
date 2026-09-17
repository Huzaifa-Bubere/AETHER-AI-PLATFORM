import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Award,
  TrendingUp,
  Brain,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Home,
  FileText,
  Briefcase,
  Layers,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Share2,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { interviewService } from '../services/interview';
import { integrityApi, IntegritySummary, sanitizeIntegritySummary } from '../features/integrity/integrity.types';
import toast from 'react-hot-toast';

export function FeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);
  const [integritySummary, setIntegritySummary] = useState<IntegritySummary | null>(null);

  useEffect(() => {
    if (id) {
      fetchAssessment(id);
      // Integrity summary is optional context; absence never blocks the report.
      integrityApi.getSummary('INTERVIEW', id).then(raw => setIntegritySummary(sanitizeIntegritySummary(raw))).catch(() => {});
    }
  }, [id]);

  const fetchAssessment = async (interviewId: string) => {
    try {
      setLoading(true);
      const res = await interviewService.getInterviewResult(interviewId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load assessment report.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assessment report.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold">Synthesizing Explainable AI Report...</h2>
        <p className="text-muted-foreground text-sm mt-1">Analyzing candidate answers and evidence references</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Report Unavailable</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-6">{error || 'Could not locate interview data.'}</p>
        <Button onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const assessment = data.finalAssessment || {};
  const interview = data.interview || {};
  const interactions = Array.isArray(data.interactions) ? data.interactions : [];
  const difficultyProgression = Array.isArray(data.difficultyProgression) ? data.difficultyProgression : [];

  const radarData = [
    { subject: 'Technical Depth', score: assessment.technicalScore ?? 75, fullMark: 100 },
    { subject: 'Communication', score: assessment.communicationScore ?? 70, fullMark: 100 },
    { subject: 'Problem Solving', score: assessment.problemSolvingScore ?? 80, fullMark: 100 },
    { subject: 'Role Readiness', score: assessment.roleReadinessScore ?? 75, fullMark: 100 },
  ];

  const topicChartData = (Array.isArray(assessment.topicScores) ? assessment.topicScores : []).map((t: any) => ({
    topic: t.topic?.length > 18 ? t.topic.slice(0, 16) + '…' : t.topic,
    score: t.score,
  }));

  const progressionChartData = difficultyProgression.map((p: any, idx: number) => ({
    step: `Q${idx + 1}`,
    score: p.score,
    difficulty: p.difficulty,
  }));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreBadgeBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200 text-emerald-600';
    if (score >= 60) return 'bg-amber-50 border-amber-200 text-amber-600';
    return 'bg-rose-50 border-rose-200 text-rose-600';
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-accent border border-border text-primary mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explainable AI Assessment & Career Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Mock Interview Performance Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Role: <strong className="text-foreground">{interview.role}</strong> · Type: <strong className="text-foreground capitalize">{interview.type}</strong> · Duration: {interview.durationMinutes || 15}m
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/interview-setup')}
              className="text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Practice Again
            </Button>
            <Button
              onClick={() => navigate('/dashboard')}
              className="text-xs font-bold"
            >
              <Home className="w-3.5 h-3.5 mr-1.5" /> Dashboard
            </Button>
          </div>
        </div>

        {/* ── Key Scores Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="p-5 bg-gradient-to-br from-blue-600 to-indigo-600 border-transparent text-center rounded-2xl col-span-2 lg:col-span-1 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-100 mb-1">Overall Score</div>
            <div className={`text-5xl font-black ${assessment.overallScore >= 80 ? 'text-emerald-300' : assessment.overallScore >= 60 ? 'text-amber-200' : 'text-rose-200'}`}>
              {assessment.overallScore || 0}
            </div>
            <div className="text-xs text-blue-100 mt-1.5">Out of 100 points</div>
          </Card>

          <Card className="p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Technical Depth</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.technicalScore || 0)}`}>
              {assessment.technicalScore || 0}%
            </div>
            <span className="text-[11px] text-muted-foreground">Core engineering accuracy</span>
          </Card>

          <Card className="p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Communication</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.communicationScore || 0)}`}>
              {assessment.communicationScore || 0}%
            </div>
            <span className="text-[11px] text-muted-foreground">Clarity & articulation</span>
          </Card>

          <Card className="p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Problem Solving</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.problemSolvingScore || 0)}`}>
              {assessment.problemSolvingScore || 0}%
            </div>
            <span className="text-[11px] text-muted-foreground">Trade-offs & structure</span>
          </Card>

          <Card className="p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Role Readiness</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.roleReadinessScore || 0)}`}>
              {assessment.roleReadinessScore || 0}%
            </div>
            <span className="text-[11px] text-muted-foreground">Placement alignment</span>
          </Card>
        </div>

        {/* ── Visual Analytics Section: Radar & Topic Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Radar Chart: Core Competencies */}
          <Card className="p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Competency Radar Profile
              </h3>
              <span className="text-xs text-muted-foreground">Benchmark: 100</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Candidate" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bar Chart: Topic Scores */}
          <Card className="p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Topic Performance Breakdown
              </h3>
              <span className="text-xs text-muted-foreground">Score per Domain</span>
            </div>

            <div className="h-64 w-full">
              {topicChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="topic" tick={{ fill: '#475569', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="score" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Topic breakdown generated upon multiple topic coverage
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Difficulty Progression Timeline ── */}
        {progressionChartData.length > 1 && (
          <Card className="p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Adaptive Difficulty & Score Progression
            </h3>
            <p className="text-xs text-muted-foreground">
              Shows how the Adaptive Engine adjusted question complexity in response to your answer accuracy.
            </p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="step" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* ── Explainable AI Justification ── */}
        {assessment.explainableEvidence && assessment.explainableEvidence.length > 0 && (
          <Card className="p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">Explainable AI Evidence Justifications</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {assessment.explainableEvidence.map((ev: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-secondary/60 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {ev.dimension}
                    </span>
                    <span className="text-xs font-extrabold text-foreground px-2 py-0.5 rounded bg-secondary">
                      {ev.score}/100
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(ev.justification || []).map((j: string, jIdx: number) => (
                      <li key={jIdx} className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>{j}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Strengths, Weaknesses, Roadmap & Recommendations ── */}
        <div className="grid sm:grid-cols-2 gap-6">

          {/* Strengths */}
          <Card className="p-6 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Observed Strengths
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
              {(assessment.strengths || ['Strong technical vocabulary', 'Well-structured thoughts']).map((s: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Areas for Improvement & Gaps */}
          <Card className="p-6 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Areas to Improve & Skill Gaps
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
              {(assessment.weaknesses || ['Provide deeper trade-off discussions']).map((w: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Recommended Practice */}
          <Card className="p-6 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Personalized Practice Roadmap
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
              {(assessment.recommendedPractice || ['Focus on system architecture concepts']).map((p: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Career Recommendations */}
          <Card className="p-6 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Placement & Career Recommendations
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
              {(assessment.careerRecommendations || ['Target software engineer openings']).map((c: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* ── Executive Summary ── */}
        {assessment.summary && (
          <Card className="p-6 rounded-2xl space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Evaluator Executive Summary
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {assessment.summary}
            </p>
          </Card>
        )}

        {/* ── Assessment Integrity Summary ── */}
        {integritySummary && (
          <Card className="p-6 rounded-2xl shadow-sm space-y-2">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              {integritySummary.status === 'terminated'
                ? <ShieldAlert className="w-5 h-5 text-destructive" />
                : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
              Assessment Integrity
            </h3>
            <p className="text-sm text-muted-foreground">
              {integritySummary.status === 'terminated'
                ? 'This interview was automatically concluded after 5 integrity violations.'
                : integritySummary.warningCount > 0
                  ? `${integritySummary.warningCount} of ${integritySummary.maximumWarnings} integrity warnings were recorded during this interview.`
                  : 'No integrity violations were recorded — clean session.'}
            </p>
            {integritySummary.events.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-1">
                {integritySummary.events.map((e, i) => (
                  <li key={i}>
                    Warning {e.warningNumber}: {e.type.replace(/_/g, ' ').toLowerCase()} · {new Date(e.timestamp).toLocaleTimeString()}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ── Collapsible Question-by-Question Deep Dive ── */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Detailed Question-by-Question Review ({interactions.length} Interactions)
          </h3>

          <div className="space-y-3">
            {interactions.map((item: any, idx: number) => {
              const isExpanded = expandedQuestion === idx;
              const evalData = item.evaluation || {};
              const score = evalData.overallScore ?? 70;

              return (
                <Card
                  key={idx}
                  className="rounded-xl overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                    className="w-full p-4 text-left flex items-start justify-between gap-4 hover:bg-secondary/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary">
                          Q{idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {item.stage}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {item.topic}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {item.question}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${getScoreBadgeBg(score)}`}>
                        {score}/100
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-5 border-t border-border bg-secondary/30 space-y-4 text-xs sm:text-sm">
                      {/* Candidate Answer */}
                      <div>
                        <div className="font-semibold text-muted-foreground mb-1">Your Response:</div>
                        <div className="p-3.5 rounded-xl bg-white border border-border text-slate-700 leading-relaxed font-sans">
                          {item.answer || '(No answer was provided for this question)'}
                        </div>
                      </div>

                      {/* Concepts Breakdown */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="font-bold text-emerald-700 text-xs block mb-1">Concepts Covered:</span>
                          <span className="text-slate-700 text-xs">
                            {evalData.conceptsCovered?.length > 0
                              ? evalData.conceptsCovered.join(', ')
                              : 'None specifically identified'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                          <span className="font-bold text-rose-700 text-xs block mb-1">Concepts Missed / Under-explained:</span>
                          <span className="text-slate-700 text-xs">
                            {evalData.conceptsMissing?.length > 0
                              ? evalData.conceptsMissing.join(', ')
                              : 'None missed'}
                          </span>
                        </div>
                      </div>

                      {/* AI Evaluation */}
                      {evalData.feedbackSummary && (
                        <div>
                          <div className="font-semibold text-primary mb-1">AI Evaluator Feedback:</div>
                          <p className="text-slate-700 leading-relaxed bg-accent p-3 rounded-xl border border-border">
                            {evalData.feedbackSummary}
                          </p>
                        </div>
                      )}

                      {/* Suggested Better Answer */}
                      {evalData.suggestedAnswerImprovement && (
                        <div>
                          <div className="font-semibold text-emerald-600 mb-1">Suggested Model Answer:</div>
                          <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-border font-mono text-xs">
                            {evalData.suggestedAnswerImprovement}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
