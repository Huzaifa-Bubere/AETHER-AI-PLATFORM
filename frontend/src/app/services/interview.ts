import { apiService } from './api';

export interface SetupInterviewPayload {
  role: string;
  experienceLevel: string;
  interviewType: string;
  difficultyMode: string;
  company?: string;
  language?: string;
  plannedQuestions?: number;
  resumeId?: string;
  jobDescription?: string;
  jobRequirements?: string[];
  settings?: {
    duration?: number;
    includeVideo?: boolean;
    includeAudio?: boolean;
  };
}

export interface ActiveQuestionData {
  interviewId: string;
  interactionId: string;
  question: string;
  intent: string;
  topic: string;
  difficulty: string;
  stage: string;
  expectedDuration: number;
  totalAnswered: number;
  plannedQuestions: number;
}

export interface AnswerSubmitPayload {
  answer: string;
  answerSource: 'voice' | 'text';
  responseTimeSeconds?: number;
}

export interface AnswerResponseData {
  finished: boolean;
  interviewId?: string;
  evaluation?: {
    correctness: number;
    technicalDepth: number;
    relevance: number;
    clarity: number;
    communication: number;
    overallScore: number;
    conceptsCovered: string[];
    conceptsMissing: string[];
    strengths: string[];
    weaknesses: string[];
    feedbackSummary: string;
    suggestedAnswerImprovement?: string;
  };
  decision?: {
    action: string;
    nextStage: string;
    nextTopic: string;
    nextDifficulty: string;
    reason: string;
  };
  nextQuestion?: ActiveQuestionData;
  finalAssessment?: any;
}

class InterviewService {
  async createInterview(payload: SetupInterviewPayload) {
    return apiService.post<any>('/interview/create', payload);
  }

  async startInterview(interviewId: string) {
    return apiService.post<ActiveQuestionData>(`/interview/${interviewId}/start`, {});
  }

  async submitAnswer(interviewId: string, payload: AnswerSubmitPayload) {
    return apiService.post<AnswerResponseData>(`/interview/${interviewId}/answer`, payload);
  }

  async endInterview(interviewId: string) {
    return apiService.post<any>(`/interview/${interviewId}/end`, {});
  }

  async getInterview(interviewId: string) {
    return apiService.get<any>(`/interview/${interviewId}`);
  }

  async getInterviewResult(interviewId: string) {
    return apiService.get<any>(`/interview/${interviewId}/result`);
  }

  async getHistory(page = 1, limit = 10) {
    return apiService.get<any>(`/interview/history/me?page=${page}&limit=${limit}`);
  }

  async recordIntegrityEvent(interviewId: string, type: string, details?: string) {
    return apiService.post<any>(`/interview/${interviewId}/integrity`, { type, details });
  }
}

export const interviewService = new InterviewService();