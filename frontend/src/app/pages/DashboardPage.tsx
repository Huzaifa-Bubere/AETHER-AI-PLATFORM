import { Link } from 'react-router-dom';
import { Play, FileText, TrendingUp, TrendingDown, Award, Clock, Target, Brain, Code, Calendar, ChevronRight, Minus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { memo, useMemo, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

export const DashboardPage = memo(function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllInterviews, setShowAllInterviews] = useState(false);

  useEffect(() => {
    fetchDashboardData(true);                                               // initial — show spinner
    const interval = setInterval(() => fetchDashboardData(false), 30000);  // poll — silent
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const response = await apiService.get('/user/stats');
      if (response.success) {
        setStats(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to load dashboard data');
      }
    } catch (err: any) {
      if (showSpinner) setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const recentInterviews = useMemo(() => stats?.recentInterviews || [], [stats]);
  const upcomingInterviews = useMemo(() => stats?.upcomingInterviews || [], [stats]);

  // API returns totalInterviews: 0 even when recentInterviews has items — use the larger value
  const totalInterviews = useMemo(() => {
    const apiTotal = stats?.totalInterviews || 0;
    return Math.max(apiTotal, recentInterviews.length);
  }, [stats, recentInterviews]);

  // Calculate real average from recentInterviews if API returns 0
  const averageScore = useMemo(() => {
    if (stats?.averageScore && stats.averageScore > 0) return stats.averageScore;
    const scored = recentInterviews.filter((i: any) => i.score > 0);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((sum: number, i: any) => sum + i.score, 0) / scored.length);
  }, [stats, recentInterviews]);

  // Total time from recentInterviews durations
  const totalTime = useMemo(() => {
    const mins = recentInterviews.reduce((sum: number, i: any) => sum + (i.duration || 0), 0);
    return mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  }, [recentInterviews]);

  /**
   * Improvement rate logic:
   * 1. Take only interviews with a real score (> 0), sorted oldest → newest.
   * 2. Split into two halves (older half vs newer half).
   * 3. Compare averages: ((newAvg - oldAvg) / oldAvg) * 100, rounded to 1 dp.
   * 4. If only 1 scored interview exists, compare that single score against 50 (neutral baseline).
   * 5. Falls back to the API value only if we have no scored interviews at all.
   */
  const improvementRate = useMemo(() => {
    const scored = [...recentInterviews]
      .filter((i: any) => i.score > 0)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (scored.length === 0) {
      // Nothing to compute — use API value or 0
      return stats?.improvementRate ?? 0;
    }

    if (scored.length === 1) {
      // Single interview: improvement relative to a neutral baseline of 50
      const delta = scored[0].score - 50;
      return Math.round(delta * 10) / 10;
    }

    const mid = Math.floor(scored.length / 2);
    const older = scored.slice(0, mid);
    const newer = scored.slice(mid);

    const avg = (arr: any[]) =>
      arr.reduce((sum: number, i: any) => sum + i.score, 0) / arr.length;

    const oldAvg = avg(older);
    const newAvg = avg(newer);

    if (oldAvg === 0) return 0;

    const rate = ((newAvg - oldAvg) / oldAvg) * 100;
    return Math.round(rate * 10) / 10; // e.g. +12.5 or -4.2
  }, [recentInterviews, stats]);

  // Score trend chart data (last 8 completed interviews with score > 0)
  const scoreTrend = useMemo(() => {
    return [...recentInterviews]
      .filter((i: any) => i.score > 0)
      .reverse()
      .slice(-8)
      .map((i: any, idx: number) => ({
        name: `#${idx + 1}`,
        score: i.score,
        type: i.type,
      }));
  }, [recentInterviews]);

  const skillData = useMemo(() => {
    if (stats?.skillProgress?.length > 0) {
      return stats.skillProgress.map((skill: any) => ({
        skill: skill.skill,
        value: skill.currentLevel * 10,
        previous: skill.previousLevel * 10,
        trend: skill.trend,
      }));
    }
    return [
      { skill: 'Communication', value: 0, previous: 0, trend: 'stable' },
      { skill: 'Technical', value: 0, previous: 0, trend: 'stable' },
      { skill: 'Problem Solving', value: 0, previous: 0, trend: 'stable' },
    ];
  }, [stats]);

  const statsData = useMemo(() => [
    { label: 'Interviews', value: totalInterviews.toString(), icon: Play, color: 'bg-blue-500' },
    { label: 'Avg Score', value: `${averageScore}%`, icon: Award, color: 'bg-purple-500' },
    { label: 'Total Time', value: totalTime, icon: Clock, color: 'bg-pink-500' },
    {
      label: 'Improvement',
      value: `${improvementRate >= 0 ? '+' : ''}${improvementRate}%`,
      icon: improvementRate >= 0 ? TrendingUp : TrendingDown,
      color: improvementRate >= 0 ? 'bg-orange-500' : 'bg-red-500',
    },
  ], [totalInterviews, averageScore, totalTime, improvementRate]);

  const nextSteps = useMemo(() => {
    const steps: Array<{ text: string; progress: number }> = [];
    if (!stats || totalInterviews === 0) {
      steps.push({ text: 'Complete your first interview', progress: 0 });
      steps.push({ text: 'Upload your resume', progress: 0 });
      steps.push({ text: 'Set up your profile', progress: user ? 50 : 0 });
    } else {
      if (totalInterviews < 5) steps.push({ text: 'Complete 5 interviews', progress: (totalInterviews / 5) * 100 });
      if (averageScore < 80) steps.push({ text: 'Achieve 80% average score', progress: (averageScore / 80) * 100 });
      if (!recentInterviews.some((i: any) => i.type === 'coding')) steps.push({ text: 'Try a coding interview', progress: 0 });
    }
    while (steps.length < 3) steps.push({ text: 'Practice more interviews', progress: 25 });
    return steps;
  }, [stats, user, totalInterviews, averageScore, recentInterviews]);

  const userName = user ? `${user.profile.firstName} ${user.profile.lastName}` : 'User';
  const userRole = user?.preferences.role || 'Professional';
  const userExperience = user?.preferences.experienceLevel || 'entry';
  const userSkills = user?.preferences.industries || [];

  const displayedInterviews = showAllInterviews ? recentInterviews : recentInterviews.slice(0, 5);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scoreColor = (score: number) =>
    score >= 85 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = (score: number) =>
    score >= 85 ? 'bg-green-100' : score >= 60 ? 'bg-yellow-100' : 'bg-red-100';
  const typeLabel = (type: string) =>
    type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen py-20 px-4 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen py-20 px-4 bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full p-6 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="default">Retry</Button>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-20 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Welcome back, {userName}!</h1>
            <p className="text-muted-foreground">Ready to practice your next interview?</p>
          </div>
          <Link to="/interview-setup">
            <Button variant="default" size="lg">
              <Play className="mr-2 w-5 h-5" />Start New Interview
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsData.map((stat, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow p-6">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-primary mb-1">{stat.value}</p>
              <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Left Column ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Profile Card */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-primary rounded-xl flex items-center justify-center text-3xl font-bold text-white">
                  {user?.profile.firstName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-1">{userName}</h2>
                  <p className="text-muted-foreground mb-3">
                    {userRole} • {userExperience.charAt(0).toUpperCase() + userExperience.slice(1)} Level
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {userSkills.length > 0
                      ? userSkills.slice(0, 4).map((skill: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-primary rounded-full text-sm font-medium">{skill}</span>
                        ))
                      : <span className="text-sm text-muted-foreground">No skills added yet</span>
                    }
                  </div>
                </div>
                <Link to="/profile">
                  <Button variant="outline" size="sm">
                    <FileText className="mr-2 w-4 h-4" />Edit Profile
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Score Trend Chart */}
            {scoreTrend.length > 1 && (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-6">Score Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={scoreTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(value: any) => [`${value}%`, 'Score']}
                    />
                    <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Recent Interviews */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">
                  Recent Interviews
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({recentInterviews.length})</span>
                </h3>
                <Link to="/history">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>

              {recentInterviews.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {displayedInterviews.map((interview: any) => (
                      <div
                        key={interview.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-border hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${scoreBg(interview.score)}`}>
                            {interview.type === 'coding' ? (
                              <Code className="w-5 h-5 text-primary" />
                            ) : (
                              <Brain className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm mb-0.5">{typeLabel(interview.type)}</h4>
                            <p className="text-xs text-muted-foreground">
                              {new Date(interview.date).toLocaleDateString()} &nbsp;•&nbsp; {interview.duration} min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className={`text-lg font-bold ${scoreColor(interview.score)}`}>
                            {interview.score > 0 ? `${interview.score}%` : '—'}
                          </p>
                          <Link to={`/feedback/${interview.id}`}>
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  {recentInterviews.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full mt-4 text-muted-foreground"
                      onClick={() => setShowAllInterviews(prev => !prev)}
                    >
                      {showAllInterviews ? 'Show Less' : `Show All ${recentInterviews.length} Interviews`}
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-4">No interviews yet</p>
                  <Link to="/interview-setup">
                    <Button variant="default">
                      <Play className="mr-2 w-4 h-4" />Start Your First Interview
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Upcoming Interviews */}
            {upcomingInterviews.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="text-xl font-semibold">
                    Upcoming Interviews
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({upcomingInterviews.length})</span>
                  </h3>
                </div>
                <div className="space-y-3">
                  {upcomingInterviews.map((interview: any) => (
                    <div
                      key={interview.id}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm mb-0.5">{typeLabel(interview.type)}</h4>
                          <p className="text-xs text-muted-foreground">
                            {interview.role} &nbsp;•&nbsp; {new Date(interview.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded-full capitalize">
                        {interview.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-4">
              <Link to="/interview-setup">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow p-6">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Technical Interview</h3>
                  <p className="text-muted-foreground text-sm">Practice system design and architecture questions</p>
                </Card>
              </Link>
              <Link to="/coding-interview">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow p-6">
                  <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mb-4">
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Coding Challenge</h3>
                  <p className="text-muted-foreground text-sm">Solve algorithmic problems with AI feedback</p>
                </Card>
              </Link>
            </div>
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-8">

            {/* Skill Assessment */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-semibold">Skill Assessment</h3>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={skillData}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#6B7280', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 10 }} />
                    <Radar name="Current" dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} />
                    <Radar name="Previous" dataKey="previous" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.1} strokeDasharray="4 4" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Skill trend breakdown */}
              <div className="mt-4 space-y-2">
                {skillData.map((skill: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={skill.trend} />
                      <span className="text-muted-foreground">{skill.skill}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {skill.previous !== skill.value && (
                        <span className="text-xs text-muted-foreground line-through">{skill.previous}</span>
                      )}
                      <span className="font-semibold text-primary">{skill.value}/100</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground font-medium">Overall Score</span>
                  <span className="text-primary font-semibold">{averageScore}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${averageScore}%` }} />
                </div>
              </div>
            </Card>

            {/* Next Steps */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Recommended Next Steps</h3>
              <div className="space-y-3">
                {nextSteps.map((step, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{step.text}</span>
                      <span className="text-primary font-semibold">{Math.round(step.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${step.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
});