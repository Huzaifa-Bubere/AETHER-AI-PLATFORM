import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Download,
  Award,
  TrendingUp,
  Eye,
  Volume2,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Home,
  Loader2,
  Brain,
  Target,
  BookOpen,
  Tag,
  AlignLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import { apiService } from "../services/api";
import toast from "react-hot-toast";

const printStyles = `
  @media print {
    .no-print { display: none !important; }
    @page { margin: 0.75cm; size: A4 portrait; }
    body { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    .print-section { page-break-inside: avoid; margin-bottom: 20px; break-inside: avoid; }
    svg { max-width: 100% !important; height: auto !important; }
    .print-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    h1, h2, h3, h4, h5, h6, p, span, div, li { color: #000 !important; opacity: 1 !important; }
    .bg-card, [class*="bg-"] { background-color: #ffffff !important; border: 1px solid #e5e7eb !important; }
    .border, [class*="border-"] { border-color: #d1d5db !important; }
    .gradient-text { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%) !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important; background-clip: text !important; }
    .min-h-screen { min-height: auto !important; }
    .max-w-7xl { max-width: 100% !important; }
    .overflow-hidden { overflow: visible !important; }
    .container { width: 100% !important; max-width: 100% !important; }
    .space-y-8 > * + * { margin-top: 1.5rem !important; }
    .p-6, .p-4 { padding: 1rem !important; }
    .text-4xl { font-size: 2rem !important; line-height: 1.2 !important; }
    .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .bg-secondary { background-color: #f3f4f6 !important; border: 1px solid #e5e7eb !important; }
  }
`;

// Helper: always show number with 2 decimal places
const f2 = (n: number) => Number(n).toFixed(2);

