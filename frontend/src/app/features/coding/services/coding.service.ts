import { apiService } from '../../../services/api';
import type {
  CodingProblem, IExecutionResult, ISubmitResult, ISubmissionSummary, ISubmissionDetail,
  ICodingProgress, IRecommendations, IAstAnalysis, CodingLanguage,
} from '../types';

/**
 * AETHER Coding — frontend API client.
 * All calls go through the authenticated apiService (Judge0/Gemini keys stay server-side).
 */
class CodingService {
  async listProblems(params: {
    difficulty?: string; category?: string; search?: string; status?: string;
    company?: string; tag?: string; page?: number; limit?: number;
  } = {}): Promise<APIResponseShape<{ problems: CodingProblem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
    return apiService.get('/coding/problems', params);
  }

  async getProblem(slug: string): Promise<APIResponseShape<CodingProblem>> {
    return apiService.get(`/coding/problems/${slug}`);
  }

  async runCode(payload: {
    problemSlug?: string; language: CodingLanguage; sourceCode: string; customInput?: string;
  }): Promise<APIResponseShape<IExecutionResult>> {
    return apiService.post('/coding/run', payload, { timeout: 120000 });
  }

  async submitCode(payload: {
    problemSlug: string; language: CodingLanguage; sourceCode: string;
  }): Promise<APIResponseShape<ISubmitResult>> {
    return apiService.post('/coding/submit', payload, { timeout: 180000 });
  }

  async analyzeCode(payload: {
    problemSlug?: string; language: CodingLanguage; sourceCode: string;
  }): Promise<APIResponseShape<IAstAnalysis>> {
    return apiService.post('/coding/analyze', payload, { timeout: 30000 });
  }

  async getMySubmissions(page = 1, limit = 20): Promise<APIResponseShape<{ submissions: ISubmissionSummary[]; pagination: any }>> {
    return apiService.get(`/coding/submissions/me?page=${page}&limit=${limit}`);
  }

  async getSubmissionDetail(id: string): Promise<APIResponseShape<ISubmissionDetail>> {
    return apiService.get(`/coding/submissions/${id}`);
  }

  async getMyProgress(): Promise<APIResponseShape<ICodingProgress>> {
    return apiService.get('/coding/progress/me');
  }

  async getRecommendations(): Promise<APIResponseShape<IRecommendations>> {
    return apiService.get('/coding/recommendations');
  }
}

interface APIResponseShape<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const codingService = new CodingService();
