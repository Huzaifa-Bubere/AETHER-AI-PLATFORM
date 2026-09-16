import axios from 'axios';
import logger from '../../utils/logger';

export class AIUnavailableError extends Error {
  statusCode = 503;
  constructor(message = 'AI service is unavailable. Please retry later.') { super(message); }
}

export function generationModel() { return process.env.GEMINI_MODEL || 'gemini-3.6-flash'; }

function modelName(name: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new AIUnavailableError('Invalid AI model configuration.');
  return name;
}

async function requestModel(model: string, operation: string, body: unknown, timeout: number) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AIUnavailableError('AI service is not configured.');
  try {
    const { data } = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName(model)}:${operation}`, body, {
      timeout, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      maxContentLength: 2 * 1024 * 1024, maxRedirects: 0,
    });
    return data;
  } catch (error: any) {
    // Never serialize Axios errors: their config includes the authorization key.
    logger.warn('ai.provider.failure', { operation, model, status: error.response?.status, code: error.code });
    throw new AIUnavailableError();
  }
}

export async function generateJson(prompt: string, timeout = 45000): Promise<unknown> {
  const data = await requestModel(generationModel(), 'generateContent', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
  }, timeout);
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new AIUnavailableError('AI returned an incomplete response.');
  try {
    const text = candidate.content?.parts?.map((p: any) => p.text || '').join('');
    return JSON.parse(text);
  } catch { throw new AIUnavailableError('AI returned an invalid response.'); }
}

export const EMBEDDING_DIMENSIONS = 768;
export function embeddingModel() { return process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'; }
export async function embedText(text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  const model = embeddingModel();
  const data = await requestModel(model, 'embedContent', {
    model: `models/${model}`, content: { parts: [{ text }] },
    // Top-level fields remain necessary on the deployed v1beta endpoint:
    // nested embedContentConfig was live-tested and ignored (returned 3072).
    taskType, outputDimensionality: EMBEDDING_DIMENSIONS,
  }, 20000);
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS || !values.every(v => typeof v === 'number' && Number.isFinite(v))) {
    throw new AIUnavailableError('Embedding response failed validation.');
  }
  const norm = Math.hypot(...values);
  if (!norm) throw new AIUnavailableError('Embedding response was empty.');
  return values.map(v => v / norm);
}
