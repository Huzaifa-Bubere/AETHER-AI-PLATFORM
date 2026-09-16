import {
  ICandidateContext,
  IInteraction,
  IFinalAssessment,
  ITopicScore,
} from '../types';
import { InterviewPrompts } from '../prompts';
import { geminiInterviewService } from './geminiInterview.service';

export class FinalAssessmentAgent {
  /**
   * Produce an Explainable AI Final Assessment report across all interview evidence.
   */
  async generateAssessment(params: {
    candidateContext: ICandidateContext;
    interactions: IInteraction[];
    difficultyProgression: any[];
    integritySummary?: {
      totalWarnings: number;
      events: string[];
    };
  }): Promise<IFinalAssessment> {
    const { candidateContext, interactions, difficultyProgression, integritySummary } = params;

    const prompt = InterviewPrompts.finalAssessmentPrompt({
      candidateContext,
      interactions,
      difficultyProgression,
      integritySummary,
    });

    const validator = (data: any): data is IFinalAssessment => {
      return (
        data &&
        typeof data.overallScore === 'number' &&
        typeof data.technicalScore === 'number' &&
        typeof data.communicationScore === 'number' &&
        typeof data.problemSolvingScore === 'number' &&
        typeof data.roleReadinessScore === 'number' &&
        Array.isArray(data.topicScores) &&
        Array.isArray(data.strengths) &&
        Array.isArray(data.weaknesses) &&
        Array.isArray(data.skillGaps)
      );
    };

    const fallback = (): IFinalAssessment => {
      return this.heuristicAssessment(candidateContext, interactions);
    };

    const assessment = await geminiInterviewService.generateStructured<IFinalAssessment>(
      prompt,
      validator,
      fallback
    );

    assessment.generatedAt = new Date();
    return assessment;
  }

  /**
   * Deterministic evidence-backed assessment fallback.
   */
  private heuristicAssessment(
    candidateContext: ICandidateContext,
    interactions: IInteraction[]
  ): IFinalAssessment {
    const evaluated = interactions.filter(i => !!i.evaluation);

    // Compute averages from evaluations
    let totalCorrectness = 0;
    let totalDepth = 0;
    let totalCommunication = 0;
    let totalRelevance = 0;

    const topicMap = new Map<string, { total: number; count: number }>();
    const allStrengths: string[] = [];
    const allWeaknesses: string[] = [];
    const allMissing: string[] = [];

    for (const item of evaluated) {
      const e = item.evaluation!;
      totalCorrectness += e.correctness;
      totalDepth += e.technicalDepth;
      totalCommunication += e.communication;
      totalRelevance += e.relevance;

      if (!topicMap.has(item.topic)) {
        topicMap.set(item.topic, { total: 0, count: 0 });
      }
      const t = topicMap.get(item.topic)!;
      t.total += e.overallScore;
      t.count += 1;

      if (e.strengths?.length) allStrengths.push(...e.strengths);
      if (e.weaknesses?.length) allWeaknesses.push(...e.weaknesses);
      if (e.conceptsMissing?.length) allMissing.push(...e.conceptsMissing);
    }

    const count = evaluated.length || 1;
    const technicalScore = Math.round((totalCorrectness * 0.5 + totalDepth * 0.5) / count);
    const communicationScore = Math.round(totalCommunication / count);
    const problemSolvingScore = Math.round((totalDepth * 0.6 + totalRelevance * 0.4) / count);
    const roleReadinessScore = Math.round(
      technicalScore * 0.45 + communicationScore * 0.25 + problemSolvingScore * 0.3
    );
    const overallScore = Math.round(
      technicalScore * 0.4 + communicationScore * 0.25 + problemSolvingScore * 0.25 + roleReadinessScore * 0.1
    );

    const topicScores: ITopicScore[] = Array.from(topicMap.entries()).map(([topic, data]) => ({
      topic,
      score: Math.round(data.total / data.count),
      questionsCount: data.count,
    }));

    const uniqueWeaknesses = Array.from(new Set(allWeaknesses)).slice(0, 5);
    const uniqueMissing = Array.from(new Set(allMissing)).slice(0, 5);

    return {
      overallScore: Math.min(100, Math.max(10, overallScore)),
      technicalScore: Math.min(100, Math.max(10, technicalScore)),
      communicationScore: Math.min(100, Math.max(10, communicationScore)),
      problemSolvingScore: Math.min(100, Math.max(10, problemSolvingScore)),
      roleReadinessScore: Math.min(100, Math.max(10, roleReadinessScore)),
      topicScores,
      strengths: Array.from(new Set(allStrengths)).slice(0, 5),
      weaknesses: uniqueWeaknesses.length ? uniqueWeaknesses : ['Could elaborate on edge cases in architecture.'],
      skillGaps: uniqueMissing.length ? uniqueMissing : ['Advanced system reliability & optimization strategies.'],
      recommendedPractice: [
        `Review fundamental and advanced concepts in ${topicScores[0]?.topic || candidateContext.role}.`,
        'Practice verbal mock interviews using STAR methodology for behavioral and system architecture questions.',
        'Deepen explanation of performance trade-offs and caching mechanisms.',
      ],
      summary: `Candidate demonstrated solid foundational understanding for ${candidateContext.role}. Technical score was ${technicalScore}/100 with communication at ${communicationScore}/100. Overall readiness is at ${overallScore}/100.`,
      careerRecommendations: [
        `Target junior to mid-level ${candidateContext.role} openings with focus on core domain fundamentals.`,
        'Build and document portfolio projects showcasing database indexing, API rate limiting, and testing.',
      ],
      explainableEvidence: [
        {
          dimension: 'technical',
          score: technicalScore,
          justification: [
            `Evaluated on ${count} technical questions across ${topicScores.length} domains.`,
            `Average technical depth scored at ${Math.round(totalDepth / count)}/100.`,
          ],
        },
        {
          dimension: 'communication',
          score: communicationScore,
          justification: [
            `Demonstrated structured explanations and clarity scored at ${communicationScore}/100.`,
          ],
        },
        {
          dimension: 'problemSolving',
          score: problemSolvingScore,
          justification: [
            `Answer relevance and trade-off analysis evaluated across real-world interview scenarios.`,
          ],
        },
        {
          dimension: 'roleReadiness',
          score: roleReadinessScore,
          justification: [
            `Composite alignment for ${candidateContext.role} at ${candidateContext.experienceLevel} level.`,
          ],
        },
      ],
      generatedAt: new Date(),
      source: 'heuristic',
    };
  }
}

export const finalAssessmentAgent = new FinalAssessmentAgent();
