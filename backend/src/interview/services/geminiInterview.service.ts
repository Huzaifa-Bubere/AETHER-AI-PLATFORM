import { generateJson, AIUnavailableError } from '../../services/ai/provider';
import logger from '../../utils/logger';

export class GeminiInterviewService {
  /**
   * Execute a structured Gemini call with retries and timeout protection.
   */
  async generateStructured<T>(prompt: string, validator: (data: any) => data is T, fallback: () => T, maxRetries = 2): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const jsonResult = await generateJson(prompt, 35000);
        if (validator(jsonResult)) {
          return jsonResult;
        }
        logger.warn(`Gemini structured response failed validation on attempt ${attempt}`);
      } catch (err: any) {
        logger.warn(`Gemini interview call error (attempt ${attempt}/${maxRetries}):`, {
          message: err.message,
          code: err.code,
        });
        if (attempt === maxRetries) break;
        await new Promise(r => setTimeout(r, 800 * attempt));
      }
    }

    logger.warn('Gemini structured call exhausted retries; using safe heuristic fallback.');
    return fallback();
  }
}

export const geminiInterviewService = new GeminiInterviewService();
