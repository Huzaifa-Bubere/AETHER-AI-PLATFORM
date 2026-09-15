import { Request, Response } from 'express';
import { Types } from 'mongoose';
import AptitudeTest from '../models/AptitudeTest';
import AptitudeQuestion from '../models/AptitudeQuestion';
import AptitudeAttempt, { ResponseStatus } from '../models/AptitudeAttempt';
import { testAvailability } from '../services/aptitudeAvailability.service';
import { prepareAssessment } from '../services/rag/assessment';
import { generateAIAnalysis, performanceAnalysis } from '../services/aptitudeAI.service';
import { fingerprintQuestion } from '../services/questions/identity';

type Attempt = InstanceType<typeof AptitudeAttempt>;

export async function listPublishedTests(_req: Request, res: Response): Promise<void> {
  const tests = await AptitudeTest.find({ isPublished: true }).select('title roundType categories durationMinutes totalMarks difficultyPlan ragTopic');
  res.json({ tests: await Promise.all(tests.map(async test => ({ ...test.toObject(), availability: await testAvailability(test) }))) });
}

export async function startAttempt(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const existing = await AptitudeAttempt.findOne({ user: userId, test: req.params.testId, status: 'in-progress' });
  if (existing) {
    if (isExpired(existing)) await finalizeSubmission(existing, true);
    res.json({ attemptId: existing._id, resumed: true });
    return;
  }
  const test = await AptitudeTest.findOne({ _id: req.params.testId, isPublished: true });
  if (!test) { res.status(404).json({ message: 'Test not found or not published.' }); return; }
  let ids;
  try { ids = await prepareAssessment(test, new Types.ObjectId(userId)); }
  catch (error: any) { res.status(error.statusCode || 422).json({ message: error.message }); return; }
  const questions = await AptitudeQuestion.find({ _id: { $in: ids } }).lean();
  const byId = new Map(questions.map(q => [q._id.toString(), q]));
  const snapshots = ids.map(id => {
    const q = byId.get(id.toString());
    if (!q) throw new Error('Question bank changed while starting the test. Please retry.');
    return {
      questionId: id, fingerprint: fingerprintQuestion(q), questionText: q.questionText, imageUrl: q.imageUrl, options: q.options,
      category: q.category, difficulty: q.difficulty, correctOption: q.correctOption,
      explanation: q.explanation, marks: test.difficultyPlan[q.difficulty].marksPerQuestion,
    };
  });
  // Await index readiness so even two first requests cannot create parallel attempts.
  await AptitudeAttempt.init();
  let attempt;
  try { attempt = await AptitudeAttempt.create({
    activeKey: `${userId}:${test._id}`, testTitle: test.title,
    user: userId, test: test._id, roundType: test.roundType, questions: ids,
    questionSnapshots: snapshots,
    responses: ids.map(question => ({ question, selectedOption: null, status: 'not-visited', timeSpentSeconds: 0 })),
    durationMinutes: test.durationMinutes, totalMarks: snapshots.reduce((total, q) => total + q.marks, 0),
  }); } catch (error: any) {
    if (error.code !== 11000) throw error;
    const winner = await AptitudeAttempt.findOne({ activeKey: `${userId}:${test._id}` });
    if (!winner) throw error;
    res.json({ attemptId: winner._id, resumed: true }); return;
  }
  await AptitudeQuestion.updateMany({ _id: { $in: ids } }, { $inc: { timesUsed: 1 } });
  res.status(201).json({ attemptId: attempt._id, resumed: false });
}

