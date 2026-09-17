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
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useInterviewStore } from "../stores/interviewStore";

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
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "in-progress":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "scheduled":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      default:
        return "bg-secondary text-muted-foreground";
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
      <div className="min-h-screen py-20 px-4 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading interview history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-16 px-4 bg-background text-foreground font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Interview History & Reports
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review transcripts, adaptive score trends, and AI evaluations
            </p>
          </div>

          <Button
            onClick={() => navigate("/interview-setup")}
            className="font-bold text-sm w-fit"
          >
            <Play className="w-4 h-4 mr-2" />
            Start New Interview
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className="p-4 rounded-xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Filter className="w-4 h-4 text-primary" />
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
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
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
                  className="p-5 rounded-2xl hover:border-ring transition-all shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-2xl">{getTypeIcon(interview.type)}</span>
                        <div>
                          <h3 className="text-base font-bold text-foreground capitalize">
                            {roleTitle} · {interview.type?.replace("-", " ")} Round
                          </h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span className="capitalize">{interview.difficulty || "Adaptive"}</span>
                            <span>•</span>
                            <span>{interview.questionsAnswered ?? 0} questions evaluated</span>
                          </div>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ml-auto md:ml-0 ${getStatusColor(interview.status)}`}>
                          {interview.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(interview.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>

                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {interview.duration || 15} min
                        </span>

                        {interview.status === "completed" && (
                          <span className="flex items-center gap-1.5 font-bold text-primary">
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
                          className="font-semibold text-xs"
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
                          className="text-xs"
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
          <Card className="p-12 text-center rounded-2xl">
            <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">No Interviews Found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              {filter === "all"
                ? "You haven't practiced any mock interviews yet. Start your first session now!"
                : `No interviews with status "${filter}".`}
            </p>
            <Button onClick={() => navigate("/interview-setup")}>
              Start Your First Interview
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
