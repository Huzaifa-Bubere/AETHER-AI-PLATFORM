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
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useInterviewStore } from "../stores/interviewStore";
import toast from "react-hot-toast";

export function HistoryPage() {
  const navigate = useNavigate();
  const { interviews, getInterviewHistory, isLoading } = useInterviewStore();
  const [filter, setFilter] = useState<
    "all" | "completed" | "in-progress" | "scheduled"
  >("all");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      await getInterviewHistory();
    } catch (error: any) {
      console.error("Failed to load history:", error);
      toast.error("Failed to load interview history");
    }
  };

  const filteredInterviews = interviews.filter((interview) => {
    if (filter === "all") return true;
    return interview.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400";
      case "in-progress":
        return "bg-blue-500/20 text-blue-400";
      case "scheduled":
        return "bg-yellow-500/20 text-yellow-400";
      case "cancelled":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
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

  if (isLoading) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading interview history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl gradient-text mb-2">Interview History</h1>
            <p className="text-muted-foreground">
              View and analyze your past interviews
            </p>
          </div>

          <Button
            variant="default"
            className="w-fit"
            onClick={() => navigate("/interview-setup")}
          >
            Start New Interview
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-2">
              Filter by status:
            </span>

            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              className="w-fit"
              onClick={() => setFilter("all")}
            >
              All ({interviews.length})
            </Button>

            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              className="w-fit"
              onClick={() => setFilter("completed")}
            >
              Completed (
              {interviews.filter((i) => i.status === "completed").length})
            </Button>

            <Button
              variant={filter === "in-progress" ? "default" : "outline"}
              size="sm"
              className="w-fit"
              onClick={() => setFilter("in-progress")}
            >
              In Progress (
              {interviews.filter((i) => i.status === "in-progress").length})
            </Button>

            <Button
              variant={filter === "scheduled" ? "default" : "outline"}
              size="sm"
              className="w-fit"
              onClick={() => setFilter("scheduled")}
            >
              Scheduled (
              {interviews.filter((i) => i.status === "scheduled").length})
            </Button>
          </div>
        </Card>

        {/* Interview List */}
        {filteredInterviews.length > 0 ? (
          <div className="grid gap-4">
            {filteredInterviews.map((interview) => {
              const interviewId = (interview as any)._id || interview.id;

              return (
                <Card
                  key={interviewId}
                  className="p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">
                          {getTypeIcon(interview.type)}
                        </span>

                        <div>
                          <h3 className="text-xl font-semibold capitalize">
                            {interview.type.replace("-", " ")} Interview
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {interview.settings?.role || "General Position"}
                          </p>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}
                        >
                          {interview.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(interview.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {(interview as any).session?.actualDuration || 0} min
                        </span>

                        {interview.analysis && (
                          <span className="flex items-center gap-1 text-primary">
                            <Award className="w-4 h-4" />
                            Score: {interview.analysis.overallScore}/100
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex gap-2 items-center shrink-0">
                      {interview.status === "completed" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-fit"
                          onClick={() => navigate(`/feedback/${interviewId}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Feedback
                        </Button>
                      )}

                      {interview.status === "in-progress" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-fit"
                          onClick={() =>
                            navigate(`/interview-room?id=${interviewId}`)
                          }
                        >
                          Continue Interview
                        </Button>
                      )}

                      {interview.status === "scheduled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() =>
                            navigate(`/interview-room?id=${interviewId}`)
                          }
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
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Interviews Found</h3>

            <p className="text-muted-foreground mb-6">
              {filter === "all"
                ? "You haven't taken any interviews yet. Start your first interview to begin practicing!"
                : `No ${filter} interviews found. Try a different filter.`}
            </p>

            <div className="flex justify-center">
              <Button
                variant="default"
                className="w-fit"
                onClick={() => navigate("/interview-setup")}
              >
                Start Your First Interview
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
