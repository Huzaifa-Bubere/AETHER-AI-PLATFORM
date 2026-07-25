import { Request, Response } from 'express';
import AptitudeQuestion from '../models/AptitudeQuestion';
import AptitudeTest from '../models/AptitudeTest';
import AptitudeAttempt from '../models/AptitudeAttempt';
import { uploadQuestionImage, deleteQuestionImage } from '../utils/aptitudeImageUpload';

interface AuthedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

// ---------- Questions ----------

/** POST /api/admin/aptitude/questions (multipart: image + fields) */
export async function createQuestion(req: AuthedRequest, res: Response) {
  if (!req.file) return res.status(400).json({ message: 'Question image is required.' });
  const { roundType, category, difficulty, correctOption, marks, explanation } = req.body;

  const { url, publicId } = await uploadQuestionImage(req.file.buffer);

  const question = await AptitudeQuestion.create({
    roundType,
    category,
    difficulty,
    correctOption,
    marks: Number(marks) || 1,
    explanation: explanation || '',
    imageUrl: url,
    imagePublicId: publicId,
    createdBy: req.user!.id,
  });

  res.status(201).json({ question });
}

/**
 * POST /api/admin/aptitude/questions/bulk (multipart: multiple images under `images`,
 * plus a JSON `meta` field: array of {roundType, category, difficulty, correctOption, marks, explanation}
 * in the SAME ORDER as the uploaded images.)
 */
export async function bulkCreateQuestions(req: AuthedRequest, res: Response) {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return res.status(400).json({ message: 'At least one image is required.' });

  let meta: any[];
  try {
    meta = JSON.parse(req.body.meta);
  } catch {
    return res.status(400).json({ message: '`meta` must be valid JSON array matching image order.' });
  }
  if (meta.length !== files.length) {
    return res.status(400).json({ message: `Got ${files.length} images but ${meta.length} meta entries — they must match 1:1.` });
  }

  const created = [];
  const failed: { index: number; error: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    try {
      const { url, publicId } = await uploadQuestionImage(files[i].buffer);
      const m = meta[i];
      const question = await AptitudeQuestion.create({
        roundType: m.roundType,
        category: m.category,
        difficulty: m.difficulty,
        correctOption: m.correctOption,
        marks: Number(m.marks) || 1,
        explanation: m.explanation || '',
        imageUrl: url,
        imagePublicId: publicId,
        createdBy: req.user!.id,
      });
      created.push(question);
    } catch (err: any) {
      failed.push({ index: i, error: err.message });
    }
  }

  res.status(207).json({ createdCount: created.length, failedCount: failed.length, created, failed });
}