// Collapsible Q&A card component
function QuestionCard({
  question,
  response,
  index,
}: {
  question: any;
  response: any;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const answered =
    response?.answer && !response.answer.toLowerCase().startsWith("sorry");
  const duration = response?.duration || 0;

  return (
    <div className="border border-border rounded-xl overflow-hidden print-section">
      {/* Header - always visible */}
      <div
        className="flex items-start justify-between gap-4 p-4 cursor-pointer hover:bg-secondary/40 transition-colors no-print"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-start gap-3 flex-1">
          <div
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${answered ? "bg-indigo-500/20 text-indigo-400" : "bg-red-500/20 text-red-400"}`}
          >
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{question.text}</p>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  question.difficulty === "easy"
                    ? "bg-green-500/20 text-green-400"
                    : question.difficulty === "medium"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                }`}
              >
                {question.difficulty}
              </span>
              <span className="text-xs text-muted-foreground">
                {question.category}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration}s answered
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded ${answered ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
          >
            {answered ? "Attempted" : "Skipped"}
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Print version — always show full content */}
      <div className="hidden print:block p-4 border-t border-border">
        <p className="text-sm font-medium mb-2">{question.text}</p>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
            {question.difficulty}
          </span>
          <span className="text-xs text-muted-foreground">
            {question.category}
          </span>
          <span className="text-xs text-muted-foreground">{duration}s</span>
        </div>
        <div className="bg-secondary/60 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Your Answer
          </p>
          <p className="text-sm">{response?.answer || "No answer provided"}</p>
        </div>
      </div>

      {/* Expandable body */}
      {open && (
        <div className="border-t border-border p-4 space-y-4 no-print">
          {/* Candidate answer */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Your Answer
            </p>
            <div className="bg-secondary/60 rounded-lg p-3">
              <p className="text-sm leading-relaxed">
                {response?.answer || "No answer recorded."}
              </p>
            </div>
          </div>

          {/* Follow-up questions */}
          {question.followUpQuestions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Follow-up Questions
              </p>
              <ul className="space-y-1">
                {question.followUpQuestions.map((fq: string, i: number) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-indigo-400 shrink-0">→</span>
                    {fq}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FeedbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams();
  const interviewId = paramId || searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [interviewData, setInterviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  useEffect(() => {
    if (interviewId) fetchFeedback();
    else {
      setError("No interview ID provided");
      setLoading(false);
    }
  }, [interviewId]);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const interviewResponse = await apiService.get(
        `/interview/${interviewId}`,
      );

      if (interviewResponse.success && interviewResponse.data) {
        const iData = interviewResponse.data as any;
        setInterviewData(iData);

        // If interview is still in-progress, end it first
        if (iData.status === "in-progress") {
          await apiService.post(`/interview/${interviewId}/end`, {});
          // Re-fetch to get updated data
          const refreshed = await apiService.get(`/interview/${interviewId}`);
          if (refreshed.success && refreshed.data)
            setInterviewData(refreshed.data);
        }
      } else throw new Error("Failed to load interview data");

      const feedbackResponse = await apiService.get(
        `/interview/${interviewId}/feedback`,
      );
      if (feedbackResponse.success && feedbackResponse.data) {
        setFeedbackData(feedbackResponse.data);
      } else {
        setIsGeneratingFeedback(true);
        const generateResponse = await apiService.post(
          `/interview/${interviewId}/feedback`,
          {},
          { timeout: 90000 },
        );
        setIsGeneratingFeedback(false);
        if (generateResponse.success && generateResponse.data)
          setFeedbackData(generateResponse.data);
        else
          throw new Error(
            generateResponse.error || "Failed to generate feedback",
          );
      }
      setError(null);
    } catch (error: any) {
      setIsGeneratingFeedback(false);
      setError(error.message || "Failed to load feedback");
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isGeneratingFeedback
              ? "Generating your feedback, this may take a moment..."
              : "Loading feedback..."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !feedbackData) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Feedback</h2>
          <p className="text-muted-foreground mb-4">
            {error || "Feedback not available"}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={fetchFeedback} variant="outline">
              Retry
            </Button>
            <Button onClick={() => navigate("/dashboard")} variant="default">
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Data extraction ──────────────────────────────────────────────────────────
  const overallScore =
    feedbackData.overallRating ?? interviewData?.analysis?.overallScore ?? 0;

  const contentMetrics = interviewData?.analysis?.contentMetrics || {};
  const communicationClarity = contentMetrics.communicationClarity ?? 0;
  const relevanceScore = contentMetrics.relevanceScore ?? 0;
  const structureScore = contentMetrics.structureScore ?? 0;
  const technicalAccuracy = contentMetrics.technicalAccuracy ?? 0;
  const keywordMatches: string[] = contentMetrics.keywordMatches || [];

  const questions: any[] = interviewData?.questions || [];
  const responses: any[] = interviewData?.responses || [];
  console.log(feedbackData);

  const strengths = feedbackData.strengths || [];
  const improvements = feedbackData.improvements || [];
  const nextSteps = feedbackData.nextSteps || [];
  const skillAssessment = feedbackData.skillAssessment || [];
  const recommendations = (feedbackData.recommendations || []).map(
    (rec: any, i: number) =>
      typeof rec === "string"
        ? {
            title: rec,
            description: rec,
            priority: i === 0 ? "high" : "medium",
          }
        : rec,
  );
  const detailedFeedback: string = feedbackData.detailedFeedback || "";

  const categoryScores = [
    {
      category: "Communication",
      score: communicationClarity,
      color: "#6366f1",
    },
    { category: "Relevance", score: relevanceScore, color: "#8b5cf6" },
    { category: "Structure", score: structureScore, color: "#ec4899" },
    { category: "Technical", score: technicalAccuracy, color: "#f59e0b" },
  ];

  const radarData = [
    { subject: "Communication", value: communicationClarity },
    { subject: "Relevance", value: relevanceScore },
    { subject: "Structure", value: structureScore },
    { subject: "Technical", value: technicalAccuracy },
  ];

  const attemptedCount = responses.filter(
    (r) => r.answer && !r.answer.toLowerCase().startsWith("sorry"),
  ).length;
  const avgDuration = responses.length
    ? Math.round(
        responses.reduce((sum, r) => sum + (r.duration || 0), 0) /
          responses.length,
      )
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{printStyles}</style>
      <div className="min-h-screen py-20 px-4 print-container">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print-section">
            <div>
              <h1 className="text-4xl gradient-text mb-2">
                Interview Feedback Report
              </h1>
              <p className="text-muted-foreground">
                {interviewData?.type || "Technical"} Round &nbsp;•&nbsp;
                {interviewData?.createdAt
                  ? new Date(interviewData.createdAt).toLocaleDateString()
                  : "Recent"}{" "}
                &nbsp;•&nbsp; Role:{" "}
                {interviewData?.settings?.role || "Software Developer"}{" "}
                &nbsp;•&nbsp; Difficulty:{" "}
                {interviewData?.settings?.difficulty || "easy"} &nbsp;•&nbsp;
                Duration: {interviewData?.session?.actualDuration || 0} min
              </p>
            </div>
            <div className="flex gap-3 no-print">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                <Home className="mr-2 w-4 h-4" />
                Dashboard
              </Button>
              <Button
                variant="default"
                onClick={() => window.print()}
                className="shadow-lg shadow-primary/50"
              >
                <Download className="mr-2 w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* ── Overall Score ── */}
          <Card className="text-center shadow-lg shadow-primary/10 print-section p-6">
            <div className="flex flex-col md:flex-row items-center justify-around gap-8">
              <div>
                <h2 className="text-lg text-muted-foreground mb-4">
                  Overall Performance
                </h2>
                <div className="relative inline-block">
                  <svg className="w-48 h-48 transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      stroke="rgba(99,102,241,0.2)"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      stroke="url(#gradient)"
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray={`${(overallScore / 100) * 502} 502`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient
                        id="gradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      {/* Overall score with 2 decimal places */}
                      <div className="text-5xl gradient-text">
                        {f2(overallScore)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        out of 100
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1">
                <Card className="text-center p-6">
                  <Award className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl gradient-text">
                    {overallScore >= 90
                      ? "A+"
                      : overallScore >= 80
                        ? "A"
                        : overallScore >= 70
                          ? "B"
                          : overallScore >= 60
                            ? "C"
                            : "D"}
                  </p>
                  <p className="text-sm text-muted-foreground">Grade</p>
                </Card>
                <Card className="text-center p-6">
                  <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl gradient-text">
                    {feedbackData?.improvement
                      ? `${f2(feedbackData.improvement)}%`
                      : "0.00%"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    vs Last Interview
                  </p>
                </Card>
                <Card className="text-center p-6">
                  <CheckCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-2xl gradient-text">
                    {attemptedCount}/{questions.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Questions Attempted
                  </p>
                </Card>
                <Card className="text-center p-6">
                  <Clock className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                  <p className="text-2xl gradient-text">
                    {interviewData?.session?.actualDuration || 0}m
                  </p>
                  <p className="text-sm text-muted-foreground">Duration</p>
                </Card>
              </div>
            </div>
          </Card>

          {/* ── Content Metrics ── */}
          <div className="print-section">
            <h3 className="text-xl mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Content Metrics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Communication Clarity",
                  value: communicationClarity,
                  color: "text-indigo-400",
                  bg: "bg-indigo-500/10",
                },
                {
                  label: "Relevance Score",
                  value: relevanceScore,
                  color: "text-purple-400",
                  bg: "bg-purple-500/10",
                },
                {
                  label: "Structure Score",
                  value: structureScore,
                  color: "text-pink-400",
                  bg: "bg-pink-500/10",
                },
                {
                  label: "Technical Accuracy",
                  value: technicalAccuracy,
                  color: "text-amber-400",
                  bg: "bg-amber-500/10",
                },
              ].map(({ label, value, color, bg }) => (
                <Card key={label} className={`p-5 ${bg} border-0`}>
                  {/* Score with 2 decimal places */}
                  <p className={`text-3xl font-bold ${color} mb-1`}>
                    {f2(value)}
                    <span className="text-lg text-muted-foreground">/100</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* ── Charts ── */}
          <div className="grid lg:grid-cols-2 gap-8 print-section">
            <Card className="p-6">
              <h3 className="text-xl mb-6">Category Scores</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryScores}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(99,102,241,0.1)"
                  />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: "#a1aaa5", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#f0b70d",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [f2(value), "Score"]}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {categoryScores.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl mb-6">Performance Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(99,102,241,0.2)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    tickFormatter={(v) => f2(v)}
                  />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── Keyword Matches ── */}
          {keywordMatches.length > 0 && (
            <Card className="p-6 print-section">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-5 h-5 text-primary" />
                <h3 className="text-xl">Keyword Analysis</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {keywordMatches.map((kw, i) => {
                  const isMissing =
                    kw.toLowerCase().includes("none") ||
                    kw.toLowerCase().includes("no technical");
                  return (
                    <span
                      key={i}
                      className={`px-3 py-1.5 rounded-full text-sm ${isMissing ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"}`}
                    >
                      {kw}
                    </span>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ── Question-by-Question Breakdown ── */}
          <div className="print-section">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="text-xl">Question-by-Question Breakdown</h3>
              <span className="ml-auto text-sm text-muted-foreground">
                {attemptedCount}/{questions.length} answered &nbsp;• avg{" "}
                {avgDuration}s per answer
              </span>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const resp =
                  responses.find((r) => r.questionId === q.id) || responses[i];
                return (
                  <QuestionCard
                    key={q.id || i}
                    question={q}
                    response={resp}
                    index={i}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Strengths & Improvements ── */}
          <div className="grid lg:grid-cols-2 gap-8 print-section">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="text-xl">Key Strengths</h3>
              </div>
              <ul className="space-y-3">
                {strengths.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl">Areas for Improvement</h3>
              </div>
              <ul className="space-y-3">
                {improvements.map((imp: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                    </div>
                    <span className="text-muted-foreground">{imp}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* ── Detailed Feedback ── */}
          {detailedFeedback && (
            <Card className="p-6 print-section">
              <div className="flex items-center gap-2 mb-4">
                <AlignLeft className="w-5 h-5 text-primary" />
                <h3 className="text-xl">Detailed Feedback</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {detailedFeedback}
              </p>
            </Card>
          )}

          {/* ── Recommendations ── */}
          {recommendations.length > 0 && (
            <Card className="p-6 print-section">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-xl">Personalized Recommendations</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {recommendations.map((rec: any, i: number) => (
                  <div key={i} className="p-4 bg-secondary rounded-lg">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                          rec.priority === "high"
                            ? "bg-red-500/20 text-red-400"
                            : rec.priority === "medium"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Next Steps ── */}
          {nextSteps.length > 0 && (
            <Card className="p-6 print-section">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl">Next Steps</h3>
              </div>

              <div className="space-y-3">
                {nextSteps.map((step: string, i: number) => (
                  <div
                    key={i}
                    className="p-4 bg-secondary rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>

                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Skill Assessment ── */}
          {skillAssessment.length > 0 && (
            <Card className="p-6 print-section">
              <div className="flex items-center gap-2 mb-6">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl">Skill Assessment</h3>
              </div>

              <div className="space-y-4">
                {skillAssessment.map((skill: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg bg-secondary border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{skill.skill}</h4>

                      <span className="text-sm text-muted-foreground">
                        {skill.currentLevel || 0}/100
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-border overflow-hidden mb-3">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${skill.currentLevel || 0}%`,
                        }}
                      />
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {skill.feedback}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center no-print">
            <Button
              variant="default"
              size="lg"
              onClick={() => navigate("/interview-setup")}
              className="shadow-lg shadow-primary/50"
            >
              Start Another Interview
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
