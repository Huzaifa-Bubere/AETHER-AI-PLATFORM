import api from './api';

export interface ScheduleInterviewParams {
  type: 'behavioral' | 'technical' | 'coding' | 'system-design';
  scheduledTime: string; // ISO 8601 format
  settings: {
    role: string;
    difficulty: 'easy' | 'medium' | 'hard';
    duration: number;
    includeVideo?: boolean;
    includeAudio?: boolean;
    includeCoding?: boolean;
  };
  reminderEnabled?: boolean;
}

export interface ScheduledInterview {
  _id: string;
  id: string;
  type: string;
  scheduledTime: Date;
  settings: {
    role: string;
    difficulty: string;
    duration: number;
  };
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: Date;
}

export const schedulingService = {
  // Schedule a new interview
  async scheduleInterview(params: ScheduleInterviewParams) {
    const response = await api.post('/scheduling/schedule', params);
    return response.data;
  },

  // Get all scheduled interviews
  async getScheduledInterviews() {
    const response = await api.get('/scheduling/scheduled');
    return response.data;
  },

  // Get upcoming interviews (next 7 days)
  async getUpcomingInterviews() {
    const response = await api.get('/scheduling/upcoming');
    return response.data;
  },

  // Reschedule an interview
  async rescheduleInterview(interviewId: string, newTime: string) {
    const response = await api.put(`/scheduling/${interviewId}/reschedule`, {
      scheduledTime: newTime,
    });
    return response.data;
  },

  // Cancel a scheduled interview
  async cancelInterview(interviewId: string) {
    const response = await api.delete(`/scheduling/${interviewId}`);
    return response.data;
  },

  // Send reminder for an interview
  async sendReminder(interviewId: string) {
    const response = await api.post(`/scheduling/${interviewId}/send-reminder`);
    return response.data;
  },
};

export default schedulingService;
