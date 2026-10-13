/**
 * AI provider resilience.
 *
 * WHY THIS EXISTS: the group discussion room failed with a console line that read
 * only `warn: ai.provider.failure`. The JSON file log revealed the cause was
 * upstream capacity — HTTP 429 (rate limit/quota) and 503 (overloaded) — on a
 * model and key that both work. The provider gave up on the first response of
 * that kind, so a transient provider hiccup was reported to the candidate as a
 * permanent outage.
 *
 * Locked here:
 *  - 429/5xx and transport failures are retried; a client error (4xx) is not,
 *    because retrying a malformed request just burns quota
 *  - a fallback model is used when the configured model stays unavailable
 *  - embeddings NEVER fall back: vectors from another model are not comparable,
 *    so mixing them would silently corrupt similarity search
 *  - retries stay inside a bounded budget so an awaiting HTTP request cannot hang
 */

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

const axios = require('axios').default;
const {
  generateJson,
  embedText,
  isRetryableAiFailure,
  shouldTryAnotherModel,
  aiAttempts,
  aiBackoffMs,
  generationFallbackModels,
  generationModel,
  AIUnavailableError,
} = require('../dist/services/ai/provider');

// Jest shares process.env across test files in the same worker, so anything set
// here is captured and restored — otherwise this file would silently retune the
// retry budget of every other suite that runs beside it.
const ENV_KEYS = [
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_REQUEST_ATTEMPTS',
  'AI_RETRY_BUDGET_MS', 'AI_RETRY_BASE_MS', 'AI_FALLBACK_MODELS',
];
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

process.env.GEMINI_API_KEY = 'test-key-not-real';
process.env.GEMINI_MODEL = 'gemini-3.6-flash';

function ok(body) {
  return { data: body };
}

/** A responses-shaped success for generateContent returning the given JSON text. */
function generateContentOk(text) {
  return ok({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
}

function httpError(status, headers = {}) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    response: { status, headers },
  });
}

const calledUrls = () => axios.post.mock.calls.map(([url]) => url);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AI_RETRY_BASE_MS = '1';
  process.env.AI_RETRY_BUDGET_MS = '2000';
  delete process.env.AI_REQUEST_ATTEMPTS;
  delete process.env.AI_FALLBACK_MODELS;
});

describe('failure classification', () => {
  test.each([
    [429, undefined, true],   // rate limited
    [500, undefined, true],
    [502, undefined, true],
    [503, undefined, true],   // overloaded — the status actually observed
    [504, undefined, true],
    [400, undefined, false],  // bad request: retrying cannot help
    [401, undefined, false],
    [403, undefined, false],
    [404, undefined, false],
  ])('status %s is retryable=%s', (status, code, expected) => {
    expect(isRetryableAiFailure(status, code)).toBe(expected);
  });

  test.each(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ERR_NETWORK'])(
    'transport failure %s is retryable',
    code => expect(isRetryableAiFailure(undefined, code)).toBe(true),
  );

  test('an unclassified error is not retried', () => {
    expect(isRetryableAiFailure(undefined, undefined)).toBe(false);
  });

  describe('shouldTryAnotherModel', () => {
    test('a 404 is worth another model even though it is not worth a retry', () => {
      // The model name is wrong; repeating it cannot help, but another model can.
      expect(isRetryableAiFailure(404)).toBe(false);
      expect(shouldTryAnotherModel(404)).toBe(true);
    });

    test('a 400 is not — the body would be rejected by every model', () => {
      expect(shouldTryAnotherModel(400)).toBe(false);
    });

    test('credentials and permission failures are not papered over by a model switch', () => {
      expect(shouldTryAnotherModel(401)).toBe(false);
      expect(shouldTryAnotherModel(403)).toBe(false);
    });

    test('transient failures may also switch model', () => {
      expect(shouldTryAnotherModel(429)).toBe(true);
      expect(shouldTryAnotherModel(503)).toBe(true);
      expect(shouldTryAnotherModel(undefined, 'ENOTFOUND')).toBe(true);
    });
  });
});

describe('backoff', () => {
  test('grows exponentially with the attempt number', () => {
    // Backoff carries jitter, so the comparison must be made with a base that
    // dwarfs the jitter — otherwise this asserts nothing (it was flaky: a large
    // jitter on attempt 1 could exceed a small one on attempt 2).
    process.env.AI_RETRY_BASE_MS = '400';
    const first = aiBackoffMs(1);
    const second = aiBackoffMs(2);
    const third = aiBackoffMs(3);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    // Doubling: 400-500, 800-900, 1600-1700.
    expect(first).toBeGreaterThanOrEqual(400);
    expect(first).toBeLessThan(500);
    expect(third).toBeGreaterThanOrEqual(1600);
  });

  test('is capped by the retry budget however high the attempt number climbs', () => {
    process.env.AI_RETRY_BASE_MS = '400';
    process.env.AI_RETRY_BUDGET_MS = '2000';
    expect(aiBackoffMs(10)).toBeLessThanOrEqual(2000);
  });

  test('honours Retry-After in seconds', () => {
    expect(aiBackoffMs(1, '1.5')).toBeGreaterThanOrEqual(1500);
    expect(aiBackoffMs(1, '1.5')).toBeLessThanOrEqual(2000);
  });

  test('caps an impatient Retry-After at the retry budget', () => {
    // 30s would freeze the discussion room; the cap keeps the request bounded.
    expect(aiBackoffMs(1, '30')).toBe(2000);
  });

  test('accepts an HTTP-date Retry-After', () => {
    const inOneSecond = new Date(Date.now() + 1000).toUTCString();
    const wait = aiBackoffMs(1, inOneSecond);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(2000);
  });
});

