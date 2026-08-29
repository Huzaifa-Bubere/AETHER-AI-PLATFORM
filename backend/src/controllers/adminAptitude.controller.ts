import { Request, Response } from 'express';
import AptitudeQuestion from '../models/AptitudeQuestion';
import AptitudeTest from '../models/AptitudeTest';
import AptitudeAttempt from '../models/AptitudeAttempt';
import User from '../models/User';
import { uploadQuestionImage, deleteQuestionImage } from '../utils/aptitudeImageUpload';

interface AuthedRequest extends Request {
  user?: { userId: string };
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

// ---------- Questions ----------

/** POST /api/admin/aptitude/questions (supports JSON or multipart) */
export async function createQuestion(req: AuthedRequest, res: Response) {
  try {
    const {
      roundType = 'aptitude',
      category,
      difficulty = 'easy',
      correctOption,
      marks = 1,
      explanation = '',
      questionText = '',
      optionA = '',
      optionB = '',
      optionC = '',
      optionD = '',
      options: rawOptions,
    } = req.body;

    if (!category) {
      return res.status(400).json({ message: 'Category is required.' });
    }
    if (!correctOption || !['A', 'B', 'C', 'D'].includes(correctOption)) {
      return res.status(400).json({ message: 'Valid correct option (A, B, C, or D) is required.' });
    }

    let imageUrl = '';
    let imagePublicId = '';

    if (req.file) {
      const uploaded = await uploadQuestionImage(req.file.buffer);
      imageUrl = uploaded.url;
      imagePublicId = uploaded.publicId;
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
      imagePublicId = req.body.imagePublicId || `external_${Date.now()}`;
    }

    // Must have either an image OR question text
    if (!imageUrl && !questionText) {
      return res.status(400).json({ message: 'Either a Question Statement or an Image is required.' });
    }

    let parsedOptions = {
      A: optionA || '',
      B: optionB || '',
      C: optionC || '',
      D: optionD || '',
    };

    if (rawOptions) {
      try {
        const optObj = typeof rawOptions === 'string' ? JSON.parse(rawOptions) : rawOptions;
        parsedOptions = {
          A: optObj.A || parsedOptions.A,
          B: optObj.B || parsedOptions.B,
          C: optObj.C || parsedOptions.C,
          D: optObj.D || parsedOptions.D,
        };
      } catch {
        // ignore parse error and keep parsedOptions
      }
    }

    const question = await AptitudeQuestion.create({
      roundType,
      category,
      difficulty,
      correctOption,
      marks: Number(marks) || 1,
      explanation: explanation || '',
      questionText: questionText || '',
      options: parsedOptions,
      imageUrl,
      imagePublicId,
      createdBy: req.user?.userId,
    });

    return res.status(201).json({ question });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to create question' });
  }
}

/**
 * POST /api/admin/aptitude/questions/bulk (supports JSON array or multipart images)
 */
export async function bulkCreateQuestions(req: AuthedRequest, res: Response) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    let questionsData: any[] = [];

    if (req.body.questions && Array.isArray(req.body.questions)) {
      questionsData = req.body.questions;
    } else if (req.body.meta) {
      try {
        questionsData = JSON.parse(req.body.meta);
      } catch {
        return res.status(400).json({ message: '`meta` must be a valid JSON array.' });
      }
    }

    if (files && files.length > 0) {
      if (questionsData.length !== files.length) {
        return res.status(400).json({ message: `Got ${files.length} images but ${questionsData.length} meta entries — they must match 1:1.` });
      }
    } else if (questionsData.length === 0) {
      return res.status(400).json({ message: 'No questions provided.' });
    }

    const created = [];
    const failed: { index: number; error: string }[] = [];

    for (let i = 0; i < questionsData.length; i++) {
      try {
        const m = questionsData[i];
        let imageUrl = m.imageUrl || '';
        let imagePublicId = m.imagePublicId || '';

        if (files && files[i]) {
          const uploaded = await uploadQuestionImage(files[i].buffer);
          imageUrl = uploaded.url;
          imagePublicId = uploaded.publicId;
        }

        const question = await AptitudeQuestion.create({
          roundType: m.roundType || 'aptitude',
          category: m.category,
          difficulty: m.difficulty || 'easy',
          correctOption: m.correctOption || 'A',
          marks: Number(m.marks) || 1,
          explanation: m.explanation || '',
          questionText: m.questionText || '',
          options: m.options || {
            A: m.optionA || '',
            B: m.optionB || '',
            C: m.optionC || '',
            D: m.optionD || '',
          },
          imageUrl,
          imagePublicId,
          createdBy: req.user?.userId,
        });
        created.push(question);
      } catch (err: any) {
        failed.push({ index: i, error: err.message });
      }
    }

    return res.status(207).json({ createdCount: created.length, failedCount: failed.length, created, failed });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to bulk create questions' });
  }
}

