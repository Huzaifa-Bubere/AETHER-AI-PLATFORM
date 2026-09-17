/**
 * Career AI explanation service.
 *
 * HARD RULES (project requirement #60):
 *  - Gemini may explain WHY a skill matters, what it is, how to learn it.
 *  - Gemini may NOT invent market percentages, salaries, or trends.
 *    Any market numbers in prompts are quoted verbatim from stored snapshots,
 *    and the prompt forbids changing them.
 *  - Identical requests are served from ExplanationCache (never re-call Gemini).
 *  - AI being down must never break the page: callers get `null` and render
 *    the deterministic content instead.
 */
import { generateJson, AIUnavailableError } from '../../services/ai/provider';
import { ExplanationCache, type IExplanationCache } from '../models/UserSkillProfile';
import { createHash } from 'crypto';

interface ExplainSkillInput {
  skillName: string;
  skillType?: string;
  roleName?: string;
  /** Verbatim snapshot facts (already computed) — quoted to the model as immutable. */
  marketFact?: { frequency?: number; trend?: string; samplePostings?: number; period?: string; region?: string };
}

export interface SkillExplanation {
  explanation: string;
  analogy: string;
  example: string;
  interviewConcepts: string[];
  commonMistakes: string[];
  nextSteps: string[];
  cached: boolean;
}

function cacheKey(kind: string, input: unknown): string {
  return `${kind}:${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32)}`;
}

async function cached<T>(kind: IExplanationCache['kind'], input: unknown, produce: () => Promise<T>): Promise<T & { cached: boolean }> {
  const key = cacheKey(kind, input);
  const hit = await ExplanationCache.findOne({ cacheKey: key }).lean();
  if (hit) return { ...(hit.payload as T), cached: true };
  const value = await produce();
  await ExplanationCache.updateOne({ cacheKey: key }, { $set: { kind, payload: value } }, { upsert: true });
  return { ...value, cached: false };
}

function marketSentence(fact?: ExplainSkillInput['marketFact']): string {
  if (!fact || fact.frequency == null) return 'No market snapshot data is available for this skill.';
  const trendText: Record<string, string> = {
    TRENDING_UP: 'demand is increasing versus the previous period',
    TRENDING_DOWN: 'demand is decreasing versus the previous period',
    STABLE: 'demand is stable versus the previous period',
    NEW_SIGNAL: 'this is a newly appearing skill in the latest period',
    INSUFFICIENT_DATA: 'the sample is too small to judge a trend',
  };
  return [
    `VERIFIED MARKET FACTS (do not change, do not extrapolate): requested in ${fact.frequency}% of ${fact.samplePostings ?? 'the analyzed'} postings`,
    fact.region ? `region: ${fact.region}` : null,
    fact.period ? `period: ${fact.period}` : null,
    fact.trend ? `trend: ${trendText[fact.trend] || fact.trend}` : null,
  ].filter(Boolean).join('; ') + '.';
}

export const careerAI = {
  async explainSkill(input: ExplainSkillInput): Promise<SkillExplanation | null> {
    return cached<SkillExplanation>('SKILL', input, async () => {
      const prompt = `You are AETHER's career mentor explaining a skill to a placement-preparation student.
Skill: ${input.skillName}${input.skillType ? ` (type: ${input.skillType})` : ''}${input.roleName ? ` — in the context of becoming a ${input.roleName}` : ''}.
${marketSentence(input.marketFact)}

Return ONLY JSON with this shape:
{"explanation":"2-3 sentence simple explanation","analogy":"one real-world analogy","example":"one concrete usage example","interviewConcepts":["3-5 key interview concepts"],"commonMistakes":["2-4 common beginner mistakes"],"nextSteps":["2-3 concrete next learning steps"]}

Rules: If VERIFIED MARKET FACTS are present you may reference them EXACTLY as given but MUST NOT invent, adjust, or extrapolate any other statistics, percentages, or salary figures. Never claim something is trending unless the facts say so.`;
      try {
        const raw = await generateJson(prompt) as Record<string, unknown>;
        const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter(s => typeof s === 'string').slice(0, 6) : [];
        return {
          explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
          analogy: typeof raw.analogy === 'string' ? raw.analogy : '',
          example: typeof raw.example === 'string' ? raw.example : '',
          interviewConcepts: arr(raw.interviewConcepts),
          commonMistakes: arr(raw.commonMistakes),
          nextSteps: arr(raw.nextSteps),
          cached: false,
        };
      } catch (err) {
        if (err instanceof AIUnavailableError) return null; // caller renders deterministic fallback
        throw err;
      }
    });
  },

  async explainRecommendation(params: {
    skillName: string; roleName: string; priority: string; confidence: number;
    marketFrequency?: number; trend?: string; prereqReady: boolean; samplePostings?: number;
  }): Promise<{ summary: string; cached: boolean } | null> {
    return cached('RECOMMENDATION', params, async () => {
      const facts = params.marketFrequency != null
        ? `VERIFIED MARKET FACTS (immutable): ${params.marketFrequency}% of ${params.samplePostings ?? 'analyzed'} postings request ${params.skillName}; trend classification: ${params.trend || 'no data'}.`
        : 'No market snapshot data for this skill.';
      const prompt = `A placement student asked why AETHER recommends learning ${params.skillName} for the ${params.roleName} role.
Deterministic system facts: roadmap priority=${params.priority}; candidate evidence confidence=${params.confidence}/100; prerequisites ready=${params.prereqReady}.
${facts}
Write one warm, specific paragraph (max 90 words) explaining this recommendation using ONLY these facts. Do not invent any additional statistics, percentages or salary figures.
Return ONLY JSON: {"summary":"..."}`;
      try {
        const raw = await generateJson(prompt) as { summary?: string };
        return { summary: typeof raw.summary === 'string' ? raw.summary : '', cached: false };
      } catch (err) {
        if (err instanceof AIUnavailableError) return null;
        throw err;
      }
    });
  },

  async askAdvisor(params: {
    question: string; roleName?: string; readiness?: number;
    topGaps?: string[]; matchedSkills?: string[]; snapshotFact?: string;
  }): Promise<{ answer: string; cached: boolean } | null> {
    return cached('ADVISOR', params, async () => {
      const context = [
        params.roleName ? `Target role: ${params.roleName}.` : null,
        params.readiness != null ? `Deterministic readiness: ${params.readiness}%.` : null,
        params.matchedSkills?.length ? `Skills with verified evidence: ${params.matchedSkills.slice(0, 12).join(', ')}.` : null,
        params.topGaps?.length ? `Top skill gaps (priority order): ${params.topGaps.slice(0, 8).join(', ')}.` : null,
        params.snapshotFact ? `VERIFIED MARKET SNAPSHOT (immutable, cite period/region when mentioning it): ${params.snapshotFact}` : null,
      ].filter(Boolean).join('\n');
      const prompt = `You are AETHER's AI career advisor. Answer the student's question using the structured context below. Be concrete and encouraging (max 180 words). If market facts are provided you may cite them exactly; never invent statistics, percentages, or salaries. If the context is insufficient, say what info you need.
CONTEXT:
${context || '(no profile data yet)'}
QUESTION: ${params.question}
Return ONLY JSON: {"answer":"..."}`;
      try {
        const raw = await generateJson(prompt) as { answer?: string };
        return { answer: typeof raw.answer === 'string' ? raw.answer : '', cached: false };
      } catch (err) {
        if (err instanceof AIUnavailableError) return null;
        throw err;
      }
    });
  },
};
