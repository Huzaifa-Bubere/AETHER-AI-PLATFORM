import {
  InterviewStage,
  DifficultyLevel,
  IInteraction,
  IAnswerEvaluation,
  IAdaptiveDecision,
  ICandidateContext,
} from '../types';
import logger from '../../utils/logger';

export class AdaptiveInterviewEngine {
  private readonly stageSequence: InterviewStage[] = [
    'INTRODUCTION',
    'TECHNICAL_FOUNDATION',
    'PROJECT_DEEP_DIVE',
    'PROBLEM_SOLVING',
    'SYSTEM_DESIGN',
    'BEHAVIORAL',
    'CLOSING',
    'COMPLETED',
  ];

  /**
   * Determine the next interview action given the current session state and last evaluation.
   */
  decideNextStep(params: {
    candidateContext: ICandidateContext;
    currentStage: InterviewStage;
    currentTopic: string;
    currentDifficulty: DifficultyLevel;
    interactions: IInteraction[];
    lastEvaluation: IAnswerEvaluation;
    plannedQuestions: number;
    allTopics: string[];
  }): IAdaptiveDecision {
    const {
      candidateContext,
      currentStage,
      currentTopic,
      currentDifficulty,
      interactions,
      lastEvaluation,
      plannedQuestions,
      allTopics,
    } = params;

    const totalAnswered = interactions.filter(i => !!i.answer).length;

    // Check if interview should finish
    if (totalAnswered >= plannedQuestions || currentStage === 'CLOSING' || lastEvaluation.finishInterview) {
      return {
        action: 'FINISH_INTERVIEW',
        nextStage: 'COMPLETED',
        nextTopic: currentTopic,
        nextDifficulty: currentDifficulty,
        reason: 'Target interview question limit reached or closing stage concluded.',
      };
    }

    const lastInteraction = interactions[interactions.length - 1];
    const isAdaptiveMode = candidateContext.difficultyMode === 'adaptive';

    // 1. Follow-up check:
    // If the candidate had missing concepts or vague answer, and this question wasn't already a follow-up
    const followUpsForCurrentQuestion = interactions.filter(
      i => i.topic === currentTopic && i.intent?.startsWith('Probe missing concepts')
    ).length;

    if (
      (lastEvaluation.needsFollowUp || (lastEvaluation.conceptsMissing.length > 0 && lastEvaluation.overallScore < 60)) &&
      followUpsForCurrentQuestion < 1 &&
      lastInteraction?.answer
    ) {
      return {
        action: 'FOLLOW_UP',
        nextStage: currentStage,
        nextTopic: currentTopic,
        nextDifficulty: currentDifficulty,
        reason: `Answer left gaps in key concepts (${lastEvaluation.conceptsMissing.slice(0, 2).join(', ')}). Probing deeper.`,
        followUpContext: {
          previousQuestion: lastInteraction.question,
          previousAnswer: lastInteraction.answer,
          missingConcepts: lastEvaluation.conceptsMissing,
        },
      };
    }

    // 2. Dynamic Difficulty Adjustment (if in Adaptive mode)
    let nextDifficulty = currentDifficulty;
    if (isAdaptiveMode) {
      if (lastEvaluation.technicalDepth >= 80 && lastEvaluation.correctness >= 75) {
        if (currentDifficulty === 'easy') nextDifficulty = 'medium';
        else if (currentDifficulty === 'medium') nextDifficulty = 'hard';
      } else if (lastEvaluation.correctness < 45 || lastEvaluation.technicalDepth < 40) {
        if (currentDifficulty === 'hard') nextDifficulty = 'medium';
        else if (currentDifficulty === 'medium') nextDifficulty = 'easy';
      }
    }

    // 3. Stage & Topic Progression Logic
    const questionsInCurrentStage = interactions.filter(i => i.stage === currentStage).length;
    const questionsInCurrentTopic = interactions.filter(i => i.topic === currentTopic).length;

    // Introduction: usually 1 question
    if (currentStage === 'INTRODUCTION' && questionsInCurrentStage >= 1) {
      const nextTopic = allTopics[0] || 'Core Engineering Fundamentals';
      return {
        action: 'CHANGE_STAGE',
        nextStage: 'TECHNICAL_FOUNDATION',
        nextTopic,
        nextDifficulty,
        reason: 'Introduction concluded. Moving into technical foundation.',
      };
    }

    // Move to next stage if sufficient questions in current stage
    const shouldAdvanceStage =
      (currentStage === 'TECHNICAL_FOUNDATION' && questionsInCurrentStage >= Math.max(2, Math.floor(plannedQuestions * 0.35))) ||
      (currentStage === 'PROJECT_DEEP_DIVE' && questionsInCurrentStage >= Math.max(1, Math.floor(plannedQuestions * 0.25))) ||
      (currentStage === 'PROBLEM_SOLVING' && questionsInCurrentStage >= Math.max(1, Math.floor(plannedQuestions * 0.2))) ||
      (currentStage === 'SYSTEM_DESIGN' && questionsInCurrentStage >= 1) ||
      (currentStage === 'BEHAVIORAL' && questionsInCurrentStage >= 1);

    if (shouldAdvanceStage) {
      const currentStageIdx = this.stageSequence.indexOf(currentStage);
      let nextStage = this.stageSequence[currentStageIdx + 1] || 'CLOSING';

      // Skip system design for junior or behavioral-only roles
      if (
        nextStage === 'SYSTEM_DESIGN' &&
        (candidateContext.experienceLevel.toLowerCase().includes('junior') ||
          candidateContext.experienceLevel.toLowerCase().includes('fresher') ||
          candidateContext.interviewType === 'behavioral' ||
          candidateContext.interviewType === 'hr')
      ) {
        nextStage = 'BEHAVIORAL';
      }

      // Skip behavioral if purely technical
      if (nextStage === 'BEHAVIORAL' && candidateContext.interviewType === 'technical' && totalAnswered < plannedQuestions - 1) {
        // Can stay in technical/problem solving or move to closing
      }

      const nextTopicIndex = allTopics.findIndex(t => t === currentTopic) + 1;
      const nextTopic = allTopics[nextTopicIndex] || (nextStage === 'BEHAVIORAL' ? 'Behavioral & Engineering Ownership' : currentTopic);

      return {
        action: 'CHANGE_STAGE',
        nextStage,
        nextTopic,
        nextDifficulty,
        reason: `Stage ${currentStage} completed with sufficient evidence. Advancing to ${nextStage}.`,
      };
    }

    // Change topic within stage if 2 questions covered in current topic
    if (questionsInCurrentTopic >= 2 || lastEvaluation.moveToNextTopic) {
      const currentTopicIdx = allTopics.indexOf(currentTopic);
      const nextTopic = (currentTopicIdx !== -1 && allTopics[currentTopicIdx + 1]) ? allTopics[currentTopicIdx + 1] : allTopics[0];

      return {
        action: 'CHANGE_TOPIC',
        nextStage: currentStage,
        nextTopic,
        nextDifficulty,
        reason: `Collected enough evidence on ${currentTopic}. Switching to ${nextTopic}.`,
      };
    }

    // Default: Next question on same topic
    return {
      action: nextDifficulty !== currentDifficulty ? (nextDifficulty > currentDifficulty ? 'INCREASE_DIFFICULTY' : 'DECREASE_DIFFICULTY') : 'NEXT_QUESTION_SAME_TOPIC',
      nextStage: currentStage,
      nextTopic: currentTopic,
      nextDifficulty,
      reason: `Continuing evaluation in ${currentTopic} at difficulty ${nextDifficulty}.`,
    };
  }
}

export const adaptiveInterviewEngine = new AdaptiveInterviewEngine();
