import { Types } from 'mongoose';

export type InterviewStage =
  | 'INTRODUCTION'
  | 'TECHNICAL_FOUNDATION'
  | 'PROJECT_DEEP_DIVE'
  | 'PROBLEM_SOLVING'
  | 'SYSTEM_DESIGN'
  | 'BEHAVIORAL'
  | 'CLOSING'
  | 'COMPLETED';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type DifficultyMode = 'easy' | 'medium' | 'hard' | 'adaptive';

export type InterviewType =
  | 'technical'
  | 'behavioral'
  | 'hr'
  | 'system-design'
  | 'mixed'
  | 'coding';

export type AnswerSource = 'voice' | 'text';

export type ProctorEventType =
  | 'tab-switch'
  | 'window-blur'
  | 'copy-attempt'
  | 'paste-attempt'
  | 'screenshot-key'
  | 'devtools-shortcut'
  | 'fullscreen-exit'
  | 'camera-off'
  | 'mic-off'
  | 'face-missing'
  | 'multiple-faces'
  | 'no-face-long';

export interface IProctorEvent {
  type: ProctorEventType;
  timestamp: Date;
  details?: string;
}

export interface ICandidateContext {
  userId: string;
  role: string;
  experienceLevel: string;
  interviewType: InterviewType;
  difficultyMode: DifficultyMode;
  company?: string;
  language?: string;
  resumeContext?: {
    summary?: string;
    skills: string[];
    experienceYears?: number;
    education?: string[];
    projects?: Array<{
      name?: string;
      description?: string;
      technologies?: string[];
    }>;
  };
  jobDescription?: string;
  jobRequirements?: string[];
}

export interface IQuestionIntent {
  question: string;
  intent: string;
  topic: string;
  difficulty: DifficultyLevel;
  stage: InterviewStage;
  expectedConcepts: string[];
  basedOnPreviousAnswer?: boolean;
}

export interface IAnswerEvaluation {
  correctness: number; // 0-100
  technicalDepth: number; // 0-100
  relevance: number; // 0-100
  clarity: number; // 0-100
  communication: number; // 0-100
  overallScore: number; // 0-100

  conceptsCovered: string[];
  conceptsMissing: string[];

  strengths: string[];
  weaknesses: string[];

  needsFollowUp: boolean;
  moveToNextTopic: boolean;
  increaseDifficulty: boolean;
  decreaseDifficulty: boolean;
  finishInterview: boolean;

  recommendedNextTopic?: string;
  currentInterviewStage: InterviewStage;
  suggestedFollowUpTopic?: string;
  feedbackSummary: string;
  suggestedAnswerImprovement?: string;
}

export interface IInteraction {
  id: string;
  question: string;
  intent: string;
  topic: string;
  difficulty: DifficultyLevel;
  stage: InterviewStage;
  expectedConcepts: string[];

  answer?: string;
  answerSource?: AnswerSource;
  startedAt: Date;
  answeredAt?: Date;
  responseTimeSeconds?: number;

  evaluation?: IAnswerEvaluation;
}

export interface IDifficultyProgression {
  topic: string;
  difficulty: DifficultyLevel;
  score: number;
  stage: InterviewStage;
  timestamp: Date;
}

export interface ITopicScore {
  topic: string;
  score: number;
  questionsCount: number;
}

export interface IExplainableEvidence {
  dimension: 'technical' | 'communication' | 'problemSolving' | 'roleReadiness';
  score: number;
  justification: string[];
}

export interface IFinalAssessment {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  roleReadinessScore: number;

  topicScores: ITopicScore[];
  strengths: string[];
  weaknesses: string[];
  skillGaps: string[];
  recommendedPractice: string[];
  summary: string;
  careerRecommendations: string[];

  explainableEvidence: IExplainableEvidence[];
  generatedAt: Date;
  source: 'ai' | 'heuristic';
}

export type AdaptiveAction =
  | 'FOLLOW_UP'
  | 'NEXT_QUESTION_SAME_TOPIC'
  | 'INCREASE_DIFFICULTY'
  | 'DECREASE_DIFFICULTY'
  | 'CHANGE_TOPIC'
  | 'CHANGE_STAGE'
  | 'FINISH_INTERVIEW';

export interface IAdaptiveDecision {
  action: AdaptiveAction;
  nextStage: InterviewStage;
  nextTopic: string;
  nextDifficulty: DifficultyLevel;
  reason: string;
  followUpContext?: {
    previousQuestion: string;
    previousAnswer: string;
    missingConcepts: string[];
  };
}
