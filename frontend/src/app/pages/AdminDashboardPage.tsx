import { useCallback, useEffect, useState } from 'react';
import { Users, Video, TrendingUp, AlertTriangle, Activity, Award, Server, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/card';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import adminService, { PlatformStats, SystemMetrics, AIMetrics, Activity as ActivityType, ErrorLogEntry, ErrorLogMeta } from '../services/admin';
import { AdminJobProvidersCard } from '../features/jobs/AdminJobProvidersCard';

/**
 * Admin dashboard.
 *
 * Every number on this page comes from a query or a measurement. There are no
 * placeholder percentages, no invented 24h curves and no sample error logs:
 *  - stat cards read `stats.deltas`, which the backend computes against a real
 *    previous period (and returns null when there is nothing to compare to);
 *  - the system chart plots the sampler's stored history, and says so explicitly
 *    when the buffer is still filling;
 *  - the error log panel reads the real Winston log file;
 *  - AI metrics are the server's averages, and a metric with no sample renders
 *    "no data" instead of 0%.
 */

const CHART_TOOLTIP = {
  backgroundColor: '#1e1e2e',
  border: '1px solid rgba(99, 102, 241, 0.3)',
  borderRadius: '8px',
};

type SectionKey = 'stats' | 'system' | 'ai' | 'activity' | 'logs';

function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return 'time not recorded';
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return 'time not recorded';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Signed percentage label, or an explicit statement that there is no baseline. */
function percentLabel(value: number | null, empty: string): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (value === null) return { text: empty, tone: 'flat' };
  if (value === 0) return { text: 'no change', tone: 'flat' };
  return { text: `${value > 0 ? '+' : ''}${value}%`, tone: value > 0 ? 'up' : 'down' };
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [aiMetrics, setAIMetrics] = useState<AIMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityType[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [errorLogMeta, setErrorLogMeta] = useState<ErrorLogMeta | null>(null);
  const [failures, setFailures] = useState<Partial<Record<SectionKey, string>>>({});
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);

    // Sections load independently: one unavailable endpoint leaves a labelled
    // gap in that panel and the rest of the dashboard stays truthful.
    const [statsResult, systemResult, aiResult, activityResult, logsResult] = await Promise.allSettled([
      adminService.getStats(),
      adminService.getSystemMetrics(),
      adminService.getAIMetrics(),
      adminService.getActivity(20),
      adminService.getErrorLogs(20),
    ]);

    const nextFailures: Partial<Record<SectionKey, string>> = {};
    const message = (error: unknown) => (error instanceof Error ? error.message : 'Request failed');

    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    else nextFailures.stats = message(statsResult.reason);

    if (systemResult.status === 'fulfilled') setSystemMetrics(systemResult.value);
    else nextFailures.system = message(systemResult.reason);

    if (aiResult.status === 'fulfilled') setAIMetrics(aiResult.value);
    else nextFailures.ai = message(aiResult.reason);

    if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
    else nextFailures.activity = message(activityResult.reason);

    if (logsResult.status === 'fulfilled') {
      setErrorLogs(logsResult.value.entries);
      setErrorLogMeta(logsResult.value.meta);
    } else nextFailures.logs = message(logsResult.reason);

    setFailures(nextFailures);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats && !systemMetrics && !aiMetrics && Object.keys(failures).length > 0) {
    return (
      <div className="min-h-screen px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl gradient-text mb-2">Unable to Load Dashboard</h2>
          <p className="text-muted-foreground mb-6">
            No admin endpoint answered. Nothing is shown rather than showing placeholder data.
          </p>
          <button
            onClick={() => void loadDashboardData()}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const usersDelta = percentLabel(stats?.deltas?.usersPercent ?? null, 'no prior month');
  const interviewsDelta = percentLabel(stats?.deltas?.interviewsPercent ?? null, 'no prior 30 days');
  const successRateDelta = stats?.deltas?.successRatePoints ?? null;

  const statCards = [
    {
      label: 'Total Users',
      value: stats ? stats.users.total.toLocaleString() : '—',
      hint: stats ? `${stats.users.newThisMonth.toLocaleString()} new this month` : failures.stats,
      change: usersDelta.text,
      tone: usersDelta.tone,
      icon: Users,
      color: 'from-indigo-500 to-purple-500',
    },
    {
      label: 'Total Interviews',
      value: stats ? stats.interviews.total.toLocaleString() : '—',
      hint: stats ? `${stats.interviews.last30Days.toLocaleString()} in the last 30 days` : failures.stats,
      change: interviewsDelta.text,
      tone: interviewsDelta.tone,
      icon: Video,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: 'Avg Success Rate',
      value: stats ? `${stats.interviews.avgSuccessRate}%` : '—',
      hint: stats
        ? stats.interviews.avgSuccessRateSample > 0
          ? `mean score across ${stats.interviews.avgSuccessRateSample.toLocaleString()} scored interviews`
          : 'no scored interviews yet'
        : failures.stats,
      change: successRateDelta === null ? 'no prior 30 days' : `${successRateDelta > 0 ? '+' : ''}${successRateDelta} pts`,
      tone: successRateDelta === null || successRateDelta === 0 ? 'flat' : successRateDelta > 0 ? 'up' : 'down',
      icon: TrendingUp,
      color: 'from-pink-500 to-red-500',
    },
    {
      label: 'Needs Review',
      value: stats ? stats.needsReview.total.toLocaleString() : '—',
      hint: stats
        ? `${stats.needsReview.integritySessions} session(s) hit the ${stats.needsReview.warningLimit}-warning limit · ${stats.needsReview.staleInProgress} stuck in progress`
        : failures.stats,
      change: stats ? 'actionable' : '—',
      tone: 'flat' as const,
      icon: AlertTriangle,
      color: 'from-orange-500 to-yellow-500',
    },
  ];

  const userGrowthData = (stats?.users.growth ?? []).map(item => ({
    month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', { month: 'short' }),
    users: item.count,
  }));

  const interviewTypeData = (stats?.interviews.byType ?? []).map(item => ({
    type: item._id ? item._id.charAt(0).toUpperCase() + item._id.slice(1) : 'Unspecified',
    count: item.count,
  }));

  const history = systemMetrics?.history ?? [];
  const systemHistoryData = history.map(sample => ({
    time: new Date(sample.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    cpu: sample.cpu,
    memory: sample.memory,
  }));

  const errorTone = (level: string | undefined) =>
    level === 'error' ? 'bg-red-400' : level === 'warn' ? 'bg-yellow-400' : 'bg-blue-400';

  return (
    <div className="min-h-screen px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl gradient-text mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor platform performance and user activity</p>
          </div>
          <button
            onClick={() => void loadDashboardData()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Reload data
          </button>
        </div>

        {/* Stats Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-2xl sm:text-3xl gradient-text mb-1">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-xs ${
                stat.tone === 'up' ? 'text-green-400' : stat.tone === 'down' ? 'text-red-400' : 'text-muted-foreground'
              }`}>
                {stat.change}
              </p>
              {stat.hint && <p className="mt-2 text-[11px] text-muted-foreground">{stat.hint}</p>}
            </Card>
          ))}
        </div>

        {/* Job provider health + manual refresh (admin-only endpoint). */}
        <AdminJobProvidersCard />

        {/* Charts Row 1 - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-xl">New users per month</h3>
            </div>
            {userGrowthData.length === 0 ? (
              <EmptyPanel label="No users have registered in the last 7 months" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                  <XAxis dataKey="month" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name="New users"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill="url(#userGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Video className="w-5 h-5 text-primary" />
              <h3 className="text-xl">Interview types</h3>
            </div>
            {interviewTypeData.length === 0 ? (
              <EmptyPanel label="No interviews recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={interviewTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                  <XAxis dataKey="type" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="count" name="Interviews" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* AI Performance — real averages over stored interview analyses */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-xl">Interview analysis averages</h3>
          </div>
          <p className="mb-6 text-xs text-muted-foreground">
            {failures.ai
              ? failures.ai
              : aiMetrics
                ? `Computed from ${aiMetrics.totalAnalyzed.toLocaleString()} scored interview${aiMetrics.totalAnalyzed === 1 ? '' : 's'}. Metrics with no sample are shown as “no data”.`
                : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
            {(aiMetrics?.metrics ?? []).map(metric => {
              const hasValue = metric.value !== null && metric.sampleSize > 0;
              const fraction = hasValue ? Math.min(1, metric.value! / metric.max) : 0;
              return (
                <div key={metric.key} className="text-center">
                  <div className="relative inline-block mb-3">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="8" fill="none" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#6366f1"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${fraction * 251} 251`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg gradient-text">
                        {hasValue ? `${metric.value}${metric.unit}` : 'no data'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {metric.sampleSize > 0 ? `n = ${metric.sampleSize}` : 'not recorded'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* System Metrics & Recent Activity - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <Card>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-primary" />
                <h3 className="text-xl">System metrics</h3>
                {systemMetrics && (
                  <span className="text-xs text-muted-foreground">
                    sampled every {Math.round(systemMetrics.samplingIntervalMs / 1000)}s · up {formatUptime(systemMetrics.uptime)} ·
                    latest sample {relativeTime(history[history.length - 1]?.at)}
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {failures.system
                  ? failures.system
                  : 'Measured on this server process: CPU from os.cpus() tick deltas, memory from the OS, requests from the API counter.'}
              </p>

              {systemMetrics ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <MetricTile label="CPU" value={systemMetrics.cpu === null ? 'measuring…' : `${systemMetrics.cpu}%`} sublabel={`${systemMetrics.cores} cores`} />
                    <MetricTile label="Memory" value={`${systemMetrics.memory}%`} sublabel={`${formatBytes(systemMetrics.freeMemoryBytes)} free of ${formatBytes(systemMetrics.totalMemoryBytes)}`} />
                    <MetricTile label="API requests" value={systemMetrics.requests.total.toLocaleString()} sublabel="since process start" />
                    <MetricTile
                      label="Database"
                      value={systemMetrics.database ? formatBytes(systemMetrics.database.size) : 'unavailable'}
                      sublabel={systemMetrics.database ? `${systemMetrics.database.collections} collections · ${systemMetrics.database.indexes} indexes` : 'stats not readable'}
                    />
                  </div>

                  {systemHistoryData.length < 2 ? (
                    <EmptyPanel
                      label={`History builds as the server runs — ${systemHistoryData.length} of ${systemMetrics.maxSamples} samples stored so far`}
                    />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={systemHistoryData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                          <XAxis dataKey="time" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                          <Tooltip contentStyle={CHART_TOOLTIP} />
                          <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#6366f1" strokeWidth={2} connectNulls />
                          <Line type="monotone" dataKey="memory" name="Memory %" stroke="#8b5cf6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-[#6366f1] rounded-full"></div>
                          <span className="text-sm">CPU %</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-[#8b5cf6] rounded-full"></div>
                          <span className="text-sm">Memory %</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <EmptyPanel label={failures.system ?? 'System metrics are unavailable.'} />
              )}
            </Card>
          </div>

          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="text-lg">Recent activity</h3>
            </div>
            {failures.activity ? (
              <EmptyPanel label={failures.activity} />
            ) : activity.length === 0 ? (
              <EmptyPanel label="No interviews have been started yet" />
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {activity.map((act, index) => (
                  <div key={index} className="pb-4 border-b border-border last:border-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{act.user}</p>
                      {act.score !== null && act.score !== undefined && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded shrink-0">
                          {act.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{act.action}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(act.time)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Error logs — real Winston entries, empty when nothing has failed */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="text-xl">Recent error logs</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Read from every rotated backend error log (errors only — warnings stay in the combined log).
            {errorLogMeta && errorLogMeta.files.length > 0 && (
              <> Scanned {errorLogMeta.scanned.toLocaleString()} line{errorLogMeta.scanned === 1 ? '' : 's'} across{' '}
              {errorLogMeta.files.join(', ')} — {errorLogMeta.distinct.toLocaleString()} distinct error{errorLogMeta.distinct === 1 ? '' : 's'}.
              {errorLogMeta.unreadable > 0 && ` ${errorLogMeta.unreadable} line(s) were not parseable.`}
              {errorLogMeta.hasUndatedEntries && ' Some entries carry no readable timestamp.'}</>
            )}
          </p>
          {failures.logs ? (
            <EmptyPanel label={failures.logs} />
          ) : errorLogs.length === 0 ? (
            <EmptyPanel label="No errors logged" />
          ) : (
            <div className="space-y-2">
              {errorLogs.map(log => (
                <div key={`${log.level}-${log.message}`} className="p-3 bg-secondary rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${errorTone(log.level)}`}></div>
                      <span className="text-sm break-words">{log.message}</span>
                      {log.count > 1 && (
                        <span className="shrink-0 rounded bg-destructive/20 px-1.5 py-0.5 text-[11px] text-destructive">
                          ×{log.count.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">last {relativeTime(log.lastAt)}</span>
                  </div>
                  {log.count > 1 && (
                    <p className="mt-1 pl-5 text-[11px] text-muted-foreground">
                      first seen {relativeTime(log.firstAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricTile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl gradient-text">{value}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground break-words">{sublabel}</p>}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground">
      <span>{label}</span>
    </div>
  );
}
