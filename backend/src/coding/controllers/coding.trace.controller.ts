import { Request, Response } from 'express';
import CodingProblem from '../models/CodingProblem';
import CodingSubmission from '../models/CodingSubmission';
import { generateTrace, traceCapabilities } from '../trace/trace.service';
import { isCodingLanguage } from '../types/coding.types';
import logger from '../../utils/logger';

/**
 * AETHER Coding — post-submission Execution Visualizer endpoints.
 *
 * SECURITY: only SAMPLE test cases (or candidate-provided custom input) may
 * be traced. Hidden test values are NEVER returned, logged, or traced — the
 * controller resolves inputs exclusively from problem.sampleTests / request
 * body, never from problem.hiddenTests.
 */
export class CodingTraceController {
  /** GET /api/coding/trace/capabilities — honest language support matrix. */
  async capabilities(req: Request, res: Response) {
    return res.json({ success: true, data: traceCapabilities() });
  }

  /**
   * GET /api/coding/submissions/:id/trace-inputs
   * List the traceable inputs for a submission: sample tests + custom slot.
   * Hidden tests are deliberately absent.
   */
  async listTraceInputs(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { id } = req.params;
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ success: false, message: 'Invalid submission id' });
      }
      const submission = await CodingSubmission.findOne({ _id: id, user: userId })
        .populate('problem', 'title slug sampleTests functionNames')
        .lean();
      if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

      const problem: any = submission.problem || {};
      const inputs = (problem.sampleTests || []).map((t: any, i: number) => ({
        id: `sample-${i}`,
        label: `Sample Test Case ${i + 1}`,
        input: t.input,
        expectedOutput: t.expectedOutput,
      }));
      inputs.push({ id: 'custom', label: 'Custom Input', input: '', expectedOutput: '' });

      return res.json({
        success: true,
        data: {
          submissionId: id,
          language: submission.language,
          functionName: problem.functionNames?.[submission.language] || undefined,
          inputs,
        },
      });
    } catch (err: any) {
      logger.error('listTraceInputs error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load trace inputs' });
    }
  }

  /**
   * POST /api/coding/submissions/:id/trace
   * body: { inputId: 'sample-0' | 'custom', customInput?: string }
   */
  async traceSubmission(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { id } = req.params;
      const { inputId, customInput } = req.body as { inputId?: string; customInput?: string };

      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ success: false, message: 'Invalid submission id' });
      }
      const submission = await CodingSubmission.findOne({ _id: id, user: userId })
        .populate('problem', 'sampleTests functionNames title')
        .lean();
      if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
      if (!isCodingLanguage(submission.language)) {
        return res.status(400).json({ success: false, message: `Unsupported language: ${submission.language}` });
      }

      const problem: any = submission.problem || {};

      // Resolve the requested input — sample tests ONLY (or custom).
      let testInput: string | null = null;
      let label = 'Custom Input';
      if (inputId === 'custom') {
        testInput = (customInput || '').slice(0, 2000);
        if (!testInput.trim()) {
          return res.status(400).json({ success: false, message: 'Custom input is empty.' });
        }
      } else if (typeof inputId === 'string' && inputId.startsWith('sample-')) {
        const idx = Number(inputId.slice('sample-'.length));
        const sample = (problem.sampleTests || [])[idx];
        if (!sample) return res.status(400).json({ success: false, message: 'Unknown sample test case' });
        testInput = sample.input;
        label = `Sample Test Case ${idx + 1}`;
      } else {
        return res.status(400).json({ success: false, message: 'inputId must reference a sample test case or "custom"' });
      }

      const functionName = problem.functionNames?.[submission.language] || undefined;
      const started = Date.now();
      const result = await generateTrace({
        language: submission.language,
        sourceCode: submission.sourceCode,
        testInput,
        functionName,
      });

      logger.info(`Trace for submission ${id} (${submission.language}, ${label}): ok=${result.ok} steps=${result.metadata.totalSteps} in ${Date.now() - started}ms`);
      return res.json({
        success: true,
        data: { ...result, inputLabel: label },
      });
    } catch (err: any) {
      logger.error('traceSubmission error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to generate trace' });
    }
  }
}

export const codingTraceController = new CodingTraceController();