export async function listAttempts(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const filter = { user: req.user!.userId };
  const [attempts, total] = await Promise.all([
    AptitudeAttempt.find(filter).sort({ startedAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20),
    AptitudeAttempt.countDocuments(filter),
  ]);
  for (const attempt of attempts) if (attempt.status === 'in-progress' && isExpired(attempt)) await finalizeSubmission(attempt, true);
  res.json({ attempts: attempts.map(a => ({ attemptId: a._id, testId: a.test, title: a.testTitle || 'Aptitude test',
    status: a.status, startedAt: a.startedAt, score: a.score, totalMarks: a.totalMarks, scorePercent: a.scorePercent })),
    page, pages: Math.max(1, Math.ceil(total / 20)) });
}

async function attemptQuestions(attempt: Attempt): Promise<any[]> {
  if (attempt.questionSnapshots?.length) {
    return attempt.questionSnapshots.map(q => ({
      _id: q.questionId, questionText: q.questionText, imageUrl: q.imageUrl, options: q.options,
      category: q.category, difficulty: q.difficulty, correctOption: q.correctOption,
      explanation: q.explanation, marks: q.marks,
    }));
  }
  // Legacy attempts predate snapshots. Preserve their available question records.
  const questions = await AptitudeQuestion.find({ _id: { $in: attempt.questions } }).lean();
  const byId = new Map(questions.map(q => [q._id.toString(), q]));
  return attempt.questions.map(id => byId.get(id.toString())).filter(Boolean);
}

export async function getAttempt(req: Request, res: Response): Promise<void> {
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: req.user!.userId });
  if (!attempt) { res.status(404).json({ message: 'Attempt not found.' }); return; }
  if (attempt.status === 'in-progress' && isExpired(attempt)) await finalizeSubmission(attempt, true);
  const questions = await attemptQuestions(attempt);
  res.json({
    attemptId: attempt._id, status: attempt.status, serverTime: new Date(),
    deadline: new Date(attempt.startedAt.getTime() + attempt.durationMinutes * 60000),
    // Explicit allow-list: correct answers and explanations never reach an active exam.
    questions: questions.map(q => ({ _id: q._id, questionText: q.questionText, imageUrl: q.imageUrl,
      options: q.options, category: q.category, difficulty: q.difficulty, marks: q.marks })),
    responses: attempt.responses,
  });
}

function validResponse(data: any): boolean {
  return data && typeof data.questionId === 'string' &&
    [null, 'A', 'B', 'C', 'D'].includes(data.selectedOption) &&
    typeof data.markedForReview === 'boolean' && (data.visited === undefined || typeof data.visited === 'boolean') && Number.isFinite(data.timeSpentSeconds) &&
    data.timeSpentSeconds >= 0 && data.timeSpentSeconds <= 86400;
}
function responseStatus(selectedOption: string | null, marked: boolean): ResponseStatus {
  return marked ? (selectedOption ? 'answered-marked-for-review' : 'marked-for-review') : (selectedOption ? 'answered' : 'not-answered');
}

export async function saveResponse(req: Request, res: Response): Promise<void> {
  if (!validResponse(req.body)) { res.status(400).json({ message: 'Invalid answer or time spent.' }); return; }
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: req.user!.userId });
  if (!attempt) { res.status(404).json({ message: 'Attempt not found.' }); return; }
  if (attempt.status === 'completed' || isExpired(attempt)) {
    if (attempt.status !== 'completed') await finalizeSubmission(attempt, true);
    res.status(409).json({ message: 'This attempt has been submitted.', submitted: true, autoSubmitted: attempt.autoSubmitted });
    return;
  }
  const data = req.body;
  const updated = await AptitudeAttempt.updateOne({ _id: attempt._id, status: 'in-progress', 'responses.question': data.questionId }, {
    $set: { 'responses.$.selectedOption': data.selectedOption, 'responses.$.status': responseStatus(data.selectedOption, data.markedForReview) },
    $max: { 'responses.$.timeSpentSeconds': Math.min(data.timeSpentSeconds, attempt.durationMinutes * 60) },
    $inc: { __v: 1 },
  });
  if (!updated.matchedCount) { res.status(409).json({ message: 'Question unavailable or attempt already submitted.' }); return; }
  res.json({ saved: true });
}

export async function submitAttempt(req: Request, res: Response): Promise<void> {
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: req.user!.userId });
  if (!attempt) { res.status(404).json({ message: 'Attempt not found.' }); return; }
  if (attempt.status !== 'completed') {
    const pending = req.body?.responses;
    if (pending !== undefined && (!Array.isArray(pending) || pending.length > attempt.responses.length || pending.some(r => !validResponse(r)))) {
      res.status(400).json({ message: 'Invalid answers.' }); return;
    }
    if (pending && new Set(pending.map(r => r.questionId)).size !== pending.length) {
      res.status(400).json({ message: 'Duplicate question responses are not allowed.' }); return;
    }
    if (pending?.some(r => !attempt.responses.some(existing => existing.question.toString() === r.questionId))) {
      res.status(400).json({ message: 'Question not part of this attempt.' }); return;
    }
    await finalizeSubmission(attempt, !!req.body?.autoSubmitted, pending);
  }
  res.json({ submitted: true, autoSubmitted: attempt.autoSubmitted, attemptId: attempt._id });
}

