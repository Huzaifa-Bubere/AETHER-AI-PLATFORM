import axios from 'axios';
import logger from '../../utils/logger';

export class AIUnavailableError extends Error {
  statusCode = 503;
  constructor(message = 'AI service is unavailable. Please retry later.') { super(message); }
}

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

export function generationModel() { return process.env.GEMINI_MODEL || 'gemini-3.6-flash'; }

/**
 * Stable models to try when the configured model is rate-limited (429) or
 * overloaded (503). These statuses are transient capacity signals, not evidence
 * that the configured model is wrong, so a fallback turns a failed discussion
 * turn into a served one. Set AI_FALLBACK_MODELS to override, or to '' to
 * disable fallbacks entirely.
 */
export function generationFallbackModels(): string[] {
  const raw = process.env.AI_FALLBACK_MODELS;
  if (raw !== undefined) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  // Chosen by measurement on this deployment, not by reputation: the model list is
  // not a promise. Measured with the real request shape — the 2.5 family answered
  // 404 despite being listed, the "-latest"/3.7/3.8 aliases answered 503, and
  // gemini-3.5-flash answered 200 but took up to 112s, so it can never finish
  // inside a per-attempt budget and only wastes a call. Latency matters as much as
  // availability for a fallback. Override with AI_FALLBACK_MODELS.
  return ['gemini-3.1-flash-lite'];
}

function modelName(name: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new AIUnavailableError('Invalid AI model configuration.');
  return name;
}

function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), max) : fallback;
}

/** Attempts for the configured model. 1 disables retries. */
export function aiAttempts(): number {
  return positiveInt(process.env.AI_REQUEST_ATTEMPTS, 3, 5);
}

