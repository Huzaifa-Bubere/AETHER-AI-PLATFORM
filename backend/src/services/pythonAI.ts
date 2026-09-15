import axios, { AxiosRequestConfig } from 'axios';
import logger from '../utils/logger';

class PythonAIService {
  async post<T = any>(endpoint: string, data: unknown, options: AxiosRequestConfig = {}): Promise<T> {
    const baseURL = process.env.PYTHON_AI_SERVER_URL || 'http://localhost:8000';
    const key = process.env.PYTHON_AI_SERVER_API_KEY;
    if (!key) throw Object.assign(new Error('Analysis service is not configured.'), { statusCode: 503 });
    try {
      const response = await axios.post(endpoint, data, { ...options, baseURL, timeout: options.timeout || 30000,
        maxRedirects: 0, maxContentLength: 10 * 1024 * 1024,
        headers: { ...options.headers, Authorization: `Bearer ${key}` } });
      if (response.data?.success !== true || !response.data.data || response.data.data.error) throw new Error('Analysis failed validation');
      return response.data.data as T;
    } catch (error: any) {
      logger.warn('python_ai.request_failed', { endpoint, status: error.response?.status, code: error.code });
      throw Object.assign(new Error('Analysis service is temporarily unavailable.'), { statusCode: 503 });
    }
  }
  async health() {
    try {
      const { data } = await axios.get(`${(process.env.PYTHON_AI_SERVER_URL || 'http://localhost:8000').replace(/\/$/, '')}/health`, { timeout: 3000, maxRedirects: 0 });
      return data;
    } catch { return { status: 'unavailable' }; }
  }
}
export default new PythonAIService();
