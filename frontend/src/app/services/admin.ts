import api from './api';

export interface PlatformStats {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    growth: Array<{ _id: { year: number; month: number }; count: number }>;
    subscriptions: Array<{ _id: string; count: number }>;
  };
  interviews: {
    total: number;
    completed: number;
    inProgress: number;
    avgSuccessRate: number;
    byType: Array<{ _id: string; count: number }>;
  };
  timestamp: Date;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  platform: string;
  nodeVersion: string;
  database: {
    size: number;
    collections: number;
    indexes: number;
  };
  timestamp: Date;
}

export interface AIMetrics {
  accuracy: number;
  responseTime: number;
  userSatisfaction: number;
  questionQuality: number;
  feedbackAccuracy: number;
  totalAnalyzed: number;
}

export interface Activity {
  user: string;
  action: string;
  time: Date;
  score: number | null;
}

export const adminService = {
  async getStats(): Promise<PlatformStats> {
    const response = await api.get<PlatformStats>('/admin/stats');
    return response.data as PlatformStats;
  },

  async getSystemMetrics(): Promise<SystemMetrics> {
    const response = await api.get<SystemMetrics>('/admin/system-metrics');
    return response.data as SystemMetrics;
  },

  async getAIMetrics(): Promise<AIMetrics> {
    const response = await api.get<AIMetrics>('/admin/ai-metrics');
    return response.data as AIMetrics;
  },

  async getActivity(limit: number = 20): Promise<Activity[]> {
    const response = await api.get<Activity[]>(`/admin/activity?limit=${limit}`);
    return response.data as Activity[];
  },

  async getUsers(page: number = 1, limit: number = 20, search?: string, plan?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) params.append('search', search);
    if (plan) params.append('plan', plan);

    const response = await api.get(`/admin/users?${params.toString()}`);
    return response.data;
  },

  async getInterviews(page: number = 1, limit: number = 20, status?: string, type?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const response = await api.get(`/admin/interviews?${params.toString()}`);
    return response.data;
  },

  async updateUser(userId: string, updates: any) {
    const response = await api.put(`/admin/users/${userId}`, updates);
    return response.data;
  },

  async deleteUser(userId: string) {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },
};

export default adminService;
