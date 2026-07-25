import { useEffect, useState } from 'react';
import { Users, Video, TrendingUp, AlertTriangle, Activity, Award } from 'lucide-react';
import { Card } from '../components/ui/card';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import adminService, { PlatformStats, SystemMetrics, AIMetrics, Activity as ActivityType } from '../services/admin';
import toast from 'react-hot-toast';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [aiMetrics, setAIMetrics] = useState<AIMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('Loading admin dashboard data...');
      
      // Load data sequentially to identify which endpoint fails
      console.log('Fetching stats...');
      const statsData = await adminService.getStats();
      console.log('Stats loaded:', statsData);
      setStats(statsData);

      console.log('Fetching system metrics...');
      const metricsData = await adminService.getSystemMetrics();
      console.log('System metrics loaded:', metricsData);
      setSystemMetrics(metricsData);

      console.log('Fetching AI metrics...');
      const aiData = await adminService.getAIMetrics();
      console.log('AI metrics loaded:', aiData);
      setAIMetrics(aiData);

      console.log('Fetching activity...');
      const activityData = await adminService.getActivity(20);
      console.log('Activity loaded:', activityData);
      setActivity(activityData);

      console.log('✅ All dashboard data loaded successfully');
    } catch (error: any) {
      console.error('❌ Failed to load dashboard data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load dashboard data';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show partial data if some endpoints failed
  if (!stats && !systemMetrics && !aiMetrics) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl gradient-text mb-2">Unable to Load Dashboard</h2>
          <p className="text-muted-foreground mb-6">
            Failed to load admin dashboard data. Please check your connection and try again.
          </p>
          <button
            onClick={loadDashboardData}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Users', 
      value: stats?.users?.total?.toLocaleString() || '0', 
      change: '+23%', 
      icon: Users, 
      color: 'from-indigo-500 to-purple-500' 
    },
    { 
      label: 'Total Interviews', 
      value: stats?.interviews?.total?.toLocaleString() || '0', 
      change: '+18%', 
      icon: Video, 
      color: 'from-purple-500 to-pink-500' 
    },
    { 
      label: 'Avg Success Rate', 
      value: `${stats?.interviews?.avgSuccessRate || 0}%`, 
      change: '+5%', 
      icon: TrendingUp, 
      color: 'from-pink-500 to-red-500' 
    },
    { 
      label: 'Active Issues', 
      value: '23', 
      change: '-12%', 
      icon: AlertTriangle, 
      color: 'from-orange-500 to-yellow-500' 
    }
  ];

  // Transform user growth data for chart
  const userGrowthData = stats?.users?.growth?.map(item => ({
    month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', { month: 'short' }),
    users: item.count
  })) || [];

  // Transform interview type data for chart
  const interviewTypeData = stats?.interviews?.byType?.map(item => ({
    type: item._id.charAt(0).toUpperCase() + item._id.slice(1),
    count: item.count
  })) || [];

  const aiPerformanceData = aiMetrics ? [
    { metric: 'Accuracy', value: aiMetrics.accuracy },
    { metric: 'Response Time', value: aiMetrics.responseTime },
    { metric: 'User Satisfaction', value: aiMetrics.userSatisfaction },
    { metric: 'Question Quality', value: aiMetrics.questionQuality },
    { metric: 'Feedback Accuracy', value: aiMetrics.feedbackAccuracy }
  ] : [];

  // Mock system metrics data for chart (in production, fetch historical data)
  const systemMetricsData = systemMetrics ? [
    { time: '00:00', cpu: 45, memory: 62, requests: 234 },
    { time: '04:00', cpu: 38, memory: 58, requests: 156 },
    { time: '08:00', cpu: 72, memory: 75, requests: 456 },
    { time: '12:00', cpu: 85, memory: 82, requests: 678 },
    { time: '16:00', cpu: 78, memory: 79, requests: 589 },
    { time: '20:00', cpu: systemMetrics.cpu, memory: systemMetrics.memory, requests: 423 }
  ] : [];

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds} sec ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl gradient-text mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor platform performance and user activity</p>
        </div>

        {/* Stats Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-2xl sm:text-3xl gradient-text mb-1">{stat.value}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <span className={`text-sm ${
                  stat.change.startsWith('+') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stat.change}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Row 1 - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-xl">User Growth</h3>
            </div>
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
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e1e2e', 
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#6366f1" 
                  fillOpacity={1} 
                  fill="url(#userGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Video className="w-5 h-5 text-primary" />
              <h3 className="text-xl">Interview Types</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={interviewTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                <XAxis dataKey="type" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e1e2e', 
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* AI Performance */}
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-xl">AI Model Performance Metrics</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 lg:gap-6">
            {aiPerformanceData.map((metric, index) => (
              <div key={index} className="text-center">
                <div className="relative inline-block mb-3">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="rgba(99, 102, 241, 0.2)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#6366f1"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(metric.value / 100) * 251} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl gradient-text">{metric.value}%</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{metric.metric}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* System Metrics & Recent Activity - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-xl">System Metrics</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={systemMetricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                  <XAxis dataKey="time" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e1e2e', 
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '8px'
                    }}
                  />
                  <Line type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2} />
                  <Line type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} />
                  <Line type="monotone" dataKey="requests" stroke="#ec4899" strokeWidth={2} />
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
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#ec4899] rounded-full"></div>
                  <span className="text-sm">Requests</span>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="text-lg">Recent Activity</h3>
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {activity.map((act, index) => (
                <div key={index} className="pb-4 border-b border-border last:border-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{act.user}</p>
                    {act.score !== null && (
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded shrink-0">
                        {act.score}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{act.action}</p>
                  <p className="text-xs text-muted-foreground">{formatTimeAgo(act.time)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Error Logs */}
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="text-xl">Recent Error Logs</h3>
          </div>
          <div className="space-y-2">
            {[
              { severity: 'warning', message: 'High API response time detected', time: '10 min ago' },
              { severity: 'error', message: 'Database connection timeout', time: '1 hour ago' },
              { severity: 'warning', message: 'Memory usage above 80%', time: '2 hours ago' },
              { severity: 'info', message: 'Scheduled backup completed', time: '3 hours ago' }
            ].map((log, index) => (
              <div key={index} className="p-3 bg-secondary rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    log.severity === 'error' ? 'bg-red-400' :
                    log.severity === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                  }`}></div>
                  <span className="text-sm">{log.message}</span>
                </div>
                <span className="text-xs text-muted-foreground">{log.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
