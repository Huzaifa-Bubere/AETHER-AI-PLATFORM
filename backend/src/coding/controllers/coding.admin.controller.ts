import { Request, Response } from 'express';
import CodingProblem from '../models/CodingProblem';
import logger from '../../utils/logger';

/**
 * AETHER Coding — admin problem management.
 * Admins see full problem metadata including hidden tests.
 */
class CodingAdminController {
  async listAllProblems(req: Request, res: Response) {
    try {
      const { difficulty, category, search } = req.query;
      const query: any = { archived: { $ne: true } };
      if (difficulty && difficulty !== 'all') query.difficulty = difficulty;
      if (category && category !== 'all') query.category = category;
      if (search) query.$text = { $search: String(search) };

      const problems = await CodingProblem.find(query)
        .select('title slug difficulty category tags points isPublished sampleTests hiddenTests updatedAt')
        .sort({ updatedAt: -1 })
        .lean();

      return res.json({ success: true, data: problems });
    } catch (err: any) {
      logger.error('admin listAllProblems error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load problems' });
    }
  }

  async getProblemById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const problem = await CodingProblem.findById(id).lean();
      if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
      return res.json({ success: true, data: problem });
    } catch (err: any) {
      logger.error('admin getProblemById error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load problem' });
    }
  }

  async createProblem(req: Request, res: Response) {
    try {
      const data = this.normalizeProblemPayload(req.body);
      const problem = await CodingProblem.create(data);
      return res.status(201).json({ success: true, data: problem, message: 'Problem created' });
    } catch (err: any) {
      logger.error('admin createProblem error:', err);
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A problem with this slug already exists' });
      }
      return res.status(500).json({ success: false, message: err.message || 'Failed to create problem' });
    }
  }

  async updateProblem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = this.normalizeProblemPayload(req.body, true);
      const problem = await CodingProblem.findByIdAndUpdate(id, data, { new: true, runValidators: true });
      if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
      return res.json({ success: true, data: problem, message: 'Problem updated' });
    } catch (err: any) {
      logger.error('admin updateProblem error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to update problem' });
    }
  }

  async archiveProblem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const problem = await CodingProblem.findByIdAndUpdate(id, { archived: true, isPublished: false }, { new: true });
      if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
      return res.json({ success: true, message: 'Problem archived' });
    } catch (err: any) {
      logger.error('admin archiveProblem error:', err);
      return res.status(500).json({ success: false, message: 'Failed to archive problem' });
    }
  }

  private normalizeProblemPayload(body: any, partial = false): any {
    const data: any = {};
    const fields = [
      'title', 'slug', 'description', 'difficulty', 'category', 'tags', 'companies',
      'examples', 'constraints', 'starterCode', 'sampleTests', 'hiddenTests',
      'functionNames', 'knownApproaches', 'expectedTimeComplexity', 'expectedSpaceComplexity',
      'points', 'hints', 'solutionOutline', 'isPublished',
    ];
    for (const f of fields) {
      if (!partial && f === 'slug') continue; // auto-generate below
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (!partial) {
      data.slug = (body.slug && String(body.slug).trim()) ||
        String(body.title || 'problem')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
    }
    return data;
  }
}

export const codingAdminController = new CodingAdminController();
