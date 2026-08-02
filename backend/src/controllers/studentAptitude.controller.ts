import { Request, Response } from 'express';
import { Types } from 'mongoose';
import AptitudeTest from '../models/AptitudeTest';
import AptitudeQuestion from '../models/AptitudeQuestion';
import AptitudeAttempt, { ResponseStatus } from '../models/AptitudeAttempt';
import { buildQuestionSet } from '../services/questionSelector.service';
import { generateAIAnalysis } from '../services/aptitudeAI.service';

// ADAPT: replace with your actual authenticated-request type (req.user.userId from your JWT middleware)
interface AuthedRequest extends Request {
  user?: { userId: string };
}

/** GET /api/aptitude/tests — list published tests students can start */
export async function listPublishedTests(req: Request, res: Response) {
  const tests = await AptitudeTest.find({ isPublished: true }).select(
    'title roundType categories durationMinutes totalMarks difficultyPlan'
  );
  return res.json({ tests });
}

/** POST /api/aptitude/tests/:testId/start — creates a fresh randomized attempt */
export async function startAttempt(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const { testId } = req.params;

  const test = await AptitudeTest.findOne({ _id: testId, isPublished: true });
  if (!test) return res.status(404).json({ message: 'Test not found or not published.' });

  const existing = await AptitudeAttempt.findOne({ user: userId, test: testId, status: 'in-progress' });
  if (existing) return res.json({ attemptId: existing._id, resumed: true });

  let questionIds;
  try {
    questionIds = await buildQuestionSet(test, new Types.ObjectId(userId));
  } catch (err: any) {
    return res.status(422).json({ message: err.message });
  }

  const attempt = await AptitudeAttempt.create({
    user: userId,
    test: test._id,
    roundType: test.roundType,
    questions: questionIds,
    responses: questionIds.map((q) => ({ question: q, selectedOption: null, status: 'not-visited', timeSpentSeconds: 0 })),
    durationMinutes: test.durationMinutes,
    totalMarks: test.totalMarks,
  });

  return res.status(201).json({ attemptId: attempt._id, resumed: false });
}

/** GET /api/aptitude/attempts/:attemptId — question images + palette state, never the correct answer */
export async function getAttempt(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: userId }).populate({
    path: 'questions',
    select: 'imageUrl category difficulty marks',
  });
  if (!attempt) return res.status(404).json({ message: 'Attempt not found.' });

  const deadline = new Date(attempt.startedAt.getTime() + attempt.durationMinutes * 60000);

  return res.json({
    attemptId: attempt._id,
    status: attempt.status,
    deadline,
    questions: attempt.questions, // populated, image-only
    responses: attempt.responses.map((r) => ({
      question: r.question,
      selectedOption: r.selectedOption,
      status: r.status,
    })),
  });
}

/** POST /api/aptitude/attempts/:attemptId/response — auto-save a single answer / palette state */
export async function saveResponse(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const { attemptId } = req.params;
  const { questionId, selectedOption, markedForReview, timeSpentSeconds } = req.body as {
    questionId: string;
    selectedOption: 'A' | 'B' | 'C' | 'D' | null;
    markedForReview: boolean;
    timeSpentSeconds: number;
  };

  const attempt = await AptitudeAttempt.findOne({ _id: attemptId, user: userId, status: 'in-progress' });
  if (!attempt) return res.status(404).json({ message: 'Active attempt not found.' });

  if (isExpired(attempt)) {
    await finalizeSubmission(attempt, true);
    return res.status(409).json({ message: 'Time is up. This attempt was auto-submitted.', autoSubmitted: true });
  }

  const r = attempt.responses.find((resp) => resp.question.toString() === questionId);
  if (!r) return res.status(400).json({ message: 'Question not part of this attempt.' });

  r.selectedOption = selectedOption;
  r.timeSpentSeconds += timeSpentSeconds || 0;
  r.status = computeStatus(selectedOption, markedForReview);

  await attempt.save();
  return res.json({ saved: true });
}