/** GET /api/admin/aptitude/questions?roundType=&category=&difficulty=&status=&page=&limit= */
export async function listQuestions(req: Request, res: Response) {
  const { roundType, category, difficulty, status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const filter: Record<string, any> = {};
  if (roundType) filter.roundType = roundType;
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (status) filter.status = status;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [questions, total] = await Promise.all([
    AptitudeQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    AptitudeQuestion.countDocuments(filter),
  ]);

  res.json({ questions, total, page: pageNum, pages: Math.ceil(total / limitNum) });
}

/** PUT /api/admin/aptitude/questions/:id (metadata only — send image separately if replacing it) */
export async function updateQuestion(req: AuthedRequest, res: Response) {
  const { category, difficulty, correctOption, marks, explanation, roundType } = req.body;
  const question = await AptitudeQuestion.findById(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found.' });

  if (req.file) {
    const { url, publicId } = await uploadQuestionImage(req.file.buffer);
    await deleteQuestionImage(question.imagePublicId).catch(() => {});
    question.imageUrl = url;
    question.imagePublicId = publicId;
  }

  if (roundType) question.roundType = roundType;
  if (category) question.category = category;
  if (difficulty) question.difficulty = difficulty;
  if (correctOption) question.correctOption = correctOption;
  if (marks !== undefined) question.marks = Number(marks);
  if (explanation !== undefined) question.explanation = explanation;

  await question.save();
  res.json({ question });
}

/** PATCH /api/admin/aptitude/questions/:id/status  { status: 'active' | 'inactive' } */
export async function toggleQuestionStatus(req: Request, res: Response) {
  const question = await AptitudeQuestion.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!question) return res.status(404).json({ message: 'Question not found.' });
  res.json({ question });
}

/** DELETE /api/admin/aptitude/questions/:id */
export async function deleteQuestion(req: Request, res: Response) {
  const question = await AptitudeQuestion.findById(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found.' });
  await deleteQuestionImage(question.imagePublicId).catch(() => {});
  await question.deleteOne();
  res.json({ deleted: true });
}

// ---------- Tests ----------

/** POST /api/admin/aptitude/tests */
export async function createTest(req: AuthedRequest, res: Response) {
  const test = await AptitudeTest.create({ ...req.body, createdBy: req.user!.id });
  res.status(201).json({ test });
}

/** PUT /api/admin/aptitude/tests/:id */
export async function updateTest(req: Request, res: Response) {
  const test = await AptitudeTest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  res.json({ test });
}

/** PATCH /api/admin/aptitude/tests/:id/publish  { isPublished: boolean } */
export async function togglePublishTest(req: Request, res: Response) {
  const test = await AptitudeTest.findByIdAndUpdate(req.params.id, { isPublished: req.body.isPublished }, { new: true });
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  res.json({ test });
}

/** GET /api/admin/aptitude/tests */
export async function listTests(_req: Request, res: Response) {
  const tests = await AptitudeTest.find().sort({ createdAt: -1 });
  res.json({ tests });
}

// ---------- Dashboard / Students ----------

/** GET /api/admin/aptitude/dashboard */
export async function getDashboardStats(_req: Request, res: Response) {
  const [totalQuestions, totalTests, totalAttempts, avgAgg] = await Promise.all([
    AptitudeQuestion.countDocuments(),
    AptitudeTest.countDocuments(),
    AptitudeAttempt.countDocuments({ status: 'completed' }),
    AptitudeAttempt.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, avgScorePercent: { $avg: '$scorePercent' }, avgAccuracy: { $avg: '$accuracyPercent' } } },
    ]),
  ]);

  const totalStudents = await AptitudeAttempt.distinct('user').then((u) => u.length);

  res.json({
    totalStudents,
    totalQuestions,
    totalTests,
    totalAttempts,
    averageScorePercent: Math.round(avgAgg[0]?.avgScorePercent || 0),
    averageAccuracy: Math.round(avgAgg[0]?.avgAccuracy || 0),
  });
}

/** GET /api/admin/aptitude/students?search= — students with at least one attempt */
export async function listStudentPerformance(req: Request, res: Response) {
  const search = (req.query.search as string) || '';

  const pipeline: any[] = [
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$user',
        attempts: { $sum: 1 },
        avgScorePercent: { $avg: '$scorePercent' },
        lastAttemptAt: { $max: '$submittedAt' },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        name: { $concat: ['$user.profile.firstName', ' ', '$user.profile.lastName'] },
        email: '$user.email',
        isBlocked: '$user.isBlocked',
        attempts: 1,
        avgScorePercent: { $round: ['$avgScorePercent', 0] },
        lastAttemptAt: 1,
      },
    },
  ];

  if (search) {
    pipeline.push({
      $match: { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] },
    });
  }

  const students = await AptitudeAttempt.aggregate(pipeline);
  res.json({ students });
}

/**
 * PATCH /api/admin/aptitude/students/:userId/block  { isBlocked: boolean }
 * ADAPT: this assumes your User model has an `isBlocked` field — add it if it
 * doesn't exist yet, or point this at your existing account-status field.
 */
export async function toggleStudentBlock(req: Request, res: Response) {
  // ADAPT: import your actual User model here instead of requiring it inline.
  const User = require('../models/User').default;
  const user = await User.findByIdAndUpdate(req.params.userId, { isBlocked: req.body.isBlocked }, { new: true });
  if (!user) return res.status(404).json({ message: 'Student not found.' });
  res.json({ user });
}