export async function getResult(req: Request, res: Response): Promise<void> {
  const attempt = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: req.user!.userId });
  if (!attempt) { res.status(404).json({ message: 'Attempt not found.' }); return; }
  if (attempt.status === 'in-progress' && isExpired(attempt)) await finalizeSubmission(attempt, true);
  if (attempt.status !== 'completed') { res.status(409).json({ message: 'The test is still in progress.' }); return; }
  const questions = await attemptQuestions(attempt);
  const byId = new Map(questions.map(q => [q._id.toString(), q]));
  const review = attempt.responses.map(r => {
    const q = byId.get(r.question.toString());
    return { questionImageUrl: q?.imageUrl, questionText: q?.questionText, options: q?.options,
      category: q?.category || 'unavailable', difficulty: q?.difficulty || '', correctOption: q?.correctOption,
      explanation: q?.explanation, marks: q?.marks, selectedOption: r.selectedOption,
      isCorrect: !!q && !!r.selectedOption && r.selectedOption === q.correctOption, timeSpentSeconds: r.timeSpentSeconds };
  });
  res.json({ attemptId: attempt._id, score: attempt.score, totalMarks: attempt.totalMarks,
    correctCount: attempt.correctCount, incorrectCount: attempt.incorrectCount, unansweredCount: attempt.unansweredCount,
    accuracyPercent: attempt.accuracyPercent, scorePercent: attempt.scorePercent, passStatus: attempt.passStatus,
    autoSubmitted: attempt.autoSubmitted, aiAnalysis: attempt.aiAnalysis || performanceAnalysis(attempt, questions), review,
    timeTakenSeconds: attempt.submittedAt ? Math.min(attempt.durationMinutes * 60, Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)) : null });
}

function isExpired(attempt: Attempt) {
  return Date.now() >= attempt.startedAt.getTime() + attempt.durationMinutes * 60000;
}

export function gradeResponses(responses: Attempt['responses'], questions: any[]) {
  const byId = new Map(questions.map(q => [q._id.toString(), q]));
  let score = 0, correctCount = 0, incorrectCount = 0, unansweredCount = 0;
  for (const r of responses) {
    const q = byId.get(r.question.toString());
    if (!r.selectedOption || !q) { unansweredCount++; continue; }
    if (r.selectedOption === q.correctOption) { correctCount++; score += q.marks; }
    else incorrectCount++;
  }
  const totalMarks = questions.reduce((total, q) => total + q.marks, 0);
  const attempted = correctCount + incorrectCount;
  const scorePercent = totalMarks ? Math.round(score / totalMarks * 10000) / 100 : 0;
  return { score, totalMarks, correctCount, incorrectCount, unansweredCount, scorePercent,
    accuracyPercent: attempted ? Math.round(correctCount / attempted * 100) : 0,
    passStatus: totalMarks > 0 && score / totalMarks >= 0.4 ? 'pass' : 'fail' };
}

async function finalizeSubmission(original: Attempt, auto: boolean, pending?: any[]) {
  let attempt = original;
  for (let retry = 0; retry < 5; retry++) {
    if (attempt.status === 'completed') { Object.assign(original, attempt.toObject()); return; }
    const expired = isExpired(attempt);
    if (!expired && pending) {
      for (const data of pending) {
        const r = attempt.responses.find(existing => existing.question.toString() === data.questionId)!;
        r.selectedOption = data.selectedOption;
        r.status = data.visited === false && !data.selectedOption && !data.markedForReview ? 'not-visited' : responseStatus(data.selectedOption, data.markedForReview);
        r.timeSpentSeconds = Math.min(attempt.durationMinutes * 60, Math.max(r.timeSpentSeconds, data.timeSpentSeconds));
      }
    }
    const questions = await attemptQuestions(attempt);
    const updated = await AptitudeAttempt.findOneAndUpdate({ _id: attempt._id, status: 'in-progress', __v: attempt.__v ?? 0 }, {
      $set: { ...gradeResponses(attempt.responses, questions), responses: attempt.responses, status: 'completed', autoSubmitted: auto || expired,
        submittedAt: new Date(Math.min(Date.now(), attempt.startedAt.getTime() + attempt.durationMinutes * 60000)) },
      $inc: { __v: 1 }, $unset: { activeKey: 1 },
    }, { new: true });
    if (updated) {
      Object.assign(original, updated.toObject());
      if (process.env.GEMINI_API_KEY) {
        void generateAIAnalysis(updated, questions).then(aiAnalysis => AptitudeAttempt.updateOne({ _id: updated._id }, { $set: { aiAnalysis } }))
          .catch(() => { /* Scores remain available when optional commentary fails. */ });
      }
      return;
    }
    const latest = await AptitudeAttempt.findById(attempt._id);
    if (!latest) throw new Error('Attempt no longer exists.');
    attempt = latest;
  }
  throw new Error('Answers are still being saved. Please retry submission.');
}
