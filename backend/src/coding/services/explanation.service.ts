import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../utils/logger';
import {
  IExecutionResult,
  IAstAnalysis,
  IScoreBreakdown,
  IGeminiExplanation,
  IKnownApproach,
} from '../types/coding.types';

/**
 * AETHER Coding — explainable feedback layer.
 *
 * Gemini receives ONLY computed evidence (Judge0 results, AST metrics,
 * approach detection, complexity estimate, score breakdown) and turns it
 * into educational language. It never assigns base scores and never
 * invents deterministic facts. If Gemini fails, coding evaluation still
 * returns complete results with fallback text.
 */

class CodingExplanationService {
  private client: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI | null {
    if (this.client) return this.client;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    try {
      this.client = new GoogleGenerativeAI(key);
      return this.client;
    } catch (err) {
      logger.warn('Gemini client init failed for coding explanations');
      return null;
    }
  }

  async explain(params: {
    problem: { title: string; difficulty: string; category: string };
    execution: Pick<IExecutionResult, 'status' | 'passedTests' | 'totalTests' | 'runtimeMs' | 'memoryKb'>;
    ast: IAstAnalysis;
    score: IScoreBreakdown;
    expected: {
      preferredApproaches: IKnownApproach[];
      expectedTime: string;
      expectedSpace: string;
    };
  }): Promise<IGeminiExplanation> {
    const { problem, execution, ast, score, expected } = params;

    // Deterministic fallback (also used when Gemini is unavailable)
    const fallback = this.buildFallback(problem, execution, ast, score, expected);

    const client = this.getClient();
    if (!client) return fallback;

    try {
      const model = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' });

      const evidence = {
        problem: { title: problem.title, difficulty: problem.difficulty, category: problem.category },
        correctness: { passed: execution.passedTests, total: execution.totalTests, status: execution.status },
        execution: { runtimeMs: execution.runtimeMs, memoryKb: execution.memoryKb },
        ast: {
          parser: ast.parser,
          loops: ast.metrics.loops,
          nestedLoopDepth: ast.metrics.nestedLoopDepth,
          maxNestingDepth: ast.metrics.maxNestingDepth,
          functions: ast.metrics.functions,
          recursion: ast.metrics.recursionDetected,
          dataStructures: ast.dataStructures,
          detectedApproach: ast.approach.detectedApproach,
          approachConfidence: ast.approach.confidence,
          approachEvidence: ast.approach.evidence,
          estimatedTime: ast.complexity.estimatedTime,
          estimatedSpace: ast.complexity.estimatedSpace,
          complexityConfidence: ast.complexity.confidence,
          complexityEvidence: ast.complexity.evidence,
          qualityIssues: ast.quality.issues,
        },
        scores: score,
        expected: {
          preferredApproaches: expected.preferredApproaches.map(a => ({
            name: a.name, approachId: a.approachId, timeComplexity: a.timeComplexity, optimal: a.optimal,
          })),
          expectedTime: expected.expectedTime,
          expectedSpace: expected.expectedSpace,
        },
      };

      const prompt = `You are an expert coding mentor for the AETHER placement platform.
A candidate just submitted a solution. Below is COMPUTED EVIDENCE from real test execution and
programmatic AST analysis. Explain the results educationally.

STRICT RULES:
- Use ONLY the provided evidence. Never invent facts, scores, complexity values, or structures.
- Do NOT recompute or change any score. Scores are final.
- Be encouraging but honest. 2-4 sentences for the summary.
- 2-4 strengths, 2-4 improvements. Keep each a short single sentence.
- If a suggested improvement is clearly supported by the evidence (e.g. detected approach is
  suboptimal vs a known optimal approach), describe it conceptually and compare complexities.
  Otherwise omit the suggestedImprovement field entirely.
- If AST analysis is unavailable, say correctness feedback only and skip structural commentary.

EVIDENCE:
${JSON.stringify(evidence, null, 2)}

Respond with ONLY valid JSON in this exact shape:
{
  "summary": string,
  "strengths": string[],
  "improvements": string[],
  "suggestedImprovement": { "title": string, "description": string, "complexityComparison": string } | undefined
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        summary: String(parsed.summary || fallback.summary),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 5) : fallback.strengths,
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 5) : fallback.improvements,
        suggestedImprovement: parsed.suggestedImprovement
          ? {
              title: String(parsed.suggestedImprovement.title || 'Suggested improvement'),
              description: String(parsed.suggestedImprovement.description || ''),
              complexityComparison: parsed.suggestedImprovement.complexityComparison
                ? String(parsed.suggestedImprovement.complexityComparison)
                : undefined,
            }
          : fallback.suggestedImprovement,
        generatedBy: 'gemini',
      };
    } catch (err: any) {
      logger.warn(`Gemini explanation failed (using fallback): ${err?.message}`);
      return fallback;
    }
  }

  private buildFallback(
    problem: { title: string; difficulty: string; category: string },
    execution: Pick<IExecutionResult, 'status' | 'passedTests' | 'totalTests' | 'runtimeMs' | 'memoryKb'>,
    ast: IAstAnalysis,
    score: IScoreBreakdown,
    expected: { preferredApproaches: IKnownApproach[]; expectedTime: string; expectedSpace: string }
  ): IGeminiExplanation {
    const strengths: string[] = [];
    const improvements: string[] = [];

    if (execution.passedTests === execution.totalTests && execution.totalTests > 0) {
      strengths.push(`All ${execution.totalTests} test cases passed.`);
    } else if (execution.totalTests > 0) {
      improvements.push(`${execution.totalTests - execution.passedTests} of ${execution.totalTests} test cases are still failing.`);
    }

    if (ast.parseSuccess) {
      const detected = ast.approach.detectedApproach;
      const optimalMatch = expected.preferredApproaches.find(a => a.approachId === detected && a.optimal);
      if (detected !== 'UNKNOWN' && optimalMatch) {
        strengths.push(`Your ${optimalMatch.name.toLowerCase()} approach matches the expected optimal strategy.`);
      } else if (detected !== 'UNKNOWN') {
        improvements.push(
          `Your detected approach is ${detected.toLowerCase().replace(/_/g, ' ')}; a preferred approach for this problem is ${expected.preferredApproaches.find(a => a.optimal)?.name || expected.preferredApproaches[0]?.name || 'available in the editorial'}.`
        );
      }
      if (ast.complexity.estimatedTime === expected.expectedTime) {
        strengths.push(`Estimated time complexity ${ast.complexity.estimatedTime} matches the expected ${expected.expectedTime}.`);
      } else if (ast.complexity.estimatedTime !== 'Unknown') {
        improvements.push(`Your estimated time complexity is ${ast.complexity.estimatedTime} versus the expected ${expected.expectedTime}.`);
      }
      for (const issue of ast.quality.issues.slice(0, 2)) {
        improvements.push(issue.recommendation);
      }
    }

    const suggested = ast.parseSuccess &&
      ast.approach.detectedApproach !== 'UNKNOWN' &&
      expected.preferredApproaches.some(a => a.optimal && a.approachId !== ast.approach.detectedApproach)
      ? {
          title: `Consider the ${expected.preferredApproaches.find(a => a.optimal)?.name}`,
          description: expected.preferredApproaches.find(a => a.optimal)?.outline || '',
          complexityComparison: `${ast.complexity.estimatedTime} → ${expected.preferredApproaches.find(a => a.optimal)?.timeComplexity || expected.expectedTime}`,
        }
      : undefined;

    return {
      summary: `You passed ${execution.passedTests}/${execution.totalTests} test cases with an overall score of ${score.overall}/100.${
        ast.parseSuccess ? ` AST analysis detected a ${ast.approach.detectedApproach.replace(/_/g, ' ').toLowerCase()} approach with estimated time complexity ${ast.complexity.estimatedTime}.` : ' AST analysis was unavailable for this submission.'
      }`,
      strengths: strengths.length > 0 ? strengths.slice(0, 4) : ['Submission recorded and evaluated.'],
      improvements: improvements.length > 0 ? improvements.slice(0, 4) : ['Keep practicing to improve your score.'],
      suggestedImprovement: suggested,
      generatedBy: 'fallback',
    };
  }
}

export const codingExplanationService = new CodingExplanationService();
