import { Request, Response } from 'express';
import AptitudeQuestion from '../models/AptitudeQuestion';
import AptitudeTest from '../models/AptitudeTest';
import AptitudeAttempt from '../models/AptitudeAttempt';
import User from '../models/User';
import { requireAvailableQuestions, testAvailability } from '../services/aptitudeAvailability.service';
import { invalidInput } from '../middleware/aptitudeValidation';
import { uploadQuestionImage, deleteQuestionImage } from '../utils/aptitudeImageUpload';

interface AuthedRequest extends Request {
  user?: { userId: string; email?: string; role?: string };
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

// ---------- Questions ----------
function questionInput(body: any, existing?: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalidInput('Question must be an object.');
  const data: any = {};
  for (const field of ['roundType', 'category', 'difficulty', 'correctOption', 'marks', 'explanation', 'questionText']) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  let options = body.options;
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { invalidInput('Options must be valid JSON.'); }
  }
  if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) invalidInput('Options must contain A, B, C and D.');
  data.options = Object.fromEntries(['A', 'B', 'C', 'D'].map(key => [key,
    options?.[key] ?? body[`option${key}`] ?? existing?.options?.[key] ?? '']));
  if (body.imageUrl !== undefined) {
    if (typeof body.imageUrl !== 'string' || (body.imageUrl && !/^https?:\/\//i.test(body.imageUrl))) invalidInput('An external image must use an HTTP or HTTPS URL.');
    data.imageUrl = body.imageUrl;
    data.imagePublicId = ''; // External assets are never owned or deleted by this API.
  }
  return data;
}

async function storeQuestion(body: any, file: Express.Multer.File | undefined, userId?: string, existing?: any) {
  const question = existing || new AptitudeQuestion({ createdBy: userId });
  const oldPublicId = question.imagePublicId;
  question.set(questionInput(body, existing));
  if (file) question.imageUrl = 'pending-upload';
  await question.validate(); // Reject malformed records before uploading any asset.
  let uploaded;
  try {
    if (file) {
      uploaded = await uploadQuestionImage(file.buffer);
      question.imageUrl = uploaded.url;
      question.imagePublicId = uploaded.publicId;
    }
    await question.save();
  } catch (error) {
    if (uploaded) await deleteQuestionImage(uploaded.publicId);
    throw error;
  }
  if (oldPublicId && oldPublicId !== question.imagePublicId) await deleteQuestionImage(oldPublicId);
  return question;
}

export async function createQuestion(req: AuthedRequest, res: Response): Promise<void> {
  const question = await storeQuestion(req.body, req.file, req.user?.userId);
  res.status(201).json({ question });
}

export async function bulkCreateQuestions(req: AuthedRequest, res: Response): Promise<void> {
  let data = req.body.questions;
  if (req.body.meta !== undefined) {
    try { data = JSON.parse(req.body.meta); } catch { invalidInput('Metadata must be a valid JSON array.'); }
  }
  if (!Array.isArray(data) || data.length < 1 || data.length > 100) invalidInput('Provide between 1 and 100 questions.');
  const files = req.files || [];
  if (files.length && files.length !== data.length) invalidInput('Images and metadata entries must match in number and order.');
  const created = [], failed = [];
  for (let index = 0; index < data.length; index++) {
    try { created.push(await storeQuestion(data[index], files[index], req.user?.userId)); }
    catch (error: any) { failed.push({ index, error: error.message }); }
  }
  res.status(207).json({ createdCount: created.length, failedCount: failed.length, created, failed });
}

const literalSearch = (value: string) => value.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const { roundType, category, difficulty, status, page = '1', limit = '20', search = '' } = req.query as Record<string, string>;
  const filter: Record<string, any> = {};
  for (const [key, value] of Object.entries({ roundType, category, difficulty, status })) if (value) filter[key] = value;
  if (search) filter.$or = ['questionText', 'explanation'].map(key => ({ [key]: { $regex: literalSearch(search), $options: 'i' } }));
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const [questions, total] = await Promise.all([
    AptitudeQuestion.find(filter).sort({ createdAt: -1, _id: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    AptitudeQuestion.countDocuments(filter),
  ]);
  res.json({ questions, total, page: pageNum, pages: Math.ceil(total / limitNum) });
}

export async function updateQuestion(req: AuthedRequest, res: Response): Promise<void> {
  const question = await AptitudeQuestion.findById(req.params.id);
  if (!question) { res.status(404).json({ message: 'Question not found.' }); return; }
  if (await AptitudeAttempt.exists({ questions: question._id })) {
    res.status(409).json({ message: 'This question has been used. Create a replacement and deactivate this one to preserve results.' }); return;
  }
  res.json({ question: await storeQuestion(req.body, req.file, req.user?.userId, question) });
}

export async function toggleQuestionStatus(req: Request, res: Response): Promise<void> {
  if (!['active', 'inactive'].includes(req.body.status)) invalidInput('Status must be active or inactive.');
  const question = await AptitudeQuestion.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!question) { res.status(404).json({ message: 'Question not found.' }); return; }
  res.json({ question });
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const question = await AptitudeQuestion.findById(req.params.id);
  if (!question) { res.status(404).json({ message: 'Question not found.' }); return; }
  if (await AptitudeAttempt.exists({ questions: question._id })) {
    res.status(409).json({ message: 'This question has been used. Deactivate it to preserve existing results.' }); return;
  }
  await question.deleteOne();
  if (question.imagePublicId) await deleteQuestionImage(question.imagePublicId);
  res.json({ deleted: true });
}

// ---------- Tests ----------

const testFields = ['title', 'roundType', 'categories', 'difficultyPlan', 'durationMinutes', 'isPublished'];
async function applyTestInput(test: InstanceType<typeof AptitudeTest>, body: any) {
  if (body.isPublished !== undefined && typeof body.isPublished !== 'boolean') invalidInput('Published status must be a boolean.');
  for (const field of testFields) if (body[field] !== undefined) test.set(field, body[field]);
  await test.validate();
  if (test.isPublished) await requireAvailableQuestions(test);
  await test.save();
}

export async function createTest(req: AuthedRequest, res: Response): Promise<void> {
  const test = new AptitudeTest({ createdBy: req.user?.userId, isPublished: false });
  await applyTestInput(test, req.body);
  res.status(201).json({ test });
}

export async function updateTest(req: Request, res: Response): Promise<void> {
  const test = await AptitudeTest.findById(req.params.id);
  if (!test) { res.status(404).json({ message: 'Test not found.' }); return; }
  await applyTestInput(test, req.body);
  res.json({ test });
}

export async function togglePublishTest(req: Request, res: Response): Promise<void> {
  if (typeof req.body.isPublished !== 'boolean') invalidInput('Published status must be a boolean.');
  const test = await AptitudeTest.findById(req.params.id);
  if (!test) { res.status(404).json({ message: 'Test not found.' }); return; }
  await applyTestInput(test, { isPublished: req.body.isPublished });
  res.json({ test });
}

export async function listTests(_req: Request, res: Response): Promise<void> {
  const tests = await AptitudeTest.find().sort({ createdAt: -1 });
  res.json({ tests: await Promise.all(tests.map(async test => ({ ...test.toObject(), availability: await testAvailability(test) }))) });
}

// ---------- Dashboard / Students ----------

/** GET /api/admin/aptitude/dashboard */
export async function getDashboardStats(_req: Request, res: Response): Promise<void> {
  try {
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
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to load stats' });
  }
}

/** GET /api/admin/aptitude/students?search= — students with at least one attempt */
export async function listStudentPerformance(req: Request, res: Response): Promise<void> {
  try {
    const search = literalSearch((req.query.search as string) || '');

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
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          name: {
            $ifNull: [
              { $concat: ['$user.profile.firstName', ' ', '$user.profile.lastName'] },
              'Candidate',
            ],
          },
          email: { $ifNull: ['$user.email', 'N/A'] },
          isBlocked: { $gt: ['$user.auth.lockUntil', '$$NOW'] },
          attempts: 1,
          avgScorePercent: { $round: [{ $ifNull: ['$avgScorePercent', 0] }, 0] },
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
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to list students' });
  }
}

/**
 * PATCH /api/admin/aptitude/students/:userId/block  { isBlocked: boolean }
 */
export async function toggleStudentBlock(req: Request, res: Response): Promise<void> {
  if (typeof req.body.isBlocked !== 'boolean') invalidInput('Blocked status must be a boolean.');
  const isBlocked = req.body.isBlocked;
  const user = await User.findOneAndUpdate(
    { _id: req.params.userId, 'auth.role': { $ne: 'admin' } },
    { $set: { 'auth.lockUntil': isBlocked ? new Date(Date.now() + 365 * 86400000) : null },
      ...(isBlocked ? { $inc: { 'auth.tokenVersion': 1 } } : {}) },
    { new: true }
  );
  if (!user) { res.status(404).json({ message: 'Student not found. Administrator accounts cannot be blocked here.' }); return; }
  res.json({ userId: user._id, isBlocked });
}
