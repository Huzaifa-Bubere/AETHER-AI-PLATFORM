import {
  ICandidateContext,
  IQuestionIntent,
  InterviewStage,
  DifficultyLevel,
  IInteraction,
} from '../types';
import { InterviewPrompts } from '../prompts';
import { geminiInterviewService } from './geminiInterview.service';

export class QuestionAgent {
  /**
   * Generate exactly ONE contextual question tailored to candidate, stage, topic, and difficulty.
   */
  async generateQuestion(params: {
    candidateContext: ICandidateContext;
    stage: InterviewStage;
    topic: string;
    difficulty: DifficultyLevel;
    previousInteractions: IInteraction[];
    followUpContext?: {
      previousQuestion: string;
      previousAnswer: string;
      missingConcepts: string[];
    };
  }): Promise<IQuestionIntent> {
    const { candidateContext, stage, topic, difficulty, previousInteractions, followUpContext } = params;

    const prompt = InterviewPrompts.generateQuestionPrompt({
      candidateContext,
      stage,
      topic,
      difficulty,
      previousInteractions,
      followUpContext,
    });

    const validator = (data: any): data is IQuestionIntent => {
      return (
        data &&
        typeof data.question === 'string' &&
        data.question.trim().length > 10 &&
        typeof data.intent === 'string' &&
        typeof data.topic === 'string' &&
        Array.isArray(data.expectedConcepts) &&
        data.expectedConcepts.length > 0
      );
    };

    const fallback = (): IQuestionIntent => {
      return this.heuristicFallback(stage, topic, difficulty, followUpContext);
    };

    return geminiInterviewService.generateStructured<IQuestionIntent>(prompt, validator, fallback);
  }

  /**
   * Safe fallback questions when external AI is temporarily offline.
   */
  private heuristicFallback(
    stage: InterviewStage,
    topic: string,
    difficulty: DifficultyLevel,
    followUpContext?: {
      previousQuestion: string;
      previousAnswer: string;
      missingConcepts: string[];
    }
  ): IQuestionIntent {
    if (followUpContext && followUpContext.missingConcepts.length > 0) {
      const missed = followUpContext.missingConcepts.slice(0, 2).join(' and ');
      return {
        question: `You discussed your approach, but could you elaborate specifically on how you would handle ${missed}? What are the architectural trade-offs?`,
        intent: `Probe missing concepts: ${missed}`,
        topic,
        difficulty,
        stage,
        expectedConcepts: followUpContext.missingConcepts,
        basedOnPreviousAnswer: true,
      };
    }

    if (stage === 'INTRODUCTION') {
      return {
        question: `Could you introduce yourself, highlight your key technical background, and tell me about a recent engineering project you are most proud of?`,
        intent: 'Assess background, engineering passion, and communication structure',
        topic: 'Professional Introduction & Background',
        difficulty: 'easy',
        stage: 'INTRODUCTION',
        expectedConcepts: ['technical background', 'project overview', 'architecture role', 'key technologies'],
      };
    }

    if (stage === 'BEHAVIORAL' || stage === 'CLOSING') {
      return {
        question: `Tell me about a time when you faced a challenging technical disagreement or production incident in a project. How did you resolve it?`,
        intent: 'Evaluate conflict resolution and engineering ownership',
        topic: 'Engineering Collaboration & Incident Response',
        difficulty: 'medium',
        stage,
        expectedConcepts: ['STAR method', 'communication', 'root cause', 'post-mortem', 'team alignment'],
      };
    }

    return {
      question: `In the context of ${topic}, how would you design a scalable solution considering performance, error handling, and maintainability?`,
      intent: `Assess technical foundation in ${topic}`,
      topic,
      difficulty,
      stage,
      expectedConcepts: ['design principles', 'trade-offs', 'edge cases', 'reliability'],
    };
  }
}

export const questionAgent = new QuestionAgent();
