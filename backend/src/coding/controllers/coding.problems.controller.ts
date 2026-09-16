import { Request, Response } from 'express';
import CodingProblem from '../models/CodingProblem';
import { isCodingLanguage } from '../types/coding.types';
import logger from '../../utils/logger';

/**
 * AETHER Coding — problem library endpoints (candidate).
 * Hidden tests and solution outlines are never exposed here.
 */
class CodingProblemsController {
  async listProblems(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { difficulty, category, search, company, tag, status } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageLimit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

      const query: any = { isPublished: true, archived: { $ne: true } };
      if (difficulty && difficulty !== 'all') query.difficulty = difficulty;
      if (category && category !== 'all') query.category = category;
      if (company) query.companies = company;
      if (tag) query.tags = tag;
      if (search) query.$text = { $search: String(search) };

      const [problems, total] = await Promise.all([
        CodingProblem.find(query)
          .select('title slug difficulty category tags companies points')
          .sort({ difficulty: 1, title: 1 })
          .skip((page - 1) * pageLimit)
          .limit(pageLimit)
          .lean(),
        CodingProblem.countDocuments(query),
      ]);

      // Per-user solved/attempted status
      let statusMap: Record<string, { solved: boolean; attempted: boolean }> = {};
      if (userId) {
        const progress = await CodingProgressModel().findOne({ user: userId }).lean();
        const solvedIds = new Set((progress?.solvedProblems || []).map((s: any) => String(s.problemId)));
        const attemptedIds = new Set((progress?.attemptedProblems || []).map((a: any) => String(a.problemId)));
        statusMap = Object.fromEntries(
          problems.map((p: any) => [
            String(p._id),
            { solved: solvedIds.has(String(p._id)), attempted: attemptedIds.has(String(p._id)) },
          ])
        );
      }

      let filtered = problems.map((p: any) => ({
        ...p,
        status: statusMap[String(p._id)] || { solved: false, attempted: false },
      }));
      if (status === 'solved') filtered = filtered.filter((p: any) => p.status.solved);
      if (status === 'attempted') filtered = filtered.filter((p: any) => p.status.attempted && !p.status.solved);
      if (status === 'unsolved') filtered = filtered.filter((p: any) => !p.status.solved);

      return res.json({
        success: true,
        data: {
          problems: filtered,
          pagination: { page, limit: pageLimit, total, totalPages: Math.ceil(total / pageLimit) },
        },
      });
    } catch (err: any) {
      logger.error('listProblems error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to load problems' });
    }
  }

  async getProblem(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const problem = await CodingProblem.findOne({ slug, isPublished: true, archived: { $ne: true } })
        .select('-hiddenTests -solutionOutline')
        .lean();
      if (!problem) {
        return res.status(404).json({ success: false, message: 'Problem not found' });
      }
      return res.json({ success: true, data: problem });
    } catch (err: any) {
      logger.error('getProblem error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load problem' });
    }
  }
}

/** Lazy import to avoid circular model registration ordering issues. */
function CodingProgressModel() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../models/CodingProgress').default;
}

export const codingProblemsController = new CodingProblemsController();
