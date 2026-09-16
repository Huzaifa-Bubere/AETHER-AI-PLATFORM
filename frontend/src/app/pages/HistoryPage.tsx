import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Award,
  Eye,
  Filter,
  Loader2,
  AlertCircle,
  Play,
  CheckCircle2,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useInterviewStore } from "../stores/interviewStore";
import toast from "react-hot-toast";

export function HistoryPage() {
  const navigate = useNavigate();
  const { interviews, fetchHistory, isLoading } = useInterviewStore();
  const [filter, setFilter] = useState<"all" | "completed" | "in-progress" | "scheduled">("all");

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredInterviews = interviews.filter((interview) => {
    if (filter === "all") return true;
    return interview.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      case "in-progress":
        return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
      case "scheduled":
        return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
      default:
        return "bg-slate-500/20 text-slate-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "behavioral":
        return "💬";
      case "technical":
        return "⚙️";
      case "coding":
        return "💻";
      case "system-design":
        return "🏗️";
      default:
        return "📝";
    }
  };

  if (isLoading && interviews.length === 0) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading interview history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-16 px-4 bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Interview History & Reports
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Review transcripts, adaptive score trends, and AI evaluations
            </p>
          </div>

          <Button
            onClick={() => navigate("/interview-setup")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 w-fit"
          >
            <Play className="w-4 h-4 mr-2" />
            Start New Interview
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className="p-4 bg-slate-900/80 border-slate-800 rounded-xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span>Filter Status:</span>
          </div>

          <div className="flex items-center gap-2">
            {(["all", "completed", "in-progress", "scheduled"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${
                  filter === s
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {s} ({s === "all" ? interviews.length : interviews.filter((i) => i.status === s).length})
              </button>
            ))}
          </div>
        </Card>

        {/* Interview List */}
        {filteredInterviews.length > 0 ? (
          <div className="grid gap-3">
            {filteredInterviews.map((interview) => {
              const interviewId = (interview as any)._id || interview.id;
              const overallScore = interview.overallScore ?? interview.analysis?.overallScore ?? 0;
              const roleTitle = interview.role || interview.settings?.role || "Software Engineer";

              return (
                <Card
                  key={interviewId}
                  className="p-5 bg-slate-900/80 border-slate-800 rounded-2xl hover:border-slate-700 transition-all shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-2xl">{getTypeIcon(interview.type)}</span>
                        <div>
                          <h3 className="text-base font-bold text-white capitalize">
                            {roleTitle} · {interview.type?.replace("-", " ")} Round
                          </h3>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="capitalize">{interview.difficulty || "Adaptive"}</span>
                            <span>•</span>
                            <span>{interview.questionsAnswered ?? 0} questions evaluated</span>
                          </div>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ml-auto md:ml-0 ${getStatusColor(interview.status)}`}>
                          {interview.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {new Date(interview.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>

                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {interview.duration || 15} min
                        </span>

                        {interview.status === "completed" && (
                          <span className="flex items-center gap-1.5 font-bold text-indigo-400">
                            <Award className="w-3.5 h-3.5" />
                            Score: {overallScore}/100
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex gap-2 items-center shrink-0">
                      {interview.status === "completed" && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/feedback/${interviewId}`)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View Assessment
                        </Button>
                      )}

                      {interview.status === "in-progress" && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/interview-room?id=${interviewId}`)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                        >
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          Resume Room
                        </Button>
                      )}

                      {interview.status === "scheduled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/interview-room?id=${interviewId}`)}
                          className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
                        >
                          Start Interview
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-900/60 border-slate-800 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No Interviews Found</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
              {filter === "all"
                ? "You haven't practiced any mock interviews yet. Start your first session now!"
                : `No interviews with status "${filter}".`}
            </p>
            <Button
              onClick={() => navigate("/interview-setup")}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Start Your First Interview
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
