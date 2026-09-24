import { ExplanationCache } from '../models/UserSkillProfile';

/**
 * AETHER Career Learning — lesson-grounded AI tutor (spec §48).
 *
 * RAG-style grounding: the prompt contains ONLY the actual lesson content from
 * the published course (the "approved source"). When Gemini is unavailable the
 * tutor degrades gracefully and the lesson text itself remains fully usable.
 *
 * Capabilities: explain simply, give an example, explain code, quiz me,
 * real-world use, compare concepts.
 */

export interface ITutorAnswer {
  answer: string;
  groundedIn: string;
  cached: boolean;
  aiAvailable: boolean;
}

interface ExplainParams {
  question: string;
  course: { title: string; slug: string };
  lesson: { title: string; content: string; codeExamples: Array<{ language: string; code: string; caption?: string }> } | null;
}

function cacheKey(params: ExplainParams): string {
  const lessonId = params.lesson?.title || 'course';
  return `LESSON:${params.course.slug}:${lessonId}:${params.question.toLowerCase().trim().slice(0, 160)}`;
}

function fallbackAnswer(params: ExplainParams): ITutorAnswer {
  const lessonTitle = params.lesson?.title || params.course.title;
  const excerpts = params.lesson
    ? params.lesson.content.replace(/[#*`]/g, '').split(/\n+/).filter(Boolean).slice(0, 4).join(' ')
    : '';
  return {
    answer: [
      `The AI tutor is unavailable right now. Here is the relevant lesson material for "${lessonTitle}":`,
      excerpts || 'Open the lesson below and use its linked official documentation.',
    ].join('\n\n'),
    groundedIn: params.lesson ? `Lesson: ${lessonTitle}` : `Course: ${params.course.title}`,
    cached: false,
    aiAvailable: false,
  };
}

export async function explainLessonConcept(params: ExplainParams): Promise<ITutorAnswer> {
  const key = cacheKey(params);

  // 1. Identical requests never re-call Gemini (deterministic cache).
  try {
    const hit = await ExplanationCache.findOne({ cacheKey: key }).lean();
    if (hit) {
      return { ...(hit.payload as any), cached: true };
    }
  } catch { /* cache optional */ }

  const fallback = fallbackAnswer(params);

  // 2. Gemini call, grounded strictly in lesson content.
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const key_ = process.env.GEMINI_API_KEY;
    if (!key_) return fallback;

    const model = new GoogleGenerativeAI(key_).getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });

    const grounding = params.lesson
      ? `LESSON TITLE: ${params.lesson.title}\nLESSON CONTENT:\n${params.lesson.content.slice(0, 6000)}\n\nCODE EXAMPLES:\n${params.lesson.codeExamples.map(c => `\`\`\`${c.language}\n${c.code}\n\`\`\``).join('\n\n').slice(0, 2500)}`
      : `COURSE: ${params.course.title}\n(No specific lesson selected — answer at course level.)`;

    const prompt = `You are AETHER's learning assistant inside the course "${params.course.title}".
Answer the learner's question using ONLY the lesson material below. If the material does not
cover the question, say so and suggest which official documentation to consult.
Be concise, concrete, and educational. Use short paragraphs or a small list.

${grounding}

LEARNER QUESTION: ${params.question}

Respond with plain text (markdown allowed).`;

    const result = await model.generateContent(prompt, { timeout: 25000 });
    const text = result.response.text();
    if (!text?.trim()) return fallback;

    const answer: ITutorAnswer = {
      answer: text.trim().slice(0, 4000),
      groundedIn: params.lesson ? `Lesson: ${params.lesson.title}` : `Course: ${params.course.title}`,
      cached: false,
      aiAvailable: true,
    };

    // Cache identical questions for 7 days (bounded growth via TTL-like overwrite).
    ExplanationCache.updateOne(
      { cacheKey: key },
      { $set: { kind: 'ROADMAP_NODE', payload: answer }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    ).catch(() => undefined);

    return answer;
  } catch {
    return fallback;
  }
}
