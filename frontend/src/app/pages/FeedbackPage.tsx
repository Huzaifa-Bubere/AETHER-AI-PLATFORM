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
import toast from 'react-hot-toast';

export function FeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);

  useEffect(() => {
    if (id) {
      fetchAssessment(id);
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold">Synthesizing Explainable AI Report...</h2>
        <p className="text-slate-400 text-sm mt-1">Analyzing candidate answers and evidence references</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-2xl font-bold text-white mb-2">Report Unavailable</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error || 'Could not locate interview assessment data.'}</p>
        <Button onClick={() => navigate('/dashboard')} className="bg-indigo-600 hover:bg-indigo-500">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const assessment = data.finalAssessment || {};
  const interview = data.interview || {};
  const interactions = data.interactions || [];
  const difficultyProgression = data.difficultyProgression || [];

  const radarData = [
    { subject: 'Technical Depth', score: assessment.technicalScore ?? 75, fullMark: 100 },
    { subject: 'Communication', score: assessment.communicationScore ?? 70, fullMark: 100 },
    { subject: 'Problem Solving', score: assessment.problemSolvingScore ?? 80, fullMark: 100 },
    { subject: 'Role Readiness', score: assessment.roleReadinessScore ?? 75, fullMark: 100 },
  ];

  const topicChartData = (assessment.topicScores || []).map((t: any) => ({
    topic: t.topic?.length > 18 ? t.topic.slice(0, 16) + '…' : t.topic,
    score: t.score,
  }));

  const progressionChartData = difficultyProgression.map((p: any, idx: number) => ({
    step: `Q${idx + 1}`,
    score: p.score,
    difficulty: p.difficulty,
  }));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBadgeBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explainable AI Assessment & Career Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Mock Interview Performance Report
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Role: <strong className="text-slate-200">{interview.role}</strong> · Type: <strong className="text-slate-200 capitalize">{interview.type}</strong> · Duration: {interview.durationMinutes || 15}m
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/interview-setup')}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Practice Again
            </Button>
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
            >
              <Home className="w-3.5 h-3.5 mr-1.5" /> Dashboard
            </Button>
          </div>
        </div>

        {/* ── Key Scores Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="p-5 bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500/30 text-center rounded-2xl col-span-2 lg:col-span-1 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">Overall Score</div>
            <div className={`text-5xl font-black ${getScoreColor(assessment.overallScore || 0)}`}>
              {assessment.overallScore || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">Out of 100 points</div>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">Technical Depth</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.technicalScore || 0)}`}>
              {assessment.technicalScore || 0}%
            </div>
            <span className="text-[11px] text-slate-500">Core engineering accuracy</span>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">Communication</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.communicationScore || 0)}`}>
              {assessment.communicationScore || 0}%
            </div>
            <span className="text-[11px] text-slate-500">Clarity & articulation</span>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">Problem Solving</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.problemSolvingScore || 0)}`}>
              {assessment.problemSolvingScore || 0}%
            </div>
            <span className="text-[11px] text-slate-500">Trade-offs & structure</span>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">Role Readiness</span>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.roleReadinessScore || 0)}`}>
              {assessment.roleReadinessScore || 0}%
            </div>
            <span className="text-[11px] text-slate-500">Placement alignment</span>
          </Card>
        </div>

        {/* ── Visual Analytics Section: Radar & Topic Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Radar Chart: Core Competencies */}
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                Competency Radar Profile
              </h3>
              <span className="text-xs text-slate-400">Benchmark: 100</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Candidate" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bar Chart: Topic Scores */}
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Topic Performance Breakdown
              </h3>
              <span className="text-xs text-slate-400">Score per Domain</span>
            </div>

            <div className="h-64 w-full">
              {topicChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="topic" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="score" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Topic breakdown generated upon multiple topic coverage
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Difficulty Progression Timeline ── */}
        {progressionChartData.length > 1 && (
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl shadow-xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Adaptive Difficulty & Score Progression
            </h3>
            <p className="text-xs text-slate-400">
              Shows how the Adaptive Engine adjusted question complexity in response to your answer accuracy.
            </p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="step" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* ── Explainable AI Justification ── */}
        {assessment.explainableEvidence && assessment.explainableEvidence.length > 0 && (
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Explainable AI Evidence Justifications</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {assessment.explainableEvidence.map((ev: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      {ev.dimension}
                    </span>
                    <span className="text-xs font-extrabold text-white px-2 py-0.5 rounded bg-slate-800">
                      {ev.score}/100
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {(ev.justification || []).map((j: string, jIdx: number) => (
                      <li key={jIdx} className="flex items-start gap-1.5">
                        <span className="text-indigo-500 font-bold">•</span>
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
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Observed Strengths
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              {(assessment.strengths || ['Strong technical vocabulary', 'Well-structured thoughts']).map((s: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Areas for Improvement & Gaps */}
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Areas to Improve & Skill Gaps
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              {(assessment.weaknesses || ['Provide deeper trade-off discussions']).map((w: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Recommended Practice */}
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Personalized Practice Roadmap
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              {(assessment.recommendedPractice || ['Focus on system architecture concepts']).map((p: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Career Recommendations */}
          <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Placement & Career Recommendations
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              {(assessment.careerRecommendations || ['Target software engineer openings']).map((c: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-2 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* ── Executive Summary ── */}
        {assessment.summary && (
          <Card className="p-6 bg-slate-900/70 border-slate-800 rounded-2xl space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Evaluator Executive Summary
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {assessment.summary}
            </p>
          </Card>
        )}

        {/* ── Collapsible Question-by-Question Deep Dive ── */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
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
                  className="bg-slate-900/80 border-slate-800 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                    className="w-full p-4 text-left flex items-start justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-indigo-400">
                          Q{idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.stage}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.topic}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-100">
                        {item.question}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${getScoreBadgeBg(score)}`}>
                        {score}/100
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-5 border-t border-slate-800/80 bg-slate-950/40 space-y-4 text-xs sm:text-sm">
                      {/* Candidate Answer */}
                      <div>
                        <div className="font-semibold text-slate-400 mb-1">Your Response:</div>
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 leading-relaxed font-sans">
                          {item.answer || '(No answer was provided for this question)'}
                        </div>
                      </div>

                      {/* Concepts Breakdown */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                          <span className="font-bold text-emerald-400 text-xs block mb-1">Concepts Covered:</span>
                          <span className="text-slate-300 text-xs">
                            {evalData.conceptsCovered?.length > 0
                              ? evalData.conceptsCovered.join(', ')
                              : 'None specifically identified'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20">
                          <span className="font-bold text-rose-400 text-xs block mb-1">Concepts Missed / Under-explained:</span>
                          <span className="text-slate-300 text-xs">
                            {evalData.conceptsMissing?.length > 0
                              ? evalData.conceptsMissing.join(', ')
                              : 'None missed'}
                          </span>
                        </div>
                      </div>

                      {/* AI Evaluation */}
                      {evalData.feedbackSummary && (
                        <div>
                          <div className="font-semibold text-indigo-400 mb-1">AI Evaluator Feedback:</div>
                          <p className="text-slate-300 leading-relaxed bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/20">
                            {evalData.feedbackSummary}
                          </p>
                        </div>
                      )}

                      {/* Suggested Better Answer */}
                      {evalData.suggestedAnswerImprovement && (
                        <div>
                          <div className="font-semibold text-emerald-400 mb-1">Suggested Model Answer:</div>
                          <p className="text-slate-300 leading-relaxed bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono text-xs">
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
