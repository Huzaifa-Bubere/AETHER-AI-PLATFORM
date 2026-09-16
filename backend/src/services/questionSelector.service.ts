import AptitudeQuestion, { Difficulty } from '../models/AptitudeQuestion';
import AptitudeAttempt from '../models/AptitudeAttempt';
import { IAptitudeTest } from '../models/AptitudeTest';
import { Types } from 'mongoose';
import { QuestionIdentity, similarQuestions, uniqueQuestions } from './questions/identity';
import { DIFFICULTIES } from './questions/difficulty';
import { usableQuestions } from './rag/cache';

/**
 * Builds the question set for a new attempt.
 *
 * Randomization strategy (matches the notes: "same user should rarely see the
 * same question again"):
 *  1. Look up every question this user has already seen for this roundType+category+difficulty
 *     across their past attempts.
 *  2. Prefer unseen questions first, in random order.
 *  3. Exclude recent questions by ID and snapshot content. Older questions can be
 *     reused only after the cooldown, with unseen questions preferred.
 *  4. `timesUsed` is incremented after the attempt is created so the admin dashboard can show
 *     which questions are overused and need more bank depth.
 */
export async function buildQuestionSet(test: IAptitudeTest, userId: Types.ObjectId) {
  const days = Number(process.env.QUESTION_REPEAT_COOLDOWN_DAYS || 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('QUESTION_REPEAT_COOLDOWN_DAYS must be between 1 and 365.');
  const cutoff = Date.now() - days * 86400000;
  const pastAttempts = await AptitudeAttempt.find({ user: userId }).select('questions questionSnapshots startedAt').lean();
  const seenIds = new Set(pastAttempts.flatMap((a) => a.questions.map((q) => q.toString())));
  const recent = pastAttempts.filter(a => !a.startedAt || new Date(a.startedAt).getTime() >= cutoff);
  const recentIds = new Set(recent.flatMap(a => a.questions.map(String)));
  const recentContent: QuestionIdentity[] = recent.flatMap(a => a.questionSnapshots || []);

  const selectedIds = new Set<string>();
  const selectedContent: QuestionIdentity[] = [];
  const difficulties: readonly Difficulty[] = DIFFICULTIES;

  // 1. First pass: try to satisfy each difficulty plan
  for (const difficulty of difficulties) {
    const plan = test.difficultyPlan?.[difficulty];
    if (!plan || plan.count === 0) continue;

    const pool = await usableQuestions(await AptitudeQuestion.find({
      roundType: test.roundType,
      category: { $in: test.categories },
      difficulty,
      status: 'active',
      $or: [{ 'generation.expiresAt': { $exists: false } }, { 'generation.expiresAt': { $gt: new Date() } }],
      ...(test.ragTopic ? { 'generation.topic': test.ragTopic } : {}),
    })
      .select('_id questionText imageUrl fingerprint generation')
      .lean());

    // Legacy attempts without snapshots still exclude copied questions if their
    // original IDs are present in this pool. Deleted legacy content is unrecoverable.
    const blocked = [...recentContent, ...pool.filter(q => recentIds.has(String(q._id))), ...selectedContent];
    const eligible = pool.filter(q => !recentIds.has(String(q._id)) && !blocked.some(old => similarQuestions(old, q)));
    const unseen = eligible.filter((q) => !seenIds.has(q._id.toString()));
    const seen = eligible.filter((q) => seenIds.has(q._id.toString()));

    const candidates = uniqueQuestions([...shuffle(unseen), ...shuffle(seen)]);
    if (candidates.length < plan.count) {
      throw Object.assign(new Error(`Insufficient ${difficulty} questions for this test: need ${plan.count}, found ${candidates.length} distinct questions outside your ${days}-day recent history. Please try another test or wait for new questions.`),
        { difficulty, missingCount: plan.count - candidates.length });
    }
    for (const q of candidates.slice(0, plan.count)) {
      selectedIds.add(q._id.toString());
      selectedContent.push(q);
    }
  }

  if (selectedIds.size === 0) throw new Error('The test must request at least one question.');

  const selectedObjectIds = Array.from(selectedIds).map((id) => new Types.ObjectId(id));

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

