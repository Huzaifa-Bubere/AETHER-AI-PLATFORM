import { apiService } from './api';
import {
  Interview,
  InterviewSetupForm,
  InterviewSession,
  Question,
  Response,
  InterviewAnalysis,
  InterviewFeedback,
  APIResponse,
  PaginatedResponse,
} from '../types';

class InterviewService {
  // Interview Management
  async createInterview(setup: InterviewSetupForm): Promise<APIResponse<Interview>> {
    return apiService.post<Interview>('/interview/create', setup);
  }

  async startInterview(interviewId: string): Promise<APIResponse<InterviewSession>> {
    return apiService.post<InterviewSession>(`/interview/${interviewId}/start`);
  }

  async endInterview(interviewId: string): Promise<APIResponse<Interview>> {
    return apiService.post<Interview>(`/interview/${interviewId}/end`);
  }

  async getInterview(interviewId: string): Promise<APIResponse<Interview>> {
    return apiService.get<Interview>(`/interview/${interviewId}`);
  }

  async getInterviewHistory(
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<Interview>> {
    return apiService.getPaginated<Interview>('/interview/history', page, limit);
  }

  // Question Management
  async getNextQuestion(interviewId: string): Promise<APIResponse<Question>> {
    return apiService.get<Question>(`/interview/${interviewId}/next-question`);
  }

  async submitResponse(
    interviewId: string,
    questionId: string,
    response: Partial<Response>
  ): Promise<APIResponse<{ success: boolean }>> {
    return apiService.post(`/interview/${interviewId}/response`, {
      questionId,
      ...response,
    });
  }

  // Real-time Analysis
  async processVideoFrame(
    interviewId: string,
    frameData: string
  ): Promise<APIResponse<{ analysis: any }>> {
    return apiService.post(`/interview/${interviewId}/process-video`, {
      frameData,
    });
  }

  async processAudioChunk(
    interviewId: string,
    audioData: Blob
  ): Promise<APIResponse<{ transcript: string; analysis: any }>> {
    const formData = new FormData();
    formData.append('audio', audioData);
    formData.append('interviewId', interviewId);

    return apiService.upload(`/interview/${interviewId}/process-audio`, formData);
  }

  // Analysis & Feedback
  async getInterviewAnalysis(interviewId: string): Promise<APIResponse<InterviewAnalysis>> {
    return apiService.get<InterviewAnalysis>(`/interview/${interviewId}/analysis`);
  }

  async generateFeedback(interviewId: string): Promise<APIResponse<InterviewFeedback>> {
    return apiService.post<InterviewFeedback>(`/interview/${interviewId}/feedback`);
  }

  async getFeedback(interviewId: string): Promise<APIResponse<InterviewFeedback>> {
    return apiService.get<InterviewFeedback>(`/interview/${interviewId}/feedback`);
  }

  // Reports
  async generateReport(interviewId: string): Promise<APIResponse<{ reportUrl: string }>> {
    return apiService.post<{ reportUrl: string }>(`/interview/${interviewId}/report`);
  }

  async downloadReport(interviewId: string): Promise<Blob> {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/interview/${interviewId}/report/download`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download report');
    }

    return response.blob();
  }

  // Coding Interview Specific
  async submitCode(
    interviewId: string,
    questionId: string,
    code: string,
    language: string
  ): Promise<APIResponse<{ testResults: any[] }>> {
    return apiService.post(`/interview/${interviewId}/submit-code`, {
      questionId,
      code,
      language,
    });
  }

  async runCode(
    interviewId: string,
    code: string,
    language: string,
    testCases: any[]
  ): Promise<APIResponse<{ results: any[] }>> {
    return apiService.post(`/interview/${interviewId}/run-code`, {
      code,
      language,
      testCases,
    });
  }

  // Practice Mode
  async getPracticeQuestions(
    type: string,
    difficulty: string,
    count: number = 5
  ): Promise<APIResponse<Question[]>> {
    return apiService.get<Question[]>('/interview/practice/questions', {
      type,
      difficulty,
      count,
    });
  }

  async submitPracticeResponse(
    questionId: string,
    response: Partial<Response>
  ): Promise<APIResponse<{ feedback: string; score: number }>> {
    return apiService.post('/interview/practice/response', {
      questionId,
      ...response,
    });
  }

  // Mock Interview Scheduling
  async scheduleInterview(
    datetime: string,
    type: string,
    duration: number
  ): Promise<APIResponse<Interview>> {
    return apiService.post<Interview>('/interview/schedule', {
      datetime,
      type,
      duration,
    });
  }

  async cancelInterview(interviewId: string): Promise<APIResponse<{ success: boolean }>> {
    return apiService.delete(`/interview/${interviewId}`);
  }

  async rescheduleInterview(
    interviewId: string,
    newDatetime: string
  ): Promise<APIResponse<Interview>> {
    return apiService.put<Interview>(`/interview/${interviewId}/reschedule`, {
      datetime: newDatetime,
    });
  }
}

export const interviewService = new InterviewService();
export default interviewService;