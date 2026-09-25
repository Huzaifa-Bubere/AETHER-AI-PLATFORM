/**
 * AETHER Interview — AI transport used by the follow-up refiner.
 * Thin wrappers so the module has no hard dependency at import time
 * (graceful when Gemini is unavailable — heuristic decision always stands).
 */

export function callModel(prompt: string, timeoutMs = 20000): Promise<string | null> {
  let GoogleGenerativeAI: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
  } catch {
    return Promise.resolve(null);
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Promise.resolve(null);
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    });
    return Promise.race([
      model.generateContent(prompt, { timeout: timeoutMs }).then((r: any) => r.response.text()),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs + 2000)),
    ]).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

export function extractJson<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch { /* fall through */ } }
    return null;
  }
}
