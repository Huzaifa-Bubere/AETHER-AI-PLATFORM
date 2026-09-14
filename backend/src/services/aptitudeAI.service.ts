/**
 * ADAPT: reuse your existing Gemini client/config (the one already used for
 * interview question generation, per your report's `GEMINI_API_KEY` /
 * `GEMINI_MODEL` env vars) instead of re-instantiating it here.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAptitudeAttempt, IResponse } from '../models/AptitudeAttempt';
import { IAptitudeQuestion } from '../models/AptitudeQuestion';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

interface PerCategoryStat {
  category: string;
  correct: number;
  total: number;
}
interface PerDifficultyStat {
  difficulty: string;
  correct: number;
  total: number;
  avgTimeSeconds: number;
}

function summarize(responses: IResponse[], questions: IAptitudeQuestion[]) {
  const qMap = new Map(questions.map((q) => [q._id.toString(), q]));
  const byCategory = new Map<string, PerCategoryStat>();
  const byDifficulty = new Map<string, PerDifficultyStat>();
  let guessedFast = 0; // answered in < 5s -> possible guess

  for (const r of responses) {
    const q = qMap.get(r.question.toString());
    if (!q) continue;
    const isCorrect = r.selectedOption === q.correctOption;

    const c = byCategory.get(q.category) || { category: q.category, correct: 0, total: 0 };
    c.total += 1;
    if (isCorrect) c.correct += 1;
    byCategory.set(q.category, c);

    const d = byDifficulty.get(q.difficulty) || {
      difficulty: q.difficulty,
      correct: 0,
      total: 0,
      avgTimeSeconds: 0,
    };
    d.total += 1;
    if (isCorrect) d.correct += 1;
    d.avgTimeSeconds += r.timeSpentSeconds;
    byDifficulty.set(q.difficulty, d);

    if (r.selectedOption && r.timeSpentSeconds < 5) guessedFast += 1;
  }

  for (const d of byDifficulty.values()) {
    d.avgTimeSeconds = d.total ? Math.round(d.avgTimeSeconds / d.total) : 0;
  }

  return {
    byCategory: [...byCategory.values()],
    byDifficulty: [...byDifficulty.values()],
    guessedFast,
  };
}

export async function generateAIAnalysis(attempt: IAptitudeAttempt, questions: IAptitudeQuestion[]) {
  const stats = summarize(attempt.responses, questions);

  const prompt = `
You are an expert placement-training coach analyzing a student's aptitude test performance.
Respond with ONLY a JSON object (no markdown fences, no preamble) matching exactly this shape:

{
  "strongTopics": string[],
  "weakTopics": string[],
  "categoryPerformance": [{ "category": string, "accuracy": number }],
  "difficultyPerformance": [{ "difficulty": string, "accuracy": number }],
  "speedAnalysis": string,
  "timeManagement": string,
  "guessingBehaviorNote": string,
  "recommendedPracticeAreas": string[],
  "studyPlan": string[],
  "placementReadinessScore": number,
  "motivationalFeedback": string
}

Data:
- Round type: ${attempt.roundType}
- Total questions: ${attempt.questions.length}
- Correct: ${attempt.correctCount}, Incorrect: ${attempt.incorrectCount}, Unanswered: ${attempt.unansweredCount}
- Overall accuracy: ${attempt.accuracyPercent}%
- Score: ${attempt.score}/${attempt.totalMarks}
- Time taken: ${attempt.submittedAt ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000) : 0}s of ${attempt.durationMinutes * 60}s allowed
- Per-category breakdown: ${JSON.stringify(stats.byCategory)}
- Per-difficulty breakdown (with avg seconds spent): ${JSON.stringify(stats.byDifficulty)}
- Answers given in under 5 seconds (possible guesses): ${stats.guessedFast}

Guidance:
- accuracy values are 0-100 percentages, computed from the breakdown given.
- placementReadinessScore is 0-100, reflecting readiness for real placement aptitude rounds.
- Keep strings concise (1-2 sentences each), studyPlan and recommendedPracticeAreas as short bullet-style items (3-6 items each).
- Be specific to the categories/difficulties actually present in the data — do not invent topics not listed.
`.trim();

  const result = await model.generateContent(prompt, { timeout: 10000 });
  const text = result.response.text().trim();
  const jsonText = text.replace(/^```json\s*|```\s*$/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Fallback: deterministic analysis if Gemini returns malformed JSON,
    // so results are never blocked on the AI call.
    parsed = buildFallbackAnalysis(attempt, stats);
  }

  return { ...parsed, generatedAt: new Date() };
}

function buildFallbackAnalysis(attempt: IAptitudeAttempt, stats: ReturnType<typeof summarize>) {
  const categoryPerformance = stats.byCategory.map((c) => ({
    category: c.category,
    accuracy: c.total ? Math.round((c.correct / c.total) * 100) : 0,
  }));
  const difficultyPerformance = stats.byDifficulty.map((d) => ({
    difficulty: d.difficulty,
    accuracy: d.total ? Math.round((d.correct / d.total) * 100) : 0,
  }));
  const sorted = [...categoryPerformance].sort((a, b) => b.accuracy - a.accuracy);

  return {
    strongTopics: sorted.slice(0, 2).map((c) => c.category),
    weakTopics: sorted.slice(-2).map((c) => c.category),
    categoryPerformance,
    difficultyPerformance,
    speedAnalysis: 'Speed analysis unavailable — AI service did not return a valid response.',
    timeManagement: `Used ${attempt.submittedAt ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 60000) : 0} of ${attempt.durationMinutes} minutes.`,
    guessingBehaviorNote: stats.guessedFast > 0 ? `${stats.guessedFast} answers given in under 5 seconds.` : 'No fast-guessing pattern detected.',
    recommendedPracticeAreas: sorted.slice(-2).map((c) => c.category),
    studyPlan: ['Review incorrect questions in the weakest category.', 'Retake a timed test focused on that category.'],
    placementReadinessScore: attempt.scorePercent,
    motivationalFeedback: 'Keep practicing consistently — steady improvement beats cramming.',
  };
}