describe('generateContent retries', () => {
  test('a 429 followed by success resolves instead of failing', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce(generateContentOk('{"text":"a point"}'));
    await expect(generateJson('prompt')).resolves.toEqual({ text: 'a point' });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('a 503 burst recovers on the last attempt', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(generateContentOk('{"text":"recovered"}'));
    await expect(generateJson('prompt')).resolves.toEqual({ text: 'recovered' });
    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  test('a persistent 503 gives up after the configured attempts and reports unavailable', async () => {
    axios.post.mockRejectedValue(httpError(503));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);
    // Three attempts on the configured model, before any fallback is tried.
    expect(calledUrls().filter(u => u.includes(generationModel())).length).toBe(3);
    await expect(generateJson('prompt')).rejects.toThrow(/unavailable/i);
  });

  test('a persistent 429 reports a rate limit, not a generic outage', async () => {
    axios.post.mockRejectedValue(httpError(429));
    await expect(generateJson('prompt')).rejects.toThrow(/rate-limited/i);
  });

  test('a 400 fails immediately without burning retries', async () => {
    axios.post.mockRejectedValue(httpError(400));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('AI_REQUEST_ATTEMPTS=1 means exactly one call — no retries and no fallbacks', async () => {
    process.env.AI_REQUEST_ATTEMPTS = '1';
    axios.post.mockRejectedValue(httpError(503));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe('generateContent fallback models', () => {
  test('falls back to a stable model when the configured model stays overloaded', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(generateContentOk('{"text":"from fallback"}'));

    await expect(generateJson('prompt')).resolves.toEqual({ text: 'from fallback' });
    expect(calledUrls().slice(0, 3).every(u => u.includes('gemini-3.6-flash'))).toBe(true);
    expect(calledUrls()[3]).toContain(generationFallbackModels()[0]);
  });

  test('every candidate model gets the same attempt allowance, still bounded by the budget', async () => {
    axios.post.mockRejectedValue(httpError(503));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);

    // Policy changed after a LIVE run: the fallback model returned 503 as well, so
    // giving fallbacks a single shot meant one capacity episode defeated the whole
    // fallback mechanism. Each model now gets the same allowance.
    const urls = calledUrls();
    expect(urls.filter(u => u.includes(generationModel())).length).toBeGreaterThan(0);
    for (const fallback of generationFallbackModels()) {
      expect(urls.filter(u => u.includes(fallback)).length).toBeGreaterThan(0);
    }
    // The shared budget is what stops it — the request can never run away.
    expect(urls.length).toBeLessThanOrEqual(aiAttempts() * (1 + generationFallbackModels().length));
  });

  test('AI_FALLBACK_MODELS="" disables fallbacks', async () => {
    process.env.AI_FALLBACK_MODELS = '';
    axios.post.mockRejectedValue(httpError(503));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);
    expect(calledUrls().every(u => u.includes(generationModel()))).toBe(true);
  });

  test('a client error does not trigger a fallback model', async () => {
    axios.post.mockRejectedValue(httpError(400));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);
    expect(calledUrls().every(u => u.includes(generationModel()))).toBe(true);
  });

  test('an unknown/deprecated model name is rescued by a fallback', async () => {
    // A stale GEMINI_MODEL after a rename returns 404. Repeating it is pointless,
    // so exactly one call per model name and the fallback serves the request.
    axios.post
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce(generateContentOk('{"text":"rescued"}'));

    await expect(generateJson('prompt')).resolves.toEqual({ text: 'rescued' });
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(calledUrls()[0]).toContain(generationModel());
    expect(calledUrls()[1]).toContain(generationFallbackModels()[0]);
  });

  test('a 404 on every model reports the model configuration, not an outage', async () => {
    axios.post.mockRejectedValue(httpError(404));
    await expect(generateJson('prompt')).rejects.toThrow(/GEMINI_MODEL/);
    // One call per candidate model — never a retry of a name that does not exist.
    expect(axios.post).toHaveBeenCalledTimes(1 + generationFallbackModels().length);
  });

  test('a credential failure is not hidden behind a model switch', async () => {
    axios.post.mockRejectedValue(httpError(403));
    await expect(generateJson('prompt')).rejects.toBeInstanceOf(AIUnavailableError);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe('embeddings never switch model', () => {
  test('a rate-limited embedding is retried on the same model and never on a generation model', async () => {
    axios.post.mockRejectedValue(httpError(429));
    await expect(
      embedText('some text', 'RETRIEVAL_DOCUMENT'),
    ).rejects.toBeInstanceOf(AIUnavailableError);

    const urls = calledUrls();
    expect(urls.length).toBeGreaterThan(0);
    // Mixing embedding models would make stored vectors incomparable.
    expect(urls.every(u => u.includes('gemini-embedding-001'))).toBe(true);
    expect(urls.some(u => generationFallbackModels().some(f => u.includes(f)))).toBe(false);
  });
});

describe('response validation is unchanged', () => {
  test('an incomplete candidate is still an error', async () => {
    axios.post.mockResolvedValue(ok({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }));
    await expect(generateJson('prompt')).rejects.toThrow(/incomplete/i);
  });

  test('non-JSON output is still an error', async () => {
    axios.post.mockResolvedValue(generateContentOk('not json at all'));
    await expect(generateJson('prompt')).rejects.toThrow(/invalid response/i);
  });

  test('a valid JSON response is parsed', async () => {
    axios.post.mockResolvedValue(generateContentOk('{"text":"hello"}'));
    await expect(generateJson('prompt')).resolves.toEqual({ text: 'hello' });
  });

  test('a missing API key fails fast without a network call', async () => {
    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await expect(generateJson('prompt')).rejects.toThrow(/not configured/i);
    expect(axios.post).not.toHaveBeenCalled();
    process.env.GEMINI_API_KEY = key;
  });
});