/** POST /api/aptitude/attempts/:attemptId/submit — manual or auto submit */
export async function submitAttempt(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: userId, status: 'in-progress' });
  if (!attempt) return res.status(404).json({ message: 'Active attempt not found.' });

  const auto = isExpired(attempt) || !!req.body?.autoSubmitted;
  await finalizeSubmission(attempt, auto);
  return res.json({ submitted: true, autoSubmitted: auto, attemptId: attempt._id });
}

/** GET /api/aptitude/attempts/:attemptId/result — full review with correct answers + AI analysis */
export async function getResult(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: userId, status: 'completed' }).populate(
    'questions'
  );
  if (!attempt) return res.status(404).json({ message: 'Completed attempt not found.' });

  const questionMap = new Map((attempt.questions as any[]).map((q) => [q._id.toString(), q]));

  const review = attempt.responses.map((r) => {
    const q = questionMap.get(r.question.toString());
    return {
      questionImageUrl: q?.imageUrl,
      category: q?.category,
      difficulty: q?.difficulty,
      correctOption: q?.correctOption,
      explanation: q?.explanation,
      selectedOption: r.selectedOption,
      isCorrect: r.selectedOption === q?.correctOption,
      timeSpentSeconds: r.timeSpentSeconds,
    };
  });

  return res.json({
    attemptId: attempt._id,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    unansweredCount: attempt.unansweredCount,
    accuracyPercent: attempt.accuracyPercent,
    scorePercent: attempt.scorePercent,
    passStatus: attempt.passStatus,
    autoSubmitted: attempt.autoSubmitted,
    timeTakenSeconds: attempt.submittedAt
      ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
      : null,
    aiAnalysis: attempt.aiAnalysis,
    review,
  });
}

// ---- helpers ----

function isExpired(attempt: { startedAt: Date; durationMinutes: number }) {
  return Date.now() > attempt.startedAt.getTime() + attempt.durationMinutes * 60000;
}

function computeStatus(selectedOption: string | null, markedForReview: boolean): ResponseStatus {
  if (markedForReview) return selectedOption ? 'answered-marked-for-review' : 'marked-for-review';
  return selectedOption ? 'answered' : 'not-answered';
}

async function finalizeSubmission(attempt: InstanceType<typeof AptitudeAttempt>, auto: boolean) {
  const questions = await AptitudeQuestion.find({ _id: { $in: attempt.questions } }).select('correctOption marks');
  const qMap = new Map(questions.map((q) => [q._id.toString(), q]));

  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;

  for (const r of attempt.responses) {
    const q = qMap.get(r.question.toString());
    if (!q) continue;
    if (!r.selectedOption) {
      unanswered += 1;
      continue;
    }
    if (r.selectedOption === q.correctOption) {
      correct += 1;
      score += q.marks;
    } else {
      incorrect += 1;
    }
  }

  const attempted = correct + incorrect;
  attempt.score = score;
  attempt.correctCount = correct;
  attempt.incorrectCount = incorrect;
  attempt.unansweredCount = unanswered;
  attempt.accuracyPercent = attempted ? Math.round((correct / attempted) * 100) : 0;
  attempt.scorePercent = attempt.totalMarks ? Math.round((score / attempt.totalMarks) * 100) : 0;
  attempt.passStatus = attempt.scorePercent >= 40 ? 'pass' : 'fail'; // ADAPT: pull threshold from test config if you want it configurable
  attempt.autoSubmitted = auto;
  attempt.submittedAt = new Date();
  attempt.status = 'completed';

  await attempt.save();

  // AI analysis runs after save so a slow/failed Gemini call never blocks scoring.
  try {
    const fullQuestions = await AptitudeQuestion.find({ _id: { $in: attempt.questions } });
    attempt.aiAnalysis = await generateAIAnalysis(attempt, fullQuestions);
    await attempt.save();
  } catch (err) {
    // Swallow — result page still works with scores, just without AI commentary.
    console.error('Aptitude AI analysis failed:', err);
  }
}