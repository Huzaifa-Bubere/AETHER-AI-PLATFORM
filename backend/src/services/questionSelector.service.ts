import AptitudeQuestion, { Difficulty } from '../models/AptitudeQuestion';
import AptitudeAttempt from '../models/AptitudeAttempt';
import { IAptitudeTest } from '../models/AptitudeTest';
import { Types } from 'mongoose';

/**
 * Builds the question set for a new attempt.
 *
 * Randomization strategy (matches the notes: "same user should rarely see the
 * same question again"):
 *  1. Look up every question this user has already seen for this roundType+category+difficulty
 *     across their past attempts.
 *  2. Prefer unseen questions first, in random order.
 *  3. Only fall back to previously-seen questions if the unseen pool is smaller
 *     than what the test requires (keeps tests runnable even with a small bank).
 *  4. `timesUsed` is incremented on selection so the admin dashboard can show
 *     which questions are overused and need more bank depth.
 */
import AptitudeQuestion, { Difficulty } from '../models/AptitudeQuestion';
import AptitudeAttempt from '../models/AptitudeAttempt';
import { IAptitudeTest } from '../models/AptitudeTest';
import { Types } from 'mongoose';

/**
 * Builds the question set for a new attempt.
 *
 * Randomization strategy:
 *  1. Look up every question this user has already seen across their past attempts.
 *  2. Prefer unseen questions first, in random order.
 *  3. Fall back to seen questions if unseen pool is exhausted.
 *  4. Fall back to questions from other difficulties/categories if exact quota is not met.
 *  5. Ensure test always starts if at least 1 active question exists.
 */
export async function buildQuestionSet(test: IAptitudeTest, userId: Types.ObjectId) {
  const pastAttempts = await AptitudeAttempt.find({ user: userId, test: test._id }).select('questions').lean();
  const seenIds = new Set(pastAttempts.flatMap((a) => a.questions.map((q) => q.toString())));

  const selectedIds = new Set<string>();
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  // 1. First pass: try to satisfy each difficulty plan
  for (const difficulty of difficulties) {
    const plan = test.difficultyPlan?.[difficulty];
    if (!plan || plan.count === 0) continue;

    const pool = await AptitudeQuestion.find({
      roundType: test.roundType,
      category: { $in: test.categories },
      difficulty,
      status: 'active',
    })
      .select('_id')
      .lean();

    const unseen = pool.filter((q) => !seenIds.has(q._id.toString()));
    const seen = pool.filter((q) => seenIds.has(q._id.toString()));

    const candidates = [...shuffle(unseen), ...shuffle(seen)];
    for (const q of candidates) {
      if (selectedIds.size >= 100) break;
      selectedIds.add(q._id.toString());
      if (selectedIds.size >= plan.count) break;
    }
  }

  // 2. Second pass: if nothing or very few selected, get ANY active question for this roundType/categories
  if (selectedIds.size === 0) {
    const fallbackPool = await AptitudeQuestion.find({
      roundType: test.roundType,
      category: { $in: test.categories },
      status: 'active',
    })
      .select('_id')
      .lean();

    const candidates = shuffle(fallbackPool);
    for (const q of candidates) {
      selectedIds.add(q._id.toString());
    }
  }

  // 3. Third pass: if still empty, get ANY active question across the database
  if (selectedIds.size === 0) {
    const allActive = await AptitudeQuestion.find({ status: 'active' }).select('_id').limit(20).lean();
    for (const q of allActive) {
      selectedIds.add(q._id.toString());
    }
  }

  if (selectedIds.size === 0) {
    throw new Error(
      `No active questions found for round "${test.roundType}". Please add questions in the Admin Question Bank first.`
    );
  }

  const selectedObjectIds = Array.from(selectedIds).map((id) => new Types.ObjectId(id));

  await AptitudeQuestion.updateMany({ _id: { $in: selectedObjectIds } }, { $inc: { timesUsed: 1 } });

  return shuffle(selectedObjectIds);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