/** GET /api/admin/aptitude/questions?roundType=&category=&difficulty=&status=&page=&limit= */
export async function listQuestions(req: Request, res: Response) {
  const { roundType, category, difficulty, status, page = '1', limit = '20', search = '' } = req.query as Record<string, string>;
  const filter: Record<string, any> = {};
  if (roundType) filter.roundType = roundType;
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { questionText: { $regex: search, $options: 'i' } },
      { explanation: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [questions, total] = await Promise.all([
    AptitudeQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    AptitudeQuestion.countDocuments(filter),
  ]);

  return res.json({ questions, total, page: pageNum, pages: Math.ceil(total / limitNum) });
}

/** PUT /api/admin/aptitude/questions/:id */
export async function updateQuestion(req: AuthedRequest, res: Response) {
  const { category, difficulty, correctOption, marks, explanation, roundType, questionText, optionA, optionB, optionC, optionD, options } = req.body;
  const question = await AptitudeQuestion.findById(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found.' });

  if (req.file) {
    const { url, publicId } = await uploadQuestionImage(req.file.buffer);
    if (question.imagePublicId) {
      await deleteQuestionImage(question.imagePublicId).catch(() => {});
    }
    question.imageUrl = url;
    question.imagePublicId = publicId;
  }

  if (roundType) question.roundType = roundType;
  if (category) question.category = category;
  if (difficulty) question.difficulty = difficulty;
  if (correctOption) question.correctOption = correctOption;
  if (marks !== undefined) question.marks = Number(marks);
  if (explanation !== undefined) question.explanation = explanation;
  if (questionText !== undefined) question.questionText = questionText;

  if (options) {
    try {
      const optObj = typeof options === 'string' ? JSON.parse(options) : options;
      question.options = {
        A: optObj.A ?? question.options?.A ?? '',
        B: optObj.B ?? question.options?.B ?? '',
        C: optObj.C ?? question.options?.C ?? '',
        D: optObj.D ?? question.options?.D ?? '',
      };
    } catch {
      // keep existing
    }
  } else if (optionA !== undefined || optionB !== undefined || optionC !== undefined || optionD !== undefined) {
    question.options = {
      A: optionA ?? question.options?.A ?? '',
      B: optionB ?? question.options?.B ?? '',
      C: optionC ?? question.options?.C ?? '',
      D: optionD ?? question.options?.D ?? '',
    };
  }

  await question.save();
  return res.json({ question });
}

/** PATCH /api/admin/aptitude/questions/:id/status  { status: 'active' | 'inactive' } */
export async function toggleQuestionStatus(req: Request, res: Response) {
  const question = await AptitudeQuestion.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!question) return res.status(404).json({ message: 'Question not found.' });
  return res.json({ question });
}

/** DELETE /api/admin/aptitude/questions/:id */
export async function deleteQuestion(req: Request, res: Response) {
  const question = await AptitudeQuestion.findById(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found.' });
  if (question.imagePublicId) {
    await deleteQuestionImage(question.imagePublicId).catch(() => {});
  }
  await question.deleteOne();
  return res.json({ deleted: true });
}

// ---------- Tests ----------

/** POST /api/admin/aptitude/tests */
export async function createTest(req: AuthedRequest, res: Response) {
  try {
    const test = await AptitudeTest.create({
      ...req.body,
      isPublished: req.body.isPublished !== undefined ? req.body.isPublished : true,
      createdBy: req.user?.userId,
    });
    return res.status(201).json({ test });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Failed to create test' });
  }
}

/** PUT /api/admin/aptitude/tests/:id */
export async function updateTest(req: Request, res: Response) {
  const test = await AptitudeTest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  return res.json({ test });
}

/** PATCH /api/admin/aptitude/tests/:id/publish  { isPublished: boolean } */
export async function togglePublishTest(req: Request, res: Response) {
  const test = await AptitudeTest.findByIdAndUpdate(req.params.id, { isPublished: req.body.isPublished }, { new: true });
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  return res.json({ test });
}

/** GET /api/admin/aptitude/tests */
export async function listTests(_req: Request, res: Response) {
  const tests = await AptitudeTest.find().sort({ createdAt: -1 });
  return res.json({ tests });
}

// ---------- Dashboard / Students ----------

/** GET /api/admin/aptitude/dashboard */
export async function getDashboardStats(_req: Request, res: Response) {
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

    return res.json({
      totalStudents,
      totalQuestions,
      totalTests,
      totalAttempts,
      averageScorePercent: Math.round(avgAgg[0]?.avgScorePercent || 0),
      averageAccuracy: Math.round(avgAgg[0]?.avgAccuracy || 0),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to load stats' });
  }
}

/** GET /api/admin/aptitude/students?search= — students with at least one attempt */
export async function listStudentPerformance(req: Request, res: Response) {
  try {
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
          isBlocked: { $ifNull: ['$user.auth.lockUntil', false] },
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
    return res.json({ students });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to list students' });
  }
}

/**
 * PATCH /api/admin/aptitude/students/:userId/block  { isBlocked: boolean }
 */
export async function toggleStudentBlock(req: Request, res: Response) {
  try {
    const lockUntil = req.body.isBlocked ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { 'auth.lockUntil': lockUntil },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Student not found.' });
    return res.json({ user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to toggle block status' });
  }
}