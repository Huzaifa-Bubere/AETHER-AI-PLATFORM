import { create } from 'zustand';
import adaptiveInterviewApi, {
  AnswerFeedback, ClientQuestion, PlanItem,
} from '../lib/adaptiveInterviewApi';

export type Phase = 'idle' | 'creating' | 'active' | 'evaluating' | 'ended';

interface AdaptiveState {
  sessionId: string | null;
  domain: string;
  difficulty: string;
  plannedQuestions: number;
  plan: PlanItem[];
  question: ClientQuestion | null;
  lastFeedback: AnswerFeedback | null;
  answeredCount: number;
  phase: Phase;
  creating: boolean;
  submitting: boolean;
  ending: boolean;
  error: string | null;
  startedAt: number | null;
  lastAdaptReason: string | null;

  createSession: (p: { domain: string; role: string; difficulty: string; questionCount: number }) => Promise<string | null>;
  resumeSession: (sessionId: string) => Promise<void>;
  submitAnswer: (answer: string, durationSeconds: number) => Promise<boolean>;
  endInterview: (terminationReason?: 'INTEGRITY_WARNING_LIMIT') => Promise<string | null>;
  reset: () => void;
}

const empty = {
  sessionId: null, domain: '', difficulty: 'medium', plannedQuestions: 0, plan: [],
  question: null, lastFeedback: null, answeredCount: 0, phase: 'idle' as Phase,
  creating: false, submitting: false, ending: false, error: null,
  startedAt: null, lastAdaptReason: null,
};

export const useAdaptiveInterviewStore = create<AdaptiveState>((set, get) => ({
  ...empty,

  createSession: async ({ domain, role, difficulty, questionCount }) => {
    set({ ...empty, creating: true, phase: 'creating' });
    try {
      const data = await adaptiveInterviewApi.createSession({ domain, role, difficulty, questionCount });
      set({
        sessionId: data.sessionId, domain: data.domain, difficulty: data.difficulty,
        plannedQuestions: data.plannedQuestions, plan: data.plan,
        question: data.question, phase: 'active', creating: false,
        startedAt: Date.now(), answeredCount: 0, error: null,
      });
      return data.sessionId as string;
    } catch (e: any) {
      set({ creating: false, phase: 'idle', error: e?.response?.data?.message || e.message || 'Failed to create interview' });
      return null;
    }
  },

  resumeSession: async (sessionId) => {
    set({ ...empty, phase: 'creating', creating: true, sessionId });
    try {
      const data = await adaptiveInterviewApi.getSession(sessionId);
      set({
        sessionId, domain: data.domain, difficulty: data.difficulty,
        plannedQuestions: data.plannedQuestions, plan: data.plan,
        question: data.question, answeredCount: data.answeredCount || 0,
        lastFeedback: data.lastFeedback
          ? {
              scores: data.lastFeedback.scores, overallScore: data.lastFeedback.overallScore,
              verdict: data.lastFeedback.verdict, strengths: data.lastFeedback.strengths,
              improvements: data.lastFeedback.improvements,
              matchedKeywords: data.lastFeedback.matchedKeywords || [],
              aiSummary: data.lastFeedback.aiSummary,
            }
          : null,
        phase: data.status === 'in-progress' ? 'active' : 'ended',
        creating: false, startedAt: Date.now(), error: null,
      });
    } catch (e: any) {
      set({ creating: false, phase: 'idle', error: e?.response?.data?.message || e.message || 'Failed to resume interview' });
    }
  },

  submitAnswer: async (answer, durationSeconds) => {
    const { sessionId, question } = get();
    if (!sessionId || !question || get().submitting) return false;
    set({ submitting: true, phase: 'evaluating', error: null });
    try {
      const data = await adaptiveInterviewApi.submitAnswer(sessionId, {
        questionId: question.id, answer, durationSeconds,
      });
      set({
        lastFeedback: data.feedback, question: data.nextQuestion,
        answeredCount: data.answeredCount, phase: data.completed ? 'ended' : 'active',
        submitting: false, lastAdaptReason: data.reason || null,
      });
      return true;
    } catch (e: any) {
      set({ submitting: false, phase: 'active', error: e?.response?.data?.message || e?.response?.data?.error || e.message || 'Failed to submit answer' });
      return false;
    }
  },

  endInterview: async (terminationReason?: 'INTEGRITY_WARNING_LIMIT') => {
    const { sessionId } = get();
    if (!sessionId) return null;
    set({ ending: true, error: null });
    try {
      await adaptiveInterviewApi.endInterview(sessionId, terminationReason);
      set({ phase: 'ended', ending: false });
      return sessionId;
    } catch (e: any) {
      set({ ending: false, error: e?.response?.data?.message || e.message || 'Failed to end interview' });
      return null;
    }
  },

  reset: () => set({ ...empty }),
}));
