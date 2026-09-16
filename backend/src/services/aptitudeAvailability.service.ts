import Question from '../models/AptitudeQuestion';
import { IAptitudeTest } from '../models/AptitudeTest';
import { invalidInput } from '../middleware/aptitudeValidation';
import { uniqueQuestions } from './questions/identity';
import RagSource from '../models/RagSource';
import { embeddingModel } from './ai/provider';
import { usableQuestions } from './rag/cache';

export async function testAvailability(test: IAptitudeTest) {
  if (test.ragTopic) {
    const source = await RagSource.exists({ topic: test.ragTopic, enabled: true, revision: { $exists: true }, embeddingModel: embeddingModel() });
    const ready = !!source && !!process.env.GEMINI_API_KEY;
    return { ready, levels: [], issues: ready ? [] : ['Ingest a source for the selected topic and configure AI generation.'], mode: 'rag' };
  }
  const levels = await Promise.all((['easy', 'medium', 'hard'] as const).map(async difficulty => ({
    difficulty, required: test.difficultyPlan[difficulty].count,
    available: uniqueQuestions(await usableQuestions(await Question.find({ roundType: test.roundType, category: { $in: test.categories }, difficulty, status: 'active',
      $or: [{ 'generation.expiresAt': { $exists: false } }, { 'generation.expiresAt': { $gt: new Date() } }] })
      .select('_id questionText imageUrl fingerprint generation').lean())).length,
  })));
  const issues = levels.filter(level => level.available < level.required)
    .map(level => `${level.difficulty}: need ${level.required}, available ${level.available}`);
  return { ready: issues.length === 0, levels, issues };
}

export async function requireAvailableQuestions(test: IAptitudeTest) {
  const availability = await testAvailability(test);
  if (!availability.ready) invalidInput(`Add active questions before publishing (${availability.issues.join('; ')}).`, 422);
}
