import api from './api';

export interface PracticeQuestion {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  expectedDuration: number;
  followUpQuestions?: string[];
}

export interface PracticeSession {
  sessionId: string;
  userId: string;
  type: string;
  difficulty: string;
  questions: PracticeQuestion[];
  responses: any[];
  startTime: Date;
  status: 'active' | 'completed';
}

export interface PracticeResponse {
  sessionId: string;
  questionId: string;
  answer: string;
}

export const practiceService = {
  // Generate practice questions
  async generateQuestions(params: {
    type: 'behavioral' | 'technical' | 'coding' | 'system-design';
    difficulty: 'easy' | 'medium' | 'hard';
    count: number;
    role?: string;
  }) {
    const response = await api.post('/practice/questions', params);
    return response.data;
  },

  // Submit practice response
  async submitResponse(data: PracticeResponse) {
    const response = await api.post('/practice/response', data);
    return response.data;
  },

  // Get practice session
  async getSession(sessionId: string) {
    const response = await api.get(`/practice/session/${sessionId}`);
    return response.data;
  },

  // End practice session
  async endSession(sessionId: string) {
    const response = await api.post(`/practice/session/${sessionId}/end`);
    return response.data;
  },

  // Get practice history
  async getHistory() {
    const response = await api.get('/practice/history');
    return response.data;
  },
};

export default practiceService;
