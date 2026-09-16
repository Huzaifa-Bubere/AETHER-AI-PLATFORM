import { Request, Response } from 'express';
import CodingProblem from '../models/CodingProblem';
import CodingSubmission from '../models/CodingSubmission';
import CodingProgress from '../models/CodingProgress';
import { codingExecutionService } from '../services/execution.service';
import { analyzeSource } from '../ast/AstAnalyzer';
import { computeScore } from '../scoring/scoring.service';
import { codingExplanationService } from '../services/explanation.service';
import { isCodingLanguage, IAstAnalysis, IExecutionResult } from '../types/coding.types';
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
            expectedTime: problem.expectedTimeComplexity,
            expectedSpace: problem.expectedSpaceComplexity,
          },
        });
        await CodingSubmission.updateOne({ _id: submission._id }, { $set: { explanation } });
      } catch (explainErr) {
        logger.warn('Explanation generation failed; submission result unaffected');
      }

      // 6. Update progress + platform analytics
      try {
        await updateProgress(userId, problem as any, exec, language, score?.overall ?? null);
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

// ── Progress update helper ───────────────────────────────────────────────────

async function updateProgress(
  userId: string,
  problem: any,
  exec: IExecutionResult,
  language: string,
  score: number | null
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