/** Total wall-clock budget for RETRIES (the first attempt has its own timeout). */
function retryBudgetMs(): number {
  const n = Number(process.env.AI_RETRY_BUDGET_MS);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

/**
 * "Try again shortly" vs "this request is wrong".
 *
 * 429 = rate limit / quota, 5xx = provider-side overload. A transport failure
 * with no HTTP response at all is retried too — ENOTFOUND/EAI_AGAIN are the
 * Windows c-ares DNS flake this project works around elsewhere.
 */
export function isRetryableAiFailure(status?: number, code?: string): boolean {
  if (typeof status === 'number') return status === 429 || status >= 500;
  return [
    'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ECONNREFUSED',
    'EAI_AGAIN', 'ENOTFOUND', 'ERR_NETWORK',
  ].includes(String(code ?? ''));
}

/**
 * Whether a DIFFERENT model could plausibly succeed.
 *
 * Deliberately broader than "retryable": 404 means the model name is unknown or
 * unavailable to this key, so repeating the call is pointless but switching model
 * may work. That case is worth rescuing — a stale GEMINI_MODEL after a model is
 * renamed/deprecated is the single most common AI misconfiguration.
 *
 * A 400/401/403 is not here on purpose: the request body or the credentials are
 * the problem, and every other model would reject the same call.
 */
export function shouldTryAnotherModel(status?: number, code?: string): boolean {
  return isRetryableAiFailure(status, code) || status === 404;
}

/**
 * Exponential backoff with jitter, honouring an upstream Retry-After.
 *
 * Retry-After is capped by the retry budget: a provider asking for 60s would
 * otherwise leave the candidate staring at a frozen discussion room.
 */
export function aiBackoffMs(attempt: number, retryAfter?: string | number | null): number {
  const cap = retryBudgetMs();
  if (retryAfter != null && retryAfter !== '') {
    const asNumber = Number(retryAfter);
    const ms = Number.isFinite(asNumber)
      ? asNumber * 1000
      : Date.parse(String(retryAfter)) - Date.now();
    if (Number.isFinite(ms) && ms > 0) return Math.min(ms, cap);
  }
  const base = positiveInt(process.env.AI_RETRY_BASE_MS, 400, 10000) * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(base + Math.random() * 100, cap);
}

async function postModel(model: string, operation: string, body: unknown, timeout: number, key: string) {
  const { data } = await axios.post(`${GEMINI_API}/${modelName(model)}:${operation}`, body, {
    timeout,
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    maxContentLength: 2 * 1024 * 1024,
    maxRedirects: 0,
  });
  return data;
}

/**
 * Call the Generative Language API, retrying transient failures.
 *
 * Bounded on purpose: the first attempt keeps the caller's timeout, retries only
 * run while the retry budget lasts, and each retry's own timeout is clamped to
 * the remaining budget. Worst case is therefore (timeout + budget) — a caller
 * awaiting this inside an HTTP request can size its timeout accordingly.
 */
async function requestModel(
  model: string,
  operation: string,
  body: unknown,
  timeout: number,
  options: { fallbacks?: string[] } = {},
) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AIUnavailableError('AI service is not configured.');

  const attempts = aiAttempts();
  // AI_REQUEST_ATTEMPTS=1 is an explicit "one call, fail fast" switch, so it
  // disables fallback models as well as retries.
  const candidates = (attempts > 1 ? [model, ...(options.fallbacks ?? [])] : [model]).filter(
    (m, i, all) => all.indexOf(m) === i,
  );
  const budget = retryBudgetMs();
  const startedAt = Date.now();
  let lastStatus: number | undefined;
  let lastCode: string | undefined;
  let lastModel = model;
  let requestIsWrong = false;

  // The FIRST attempt keeps each caller's own timeout in full — a long generation
  // that asked for 45s must still get 45s. Only afterwards does the retry budget
  // take over, which is what bounds the total.
  let firstAttemptDone = false;

  for (const candidate of candidates) {
    // Every model gets the same attempt allowance; the budget (below) is what
    // stops the loop, so a capacity episode that affects several models is still
    // recoverable instead of failing after one shot each.
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const elapsed = Date.now() - startedAt;
      // Retries and fallback models must fit inside the budget; the very first
      // call is exempt so callers with long timeouts keep them.
      if (firstAttemptDone && elapsed >= budget) break;
      const attemptTimeout = firstAttemptDone
        ? Math.max(1000, Math.min(timeout, budget - elapsed))
        : timeout;
      firstAttemptDone = true;
      try {
        return await postModel(candidate, operation, body, attemptTimeout, key);
      } catch (error: any) {
        lastModel = candidate;
        lastStatus = error?.response?.status;
        lastCode = error?.code;
        // 400/401/403 means the request or the credentials are wrong: every model
        // would reject the same call, so stop instead of spending more quota.
        if (!shouldTryAnotherModel(lastStatus, lastCode)) {
          requestIsWrong = true;
          break;
        }
        // 404 (unknown/deprecated model) never repeats the SAME name — skip
        // straight to the next candidate model.
        if (isRetryableAiFailure(lastStatus, lastCode)) {
          const wait = aiBackoffMs(attempt, error?.response?.headers?.['retry-after']);
          const withinBudget = Date.now() - startedAt + wait < budget;
          if (attempt < attempts && withinBudget) {
            await new Promise((resolve) => setTimeout(resolve, wait));
            continue;
          }
        }
        break; // move on to the next candidate model, if there is one
      }
    }
    if (requestIsWrong) break;
    if (Date.now() - startedAt >= budget) break; // budget spent — stop trying models
  }

  // Never serialize Axios errors: their config includes the authorization key.
  logger.warn('ai.provider.failure', {
    operation,
    model: lastModel,
    status: lastStatus,
    code: lastCode,
    rateLimited: lastStatus === 429,
    overloaded: lastStatus === 503,
    modelNotFound: lastStatus === 404,
    modelsTried: candidates.length,
  });
  throw new AIUnavailableError(
    lastStatus === 429
      ? 'AI service is rate-limited right now. Please retry shortly.'
      : lastStatus === 404
        ? 'The configured AI model is not available. Check GEMINI_MODEL.'
        : 'AI service is unavailable. Please retry later.',
  );
}

export async function generateJson(prompt: string, timeout = 45000): Promise<unknown> {
  const data = await requestModel(generationModel(), 'generateContent', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
  }, timeout, { fallbacks: generationFallbackModels() });
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
  // Deliberately NO model fallbacks: vectors from a different embedding model are
  // not comparable, and silently mixing them would corrupt similarity search.
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
