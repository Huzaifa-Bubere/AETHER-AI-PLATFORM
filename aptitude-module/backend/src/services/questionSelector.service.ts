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
export async function buildQuestionSet(test: IAptitudeTest, userId: Types.ObjectId) {
  const pastAttempts = await AptitudeAttempt.find({ user: userId, test: test._id }).select('questions').lean();
  const seenIds = new Set(pastAttempts.flatMap((a) => a.questions.map((q) => q.toString())));

  const selected: Types.ObjectId[] = [];
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  for (const difficulty of difficulties) {
    const plan = test.difficultyPlan[difficulty];
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

    const shuffledUnseen = shuffle(unseen);
    const shuffledSeen = shuffle(seen);

    const chosen = [...shuffledUnseen, ...shuffledSeen].slice(0, plan.count).map((q) => q._id);

    if (chosen.length < plan.count) {
      throw new Error(
        `Not enough "${difficulty}" questions in category set for roundType "${test.roundType}". ` +
          `Needed ${plan.count}, only ${chosen.length} available. Add more questions in the admin panel.`
      );
    }

    selected.push(...chosen);
  }

  await AptitudeQuestion.updateMany({ _id: { $in: selected } }, { $inc: { timesUsed: 1 } });

  return shuffle(selected); // interleave difficulty order rather than block-by-block
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
