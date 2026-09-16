import {
  ICandidateContext,
  IQuestionIntent,
  IAnswerEvaluation,
  InterviewStage,
} from '../types';
import { InterviewPrompts } from '../prompts';
import { geminiInterviewService } from './geminiInterview.service';

export class EvaluationAgent {
  /**
   * Evaluate a candidate answer against expected concepts, intent, and stage.
   */
  async evaluate(params: {
    candidateContext: ICandidateContext;
    question: IQuestionIntent;
    answer: string;
    stage: InterviewStage;
    responseTimeSeconds?: number;
  }): Promise<IAnswerEvaluation> {
    const { candidateContext, question, answer, stage, responseTimeSeconds } = params;

    // Handle empty answer immediately
    if (!answer || !answer.trim()) {
      return {
        correctness: 0,
        technicalDepth: 0,
        relevance: 0,
        clarity: 0,
        communication: 0,
        overallScore: 0,
        conceptsCovered: [],
        conceptsMissing: question.expectedConcepts || [],
        strengths: [],
        weaknesses: ['No answer was provided.'],
        needsFollowUp: false,
        moveToNextTopic: true,
        increaseDifficulty: false,
        decreaseDifficulty: true,
        finishInterview: false,
        currentInterviewStage: stage,
        feedbackSummary: 'Question was skipped or left blank.',
        suggestedAnswerImprovement: 'A strong answer would address the fundamental principles directly.',
      };
    }

    const prompt = InterviewPrompts.evaluateAnswerPrompt({
      candidateContext,
      question,
      answer,
      stage,
      responseTimeSeconds,
    });

    const validator = (data: any): data is IAnswerEvaluation => {
      return (
        data &&
        typeof data.correctness === 'number' &&
        typeof data.technicalDepth === 'number' &&
        typeof data.relevance === 'number' &&
        typeof data.clarity === 'number' &&
        typeof data.communication === 'number' &&
        Array.isArray(data.conceptsCovered) &&
        Array.isArray(data.conceptsMissing)
      );
    };

    const fallback = (): IAnswerEvaluation => {
      return this.heuristicEvaluation(question, answer, stage);
    };

    return geminiInterviewService.generateStructured<IAnswerEvaluation>(prompt, validator, fallback);
  }

  /**
   * Safe deterministic heuristic evaluation when external AI is temporarily offline.
   */
  private heuristicEvaluation(
    question: IQuestionIntent,
    answer: string,
    stage: InterviewStage
  ): IAnswerEvaluation {
    const words = answer.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lower = answer.toLowerCase();

    const expected = question.expectedConcepts || [];
    const covered = expected.filter(concept => lower.includes(concept.toLowerCase()));
    const missing = expected.filter(concept => !covered.includes(concept));

    const keywordRatio = expected.length > 0 ? covered.length / expected.length : 0.5;
    const lengthScore = Math.min(100, (wordCount / 80) * 100);
    const hasStructure = /(first|second|then|finally|because|therefore|for example|such as)/i.test(answer);
    const hasExample = /(in my experience|project|implemented|used|built|created)/i.test(answer);

    const correctness = Math.max(10, Math.min(100, Math.round(keywordRatio * 75 + (wordCount > 30 ? 25 : 10))));
    const technicalDepth = Math.max(10, Math.min(100, Math.round(lengthScore * 0.5 + (hasExample ? 25 : 5) + (hasStructure ? 20 : 5))));
    const relevance = Math.max(20, Math.min(100, Math.round(keywordRatio * 60 + (wordCount >= 20 ? 40 : 20))));
    const clarity = Math.max(20, Math.min(100, Math.round(hasStructure ? 85 : 65)));
    const communication = Math.max(20, Math.min(100, Math.round(Math.min(100, wordCount * 1.2) + (hasStructure ? 15 : 0))));

    const overallScore = Math.round(
      correctness * 0.35 + technicalDepth * 0.3 + relevance * 0.15 + clarity * 0.1 + communication * 0.1
    );

    const needsFollowUp = missing.length > 0 && overallScore < 65 && wordCount > 15;
    const increaseDifficulty = overallScore >= 80;
    const decreaseDifficulty = overallScore < 45;

    return {
      correctness,
      technicalDepth,
      relevance,
      clarity,
      communication,
      overallScore,
      conceptsCovered: covered,
      conceptsMissing: missing,
      strengths: covered.length > 0 ? [`Addressed core ideas: ${covered.join(', ')}`] : ['Attempted response.'],
      weaknesses: missing.length > 0 ? [`Did not cover: ${missing.join(', ')}`] : ['Could provide deeper implementation detail.'],
      needsFollowUp,
      moveToNextTopic: !needsFollowUp && overallScore >= 60,
      increaseDifficulty,
      decreaseDifficulty,
      finishInterview: false,
      currentInterviewStage: stage,
      feedbackSummary: `Candidate answered in ${wordCount} words, covering ${covered.length}/${expected.length || 1} key concepts.`,
      suggestedAnswerImprovement: `An ideal response would explicitly discuss ${missing.slice(0, 2).join(' and ')} with concrete engineering trade-offs.`,
    };
  }
}

export const evaluationAgent = new EvaluationAgent();
