import { Types } from 'mongoose';
import { IAptitudeTest } from '../../models/AptitudeTest';
import { buildQuestionSet } from '../questionSelector.service';
import { generateGroundedQuestions } from './generation';
import { isDifficulty } from '../questions/difficulty';

// Coalesce concurrent start requests in one process. The final attempt's unique
// active key and generated fingerprint index also protect persistence across workers.
const pending = new Map<string, Promise<Types.ObjectId[]>>();
export function prepareAssessment(test: IAptitudeTest, userId: Types.ObjectId): Promise<Types.ObjectId[]> {
  if (!test.ragTopic) return buildQuestionSet(test, userId);
  const key = `${test._id}:${userId}`;
  if (pending.has(key)) return pending.get(key)!;
  const work = (async () => {
    for (let pass = 0; pass < 4; pass++) {
      try { return await buildQuestionSet(test, userId); }
      catch (error: any) {
        if (!isDifficulty(error.difficulty) || !error.missingCount || pass === 3) throw error;
        await generateGroundedQuestions({ topic: test.ragTopic!, category: test.categories[0],
          roundType: test.roundType as 'aptitude' | 'technical', difficulty: error.difficulty,
          count: error.missingCount, userId: String(userId) });
      }
    }
    throw new Error('Assessment preparation failed.');
  })().finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}
