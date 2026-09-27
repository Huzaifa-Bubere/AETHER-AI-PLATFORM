import { Request, Response } from 'express';
import CodingProblem from '../models/CodingProblem';
import CodingSubmission from '../models/CodingSubmission';
import CodingProgress from '../models/CodingProgress';
import { codingExecutionService } from '../services/execution.service';
import { analyzeSource } from '../ast/AstAnalyzer';
import { computeScore } from '../scoring/scoring.service';
import { codingExplanationService } from '../services/explanation.service';
import { isCodingLanguage, IAstAnalysis, IExecutionResult } from '../types/coding.types';
import {
  compareComplexity,
  resolveComplexityMetadata,
  IComplexityComparison,
} from '../complexity/complexity';
import logger from '../../utils/logger';

/**
 * AETHER Coding — execution & submission endpoints.
 * Pipeline: validate → execute (Judge0/fallback) → AST → score → persist → explain → progress.
 */
class CodingSubmissionsController {
  // ── Run (sample/custom — NOT an official submission) ────────────────────────

  async runCode(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { problemSlug, language, sourceCode, customInput } = req.body;

      if (!isCodingLanguage(language)) {
        return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
      }
      if (!sourceCode?.trim()) {
        return res.status(400).json({ success: false, message: 'sourceCode is required' });
      }

      let tests: Array<{ input: string; expectedOutput: string }> = [];
      let functionName: string | undefined;

      if (problemSlug) {
        const problem = await CodingProblem.findOne({ slug: problemSlug, isPublished: true }).lean();
        if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
        tests = (problem.sampleTests || []).map((t: any) => ({ input: t.input, expectedOutput: t.expectedOutput }));
        functionName = problem.functionNames?.[language];
      } else if (customInput) {
        tests = [{ input: customInput, expectedOutput: '' }];
      }

      const exec = await codingExecutionService.runCode(userId, language, sourceCode, tests, functionName);
      return res.json({ success: true, data: exec });
    } catch (err: any) {
      logger.error('runCode error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to run code' });
    }
  }

  // ── Official submit pipeline ────────────────────────────────────────────────

  async submitCode(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const userId = (req as any).user?.userId;
      const { problemSlug, language, sourceCode } = req.body;

      if (!isCodingLanguage(language)) {
        return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
      }
      if (!sourceCode?.trim()) {
        return res.status(400).json({ success: false, message: 'sourceCode is required' });
      }

      const problem = await CodingProblem.findOne({ slug: problemSlug, isPublished: true, archived: { $ne: true } })
        .select('+solutionOutline')
        .lean();
      if (!problem) {
        return res.status(404).json({ success: false, message: 'Problem not found' });
      }

      // 1. Execute against sample + hidden tests (Judge0 or fallback runner)
      const exec: IExecutionResult = await codingExecutionService.submitCode(
        userId,
        language,
        sourceCode,
        problem.sampleTests || [],
        problem.hiddenTests || [],
        problem.functionNames?.[language]
      );

      // 2. Programmatic AST analysis — runs even when tests fail (Section 10 of the spec).
      let ast: IAstAnalysis | null = null;
      try {
        ast = analyzeSource(sourceCode, language, {
          expectedTimeComplexity: problem.expectedTimeComplexity,
          expectedSpaceComplexity: problem.expectedSpaceComplexity,
          knownApproaches: (problem.knownApproaches || []) as any,
        });
      } catch (astErr) {
        logger.warn('AST analysis failed; continuing without it:', astErr);
      }

      // 3. Deterministic scoring (Judge0 + AST evidence only — no AI scores)
      const score = ast && ast.parseSuccess
        ? computeScore(exec, ast, {
            expectedTimeComplexity: problem.expectedTimeComplexity,
            expectedSpaceComplexity: problem.expectedSpaceComplexity,
            knownApproaches: (problem.knownApproaches || []) as any,
          })
        : null;

      // 3b. Deterministic complexity comparison (Part A, spec §2–§8).
      // Correctness and efficiency are separate: this never affects `status`.
      const complexityMeta = resolveComplexityMetadata(problem as any);
      const optimization: IComplexityComparison = compareComplexity({
        candidateTime: ast?.parseSuccess ? ast.complexity.estimatedTime : null,
        candidateSpace: ast?.parseSuccess ? ast.complexity.estimatedSpace : null,
        expectedTime: complexityMeta.expectedTime,
        expectedSpace: complexityMeta.expectedSpace,
        acceptedTimeClasses: complexityMeta.acceptedTimeClasses,
        analyzerConfidence: ast?.parseSuccess ? ast.complexity.confidence : 0,
        metadataVerified: complexityMeta.verified,
        analysisAvailable: !!ast?.parseSuccess,
        correctnessAccepted: exec.status === 'Accepted',
        evidence: ast?.complexity.evidence || [],
        optimizationHint: complexityMeta.optimizationHint,
        optimizationExplanation: complexityMeta.explanation,
      });

      // 4. Persist submission
      const submission = await CodingSubmission.create({
        user: userId,
        problem: (problem as any)._id,
        language,
        sourceCode,
        status: exec.status,
        tests: exec.tests.map((t, i) => ({ ...t, index: i })),
        passedTests: exec.passedTests,
        totalTests: exec.totalTests,
        runtimeMs: exec.runtimeMs,
        memoryKb: exec.memoryKb,
        executor: exec.executor,
        compileOutput: exec.compileOutput,
        stderr: exec.stderr,
        astAnalysis: ast,
        scoreBreakdown: score,
        overallScore: score?.overall ?? null,
        complexityCheck: {
          candidateComplexity: optimization.candidateTime,
          candidateSpaceComplexity: optimization.candidateSpace,
          expectedComplexity: optimization.expectedTime,
          expectedSpaceComplexity: optimization.expectedSpace,
          acceptedTimeClasses: optimization.acceptedTimeClasses,
          level: optimization.level,
          optimizationAvailable: optimization.optimizationAvailable,
          analyzerConfidence: optimization.analyzerConfidence,
          confidenceBand: optimization.confidence,
          threshold: optimization.threshold,
          evidence: optimization.evidence,
        },
        explanation: null,
        submittedAt: new Date(),
      });

      // 5. Gemini explanation — failure must not break evaluation
      let explanation = null;
      try {
        explanation = await codingExplanationService.explain({
          problem: {
            title: problem.title,
            difficulty: problem.difficulty,
            category: problem.category,
          },
          execution: {
            status: exec.status,
            passedTests: exec.passedTests,
            totalTests: exec.totalTests,
            runtimeMs: exec.runtimeMs,
            memoryKb: exec.memoryKb,
          },
          ast: ast || unavailableAst(),
          score: score || zeroScore(),
          expected: {
            preferredApproaches: (problem.knownApproaches || []) as any,
            expectedTime: complexityMeta.expectedTime || problem.expectedTimeComplexity,
            expectedSpace: complexityMeta.expectedSpace || problem.expectedSpaceComplexity,
          },
          optimization,
        });
        await CodingSubmission.updateOne({ _id: submission._id }, { $set: { explanation } });
      } catch (explainErr) {
        logger.warn('Explanation generation failed; submission result unaffected');
      }

      // 6. Update progress + platform analytics
      try {
        await updateProgress(userId, problem as any, exec, language, score?.overall ?? null, optimization);
      } catch (progErr) {
        logger.warn('Progress update failed after submission:', progErr);
      }

      // 7. Respond
      return res.json({
        success: true,
        data: {
          submissionId: (submission as any)._id,
          status: exec.status,
          passedTests: exec.passedTests,
          totalTests: exec.totalTests,
          tests: exec.tests,
          runtimeMs: exec.runtimeMs,
          memoryKb: exec.memoryKb,
          astAnalysis: ast,
          scoreBreakdown: score,
          explanation,
          optimization,
          // Summary only — the reference CODE is served behind an explicit click
          // so an editorial solution is never leaked before a submission.
          referenceApproach: referenceApproachSummary(problem as any),
          elapsedMs: Date.now() - startedAt,
          problem: {
            title: problem.title,
            slug: problem.slug,
            difficulty: problem.difficulty,
            category: problem.category,
          },
        },
      });
    } catch (err: any) {
      logger.error('submitCode error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to submit code' });
    }
  }

  // ── Submission history ──────────────────────────────────────────────────────

  async listMySubmissions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

      const [items, total] = await Promise.all([
        CodingSubmission.find({ user: userId })
          .populate('problem', 'title slug difficulty category')
          .select('problem language status passedTests totalTests runtimeMs memoryKb overallScore submittedAt')
          .sort({ submittedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        CodingSubmission.countDocuments({ user: userId }),
      ]);

      return res.json({
        success: true,
        data: { submissions: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      });
    } catch (err: any) {
      logger.error('listMySubmissions error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load submissions' });
    }
  }

  async getSubmissionDetail(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const isAdmin = (req as any).user?.auth?.role === 'admin';
      const { id } = req.params;

      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ success: false, message: 'Invalid submission id' });
      }

      const query: any = { _id: id };
      if (!isAdmin) query.user = userId; // candidates only see their own submissions

      const submission = await CodingSubmission.findOne(query)
        .populate('problem', 'title slug difficulty category knownApproaches expectedTimeComplexity expectedSpaceComplexity')
        .lean();

      if (!submission) {
        return res.status(404).json({ success: false, message: 'Submission not found' });
      }

      return res.json({ success: true, data: submission });
    } catch (err: any) {
      logger.error('getSubmissionDetail error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load submission' });
    }
  }

  // ── Optimization feedback (Part A) ──────────────────────────────────────────

  /**
   * POST /api/coding/submissions/:id/explain
   * "Explain with AETHER AI" — narrates the ALREADY COMPUTED complexity verdict.
   * Gemini may only explain; it can never reclassify complexity. If Gemini is
   * unavailable the deterministic explanation is returned instead.
   */
  async explainOptimization(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { id } = req.params;
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ success: false, message: 'Invalid submission id' });
      }

      const submission = await CodingSubmission.findOne({ _id: id, user: userId })
        .populate('problem')
        .lean();
      if (!submission) {
        return res.status(404).json({ success: false, message: 'Submission not found' });
      }

      const problem: any = submission.problem;
      const stored = (submission as any).complexityCheck;

      // Rebuild the deterministic verdict. Prefer the stored comparison so the
      // explanation always matches what the candidate was shown.
      const ast = (submission as any).astAnalysis as IAstAnalysis | null;
      const meta = resolveComplexityMetadata(problem || {});
      const optimization: IComplexityComparison = stored
        ? {
            candidateTime: stored.candidateComplexity || 'Unknown',
            candidateSpace: stored.candidateSpaceComplexity || 'Unknown',
            expectedTime: stored.expectedComplexity || 'Unknown',
            expectedSpace: stored.expectedSpaceComplexity || 'Unknown',
            acceptedTimeClasses: stored.acceptedTimeClasses || [],
            candidateTimeRank: null,
            expectedTimeRank: null,
            confidence: stored.confidenceBand || 'LOW',
            analyzerConfidence: stored.analyzerConfidence || 0,
            level: stored.level || 'UNKNOWN',
            optimizationAvailable: !!stored.optimizationAvailable,
            warn: stored.level === 'POSSIBLY_IMPROVABLE' || stored.level === 'CLEAR_OPTIMIZATION_OPPORTUNITY',
            headline: '',
            message: '',
            reason: '',
            optimizationHint: meta.optimizationHint,
            optimizationExplanation: meta.explanation,
            evidence: stored.evidence || [],
            threshold: stored.threshold || 0,
          }
        : compareComplexity({
            candidateTime: ast?.complexity?.estimatedTime,
            candidateSpace: ast?.complexity?.estimatedSpace,
            expectedTime: meta.expectedTime,
            expectedSpace: meta.expectedSpace,
            acceptedTimeClasses: meta.acceptedTimeClasses,
            analyzerConfidence: ast?.complexity?.confidence ?? 0,
            metadataVerified: meta.verified,
            analysisAvailable: !!ast?.parseSuccess,
            correctnessAccepted: submission.status === 'Accepted',
            evidence: ast?.complexity?.evidence || [],
            optimizationHint: meta.optimizationHint,
            optimizationExplanation: meta.explanation,
          });

      // Re-derive the human-readable wording when only the stored record existed.
      if (stored && !optimization.message) {
        const recomputed = compareComplexity({
          candidateTime: optimization.candidateTime,
          candidateSpace: optimization.candidateSpace,
          expectedTime: optimization.expectedTime,
          expectedSpace: optimization.expectedSpace,
          acceptedTimeClasses: optimization.acceptedTimeClasses,
          analyzerConfidence: optimization.analyzerConfidence,
          metadataVerified: meta.verified,
          analysisAvailable: true,
          correctnessAccepted: submission.status === 'Accepted',
          evidence: optimization.evidence,
          optimizationHint: meta.optimizationHint,
          optimizationExplanation: meta.explanation,
        });
        optimization.message = recomputed.message;
        optimization.reason = recomputed.reason;
        optimization.headline = recomputed.headline;
        optimization.warn = recomputed.warn;
      }

      const code = referenceCode(problem);
      const snippet = code[submission.language] || code.python || code.javascript || null;

      const explanation = await codingExplanationService.explainOptimization({
        problem: {
          title: problem?.title || 'this problem',
          description: problem?.description,
          difficulty: problem?.difficulty || '',
          category: problem?.category || '',
        },
        language: submission.language,
        sourceCode: submission.sourceCode,
        ast: ast || unavailableAst(),
        optimization,
        referenceApproach: problem?.referenceApproach
          ? {
              title: problem.referenceApproach.title || '',
              approachId: problem.referenceApproach.approachId || '',
              explanation: problem.referenceApproach.explanation || '',
              timeComplexity: problem.referenceApproach.timeComplexity || '',
              spaceComplexity: problem.referenceApproach.spaceComplexity || '',
            }
          : null,
        optimizedCodeSnippet: snippet,
      });

      return res.json({ success: true, data: { optimization, explanation } });
    } catch (err: any) {
      logger.error('explainOptimization error:', err);
      return res.status(500).json({ success: false, message: 'Failed to explain optimization' });
    }
  }

  /**
   * GET /api/coding/submissions/:id/reference-approach
   * Serves the REFERENCE OPTIMIZED APPROACH on explicit request only, and only
   * to a candidate who already has a submission for this problem. The candidate's
   * own submission is never modified.
   */
  async getReferenceApproach(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { id } = req.params;
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ success: false, message: 'Invalid submission id' });
      }

      const submission = await CodingSubmission.findOne({ _id: id, user: userId })
        .populate('problem')
        .lean();
      if (!submission) {
        return res.status(404).json({ success: false, message: 'Submission not found' });
      }
      const problem: any = submission.problem;
      const meta = resolveComplexityMetadata(problem || {});
      const code = referenceCode(problem);
      const ref = problem?.referenceApproach;

      return res.json({
        success: true,
        data: {
          available: !!ref,
          label: 'REFERENCE OPTIMIZED APPROACH',
          title: ref?.title || meta.acceptedTimeClasses[0] || 'Optimized approach',
          approachId: ref?.approachId || '',
          explanation: ref?.explanation || meta.explanation || '',
          optimizationHint: meta.optimizationHint,
          timeComplexity: ref?.timeComplexity || meta.expectedTime,
          spaceComplexity: ref?.spaceComplexity || meta.expectedSpace,
          code,
          languages: Object.keys(code),
          /** Reference only — the candidate's submission is never overwritten. */
          note: 'This is a reference solution from the problem editorial. Your own submission is unchanged.',
        },
      });
    } catch (err: any) {
      logger.error('getReferenceApproach error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load reference approach' });
    }
  }

  /**
   * GET /api/coding/analytics/complexity
   * Complexity-optimization analytics computed ONLY from stored submissions
   * (spec §11 / §60–§62). No estimated or generated values.
   */
  async getComplexityAnalytics(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const userObjectId = new (require('mongoose').Types.ObjectId)(String(userId));

      const [grouped, withExpectation, recent] = await Promise.all([
        CodingSubmission.aggregate([
          { $match: { user: userObjectId, 'complexityCheck.level': { $nin: [null, 'UNKNOWN'] } } },
          { $group: { _id: '$complexityCheck.level', count: { $sum: 1 } } },
        ]),
        CodingSubmission.countDocuments({ user: userObjectId, 'complexityCheck.optimizationAvailable': true }),
        CodingSubmission.find({ user: userObjectId, 'complexityCheck.level': { $ne: null } })
          .select('problem language complexityCheck submittedAt')
          .populate('problem', 'title slug category difficulty')
          .sort({ submittedAt: -1 })
          .limit(10)
          .lean(),
      ]);

      const counts: Record<string, number> = { OPTIMAL: 0, POSSIBLY_IMPROVABLE: 0, CLEAR_OPTIMIZATION_OPPORTUNITY: 0 };
      for (const g of grouped as any[]) counts[g._id] = g.count;

      const tracked = counts.OPTIMAL + counts.POSSIBLY_IMPROVABLE + counts.CLEAR_OPTIMIZATION_OPPORTUNITY;
      const optimizable = counts.POSSIBLY_IMPROVABLE + counts.CLEAR_OPTIMIZATION_OPPORTUNITY;

      return res.json({
        success: true,
        data: {
          tracked,
          efficient: counts.OPTIMAL,
          optimizable,
          clearOpportunities: counts.CLEAR_OPTIMIZATION_OPPORTUNITY,
          unknownExcluded: await CodingSubmission.countDocuments({ user: userObjectId, 'complexityCheck.level': 'UNKNOWN' }),
          optimizationTracked: withExpectation,
          // Percentage is derived from real counts; null (not 0) when no data.
          efficientPercent: tracked > 0 ? Math.round((counts.OPTIMAL / tracked) * 100) : null,
          optimizablePercent: tracked > 0 ? Math.round((optimizable / tracked) * 100) : null,
          byLevel: counts,
          recent: (recent as any[]).map(s => ({
            submissionId: String(s._id),
            problem: s.problem || null,
            language: s.language,
            level: s.complexityCheck?.level || 'UNKNOWN',
            candidateComplexity: s.complexityCheck?.candidateComplexity || 'Unknown',
            expectedComplexity: s.complexityCheck?.expectedComplexity || 'Unknown',
            analyzerConfidence: s.complexityCheck?.analyzerConfidence ?? 0,
            confidenceBand: s.complexityCheck?.confidenceBand || 'LOW',
            submittedAt: s.submittedAt,
          })),
          emptyState: tracked === 0 ? 'No complexity-tracked submissions yet.' : null,
        },
      });
    } catch (err: any) {
      logger.error('getComplexityAnalytics error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load complexity analytics' });
    }
  }

  // ── Progress & recommendations ──────────────────────────────────────────────

  async getMyProgress(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      let progress = await CodingProgress.findOne({ user: userId }).lean();

      if (!progress) {
        return res.json({
          success: true,
          data: {
            exists: false,
            solvedProblems: [], attemptedProblems: [], topicStats: [], difficultyStats: [],
            streak: { current: 0, longest: 0 }, totalSubmissions: 0, acceptedSubmissions: 0,
            averageCodingScore: 0, languageUsage: [], recentActivity: [],
            complexityStats: { tracked: 0, efficient: 0, optimizable: 0, clearOpportunities: 0, unknown: 0, byTopic: [] },
          },
        });
      }
      return res.json({ success: true, data: { exists: true, ...progress } });
    } catch (err: any) {
      logger.error('getMyProgress error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load progress' });
    }
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const progress = await CodingProgress.findOne({ user: userId }).lean();
      const topicStats = (progress?.topicStats || []) as any[];

      // Weakest topics by average score among attempted ones
      const attemptedTopics = topicStats.filter(t => t.attempted > 0);
      const weakest = [...attemptedTopics].sort((a, b) => a.averageScore - b.averageScore).slice(0, 3);
      const weakestTopicNames = weakest.map(t => t.topic);

      const query: any = { isPublished: true, archived: { $ne: true } };
      if (weakestTopicNames.length > 0) {
        query.category = { $in: weakestTopicNames };
      } else {
        // New user — start with easy fundamentals
        query.difficulty = 'Easy';
      }

      const recommendations = await CodingProblem.find(query)
        .select('title slug difficulty category points')
        .limit(6)
        .lean();

      return res.json({
        success: true,
        data: {
          recommendations,
          reasoning: weakestTopicNames.length > 0
            ? `Focused on your weakest topics: ${weakestTopicNames.join(', ')}`
            : 'Foundational problems to get you started',
        },
      });
    } catch (err: any) {
      logger.error('getRecommendations error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load recommendations' });
    }
  }

  // ── On-demand AST analysis (workspace AST tab before submit) ────────────────

  async analyzeCode(req: Request, res: Response) {
    try {
      const { language, sourceCode, problemSlug } = req.body;
      if (!isCodingLanguage(language)) {
        return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
      }
      if (!sourceCode?.trim()) {
        return res.status(400).json({ success: false, message: 'sourceCode is required' });
      }

      let problemContext: any = undefined;
      if (problemSlug) {
        const problem = await CodingProblem.findOne({ slug: problemSlug }).select('expectedTimeComplexity expectedSpaceComplexity knownApproaches').lean();
        if (problem) {
          problemContext = {
            expectedTimeComplexity: problem.expectedTimeComplexity,
            expectedSpaceComplexity: problem.expectedSpaceComplexity,
            knownApproaches: problem.knownApproaches || [],
          };
        }
      }

      const analysis = analyzeSource(sourceCode, language, problemContext);
      // Strip the visualization tree for the light analyze endpoint (large payload)
      const { ast: _tree, ...rest } = analysis as any;
      return res.json({ success: true, data: rest });
    } catch (err: any) {
      logger.error('analyzeCode error:', err);
      return res.status(500).json({ success: false, message: 'Failed to analyze code' });
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Public (code-free) summary of the editorial reference solution. */
function referenceApproachSummary(problem: any): any {
  const ref = problem?.referenceApproach;
  if (!ref) return null;
  const code: Record<string, string> = ref.code instanceof Map
    ? Object.fromEntries(ref.code.entries())
    : (ref.code || {});
  return {
    available: true,
    title: ref.title || '',
    approachId: ref.approachId || '',
    explanation: ref.explanation || '',
    timeComplexity: ref.timeComplexity || '',
    spaceComplexity: ref.spaceComplexity || '',
    languages: Object.keys(code),
    hasCode: Object.keys(code).length > 0,
  };
}

/** Read a Map/plain-object code field safely after a Mongoose lean(). */
function referenceCode(problem: any): Record<string, string> {
  const ref = problem?.referenceApproach;
  if (!ref) return {};
  if (ref.code instanceof Map) return Object.fromEntries(ref.code.entries());
  return (ref.code || {}) as Record<string, string>;
}

// ── Progress update helper ───────────────────────────────────────────────────

async function updateProgress(
  userId: string,
  problem: any,
  exec: IExecutionResult,
  language: string,
  score: number | null,
  optimization?: IComplexityComparison
): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const accepted = exec.status === 'Accepted';

  let progress = await CodingProgress.findOne({ user: userId });
  if (!progress) {
    progress = new CodingProgress({ user: userId });
  }

  const pid = (problem._id as any).toString();

  // Attempted
  const attemptedEntry = progress.attemptedProblems.find(a => String(a.problemId) === pid);
  if (attemptedEntry) {
    attemptedEntry.attemptCount += 1;
    attemptedEntry.lastAttemptAt = now;
  } else {
    progress.attemptedProblems.push({ problemId: problem._id, lastAttemptAt: now, attemptCount: 1 } as any);
  }

  // Solved (once)
  const alreadySolved = progress.solvedProblems.some(s => String(s.problemId) === pid);
  if (accepted && !alreadySolved) {
    progress.solvedProblems.push({ problemId: problem._id, solvedAt: now } as any);
  }

  // Topic stats
  let topic = progress.topicStats.find(t => t.topic === problem.category);
  if (!topic) {
    progress.topicStats.push({ topic: problem.category, solved: 0, attempted: 0, averageScore: 0 } as any);
    topic = progress.topicStats[progress.topicStats.length - 1];
  }
  topic.attempted += 1;
  if (accepted && !alreadySolved) topic.solved += 1;
  if (score != null) {
    const totalScore = topic.averageScore * (topic.attempted - 1) + score;
    topic.averageScore = Math.round(totalScore / topic.attempted);
  }
  topic.lastPracticedAt = now;

  // Difficulty stats
  let diff = progress.difficultyStats.find(d => d.difficulty === problem.difficulty);
  if (!diff) {
    progress.difficultyStats.push({ difficulty: problem.difficulty, solved: 0, attempted: 0 } as any);
    diff = progress.difficultyStats[progress.difficultyStats.length - 1];
  }
  diff.attempted += 1;
  if (accepted && !alreadySolved) diff.solved += 1;

  // Streak
  const last = progress.streak.lastActiveDate ? new Date(progress.streak.lastActiveDate) : null;
  const lastDay = last ? new Date(last.getFullYear(), last.getMonth(), last.getDate()) : null;
  if (!lastDay || lastDay.getTime() !== today.getTime()) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (lastDay && lastDay.getTime() === yesterday.getTime()) {
      progress.streak.current += 1;
    } else {
      progress.streak.current = 1;
    }
    progress.streak.longest = Math.max(progress.streak.longest, progress.streak.current);
    progress.streak.lastActiveDate = today;
  }

  // Totals
  progress.totalSubmissions += 1;
  if (accepted) progress.acceptedSubmissions += 1;

  // Average score (only scored submissions)
  if (score != null) {
    const scoredCount = progress.averageCodingScore > 0 ? progress.totalSubmissions : 1;
    progress.averageCodingScore = Math.round(
      (progress.averageCodingScore * (scoredCount - 1) + score) / scoredCount
    );
  }

  // Language usage
  let lang = progress.languageUsage.find(l => l.language === language);
  if (!lang) {
    progress.languageUsage.push({ language, count: 0 } as any);
    lang = progress.languageUsage[progress.languageUsage.length - 1];
  }
  lang.count += 1;

  // Recent activity (last 28 days buckets)
  let day = progress.recentActivity.find(a => {
    const d = new Date(a.date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === today.getTime();
  });
  if (!day) {
    progress.recentActivity.push({ date: today, submissions: 1 } as any);
  } else {
    day.submissions += 1;
  }
  if (progress.recentActivity.length > 28) {
    progress.recentActivity = progress.recentActivity.slice(-28);
  }

  // ── Complexity-optimization analytics (Part A, spec §11) ─────────────────
  // Counted from the deterministic comparison stored on this submission.
  if (optimization) {
    if (!progress.complexityStats) {
      progress.complexityStats = { tracked: 0, efficient: 0, optimizable: 0, clearOpportunities: 0, unknown: 0, byTopic: [] } as any;
    }
    const stats = progress.complexityStats as any;
    if (optimization.level !== 'UNKNOWN') {
      stats.tracked += 1;
      if (optimization.level === 'OPTIMAL') stats.efficient += 1;
      else if (optimization.level === 'POSSIBLY_IMPROVABLE') stats.optimizable += 1;
      else if (optimization.level === 'CLEAR_OPTIMIZATION_OPPORTUNITY') {
        stats.optimizable += 1;
        stats.clearOpportunities += 1;
      }
    } else {
      stats.unknown += 1;
    }

    let topicEntry = stats.byTopic.find((t: any) => t.topic === problem.category);
    if (!topicEntry) {
      stats.byTopic.push({ topic: problem.category, tracked: 0, efficient: 0, optimizable: 0, unknown: 0 });
      topicEntry = stats.byTopic[stats.byTopic.length - 1];
    }
    if (optimization.level === 'UNKNOWN') topicEntry.unknown += 1;
    else {
      topicEntry.tracked += 1;
      if (optimization.level === 'OPTIMAL') topicEntry.efficient += 1;
      else topicEntry.optimizable += 1;
    }
  }

  await progress.save();
}

function unavailableAst(): IAstAnalysis {
  return {
    parseSuccess: false,
    parser: 'none',
    language: 'python',
    reason: 'AST analysis unavailable.',
    metrics: {
      statements: 0, functions: 0, maxFunctionLines: 0, loops: 0, nestedLoopDepth: 0,
      conditionals: 0, switches: 0, maxNestingDepth: 0, recursionDetected: false,
      breaks: 0, continues: 0, returns: 0, variableDeclarations: 0, functionCalls: 0, tryCatch: 0,
    },
    dataStructures: [], patterns: [],
    approach: { detectedApproach: 'UNKNOWN', confidence: 0, evidence: [], secondaryApproaches: [], dataStructures: [] },
    complexity: { estimatedTime: 'Unknown', estimatedSpace: 'Unknown', confidence: 0, evidence: [] },
    quality: { modularity: 0, structuralReadability: 0, excessiveNesting: false, largeFunctionDetected: false, issues: [] },
  };
}

function zeroScore() {
  return {
    correctness: 0, efficiency: 0, codeQuality: 0, problemSolving: 0, maintainability: 0,
    overall: 0, astAvailable: false,
  };
}

export const codingSubmissionsController = new CodingSubmissionsController();
