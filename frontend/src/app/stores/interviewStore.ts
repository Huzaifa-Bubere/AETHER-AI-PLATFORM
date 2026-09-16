import { create } from 'zustand';
import {
  interviewService,
  SetupInterviewPayload,
  ActiveQuestionData,
  AnswerResponseData,
} from '../services/interview';
import toast from 'react-hot-toast';

export type SessionPhase = 'idle' | 'starting' | 'active' | 'evaluating' | 'completed' | 'error';

interface InterviewStoreState {
  interviewId: string | null;
  interviewData: any | null;
  activeQuestion: ActiveQuestionData | null;
  phase: SessionPhase;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // History & Results
  interviews: any[];
  finalAssessment: any | null;
  lastEvaluation: any | null;

  // Speech & Voice states
  isSpeaking: boolean;
  isMuted: boolean;
  isListening: boolean;
  transcript: string;

  // Session stats
  questionsAnswered: number;
  plannedQuestions: number;
  elapsedSeconds: number;

  // Actions
  createInterview: (payload: SetupInterviewPayload) => Promise<string | null>;
  startInterview: (id: string) => Promise<boolean>;
  submitAnswer: (answerText: string, source: 'voice' | 'text', durationSeconds: number) => Promise<AnswerResponseData | null>;
  endInterview: () => Promise<string | null>;
  resumeInterview: (id: string) => Promise<boolean>;
  fetchHistory: (page?: number, limit?: number) => Promise<void>;
  fetchResult: (id: string) => Promise<any>;

  // Speech controls
  speakCurrentQuestion: () => void;
  stopSpeech: () => void;
  toggleMute: () => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  setIsListening: (val: boolean) => void;
  incrementElapsed: () => void;

  // Integrity reporting
  recordIntegrityEvent: (type: string, detail?: string) => Promise<void>;
  reset: () => void;
}

export const useInterviewStore = create<InterviewStoreState>((set, get) => ({
  interviewId: null,
  interviewData: null,
  activeQuestion: null,
  phase: 'idle',
  isLoading: false,
  isSubmitting: false,
  error: null,

  interviews: [],
  finalAssessment: null,
  lastEvaluation: null,

  isSpeaking: false,
  isMuted: false,
  isListening: false,
  transcript: '',

  questionsAnswered: 0,
  plannedQuestions: 6,
  elapsedSeconds: 0,

  createInterview: async (payload: SetupInterviewPayload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await interviewService.createInterview(payload);
      if (res.success && res.data) {
        const id = res.data._id || res.data.id;
        set({
          interviewId: id,
          interviewData: res.data,
          plannedQuestions: res.data.plannedQuestions || payload.plannedQuestions || 6,
          isLoading: false,
        });
        return id;
      }
      throw new Error(res.message || 'Failed to create interview');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Creation failed';
      set({ error: msg, isLoading: false });
      toast.error(msg);
      return null;
    }
  },

  startInterview: async (id: string) => {
    set({ phase: 'starting', isLoading: true, error: null, interviewId: id });
    try {
      const res = await interviewService.startInterview(id);
      if (res.success && res.data) {
        set({
          activeQuestion: res.data,
          phase: 'active',
          isLoading: false,
          questionsAnswered: res.data.totalAnswered || 0,
          plannedQuestions: res.data.plannedQuestions || 6,
          transcript: '',
        });
        get().speakCurrentQuestion();
        return true;
      }
      throw new Error(res.message || 'Failed to start interview');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to start';
      set({ error: msg, phase: 'error', isLoading: false });
      toast.error(msg);
      return false;
    }
  },

  submitAnswer: async (answerText: string, source: 'voice' | 'text', durationSeconds: number) => {
    const { interviewId } = get();
    if (!interviewId) return null;

    get().stopSpeech();
    set({ isSubmitting: true, phase: 'evaluating' });

    try {
      const res = await interviewService.submitAnswer(interviewId, {
        answer: answerText,
        answerSource: source,
        responseTimeSeconds: durationSeconds,
      });

      if (res.success && res.data) {
        if (res.data.finished) {
          set({
            phase: 'completed',
            isSubmitting: false,
            finalAssessment: res.data.finalAssessment,
            lastEvaluation: res.data.evaluation,
            activeQuestion: null,
          });
          return res.data;
        }

        if (res.data.nextQuestion) {
          set({
            activeQuestion: res.data.nextQuestion,
            lastEvaluation: res.data.evaluation,
            phase: 'active',
            isSubmitting: false,
            transcript: '',
            questionsAnswered: res.data.nextQuestion.totalAnswered,
          });
          get().speakCurrentQuestion();
          return res.data;
        }
      }
      throw new Error(res.message || 'Failed to submit answer');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Submission failed';
      set({ error: msg, phase: 'active', isSubmitting: false });
      toast.error(msg);
      return null;
    }
  },

  endInterview: async () => {
    const { interviewId } = get();
    if (!interviewId) return null;

    get().stopSpeech();
    set({ isLoading: true });

    try {
      const res = await interviewService.endInterview(interviewId);
      if (res.success && res.data) {
        set({
          phase: 'completed',
          finalAssessment: res.data.finalAssessment,
          activeQuestion: null,
          isLoading: false,
        });
        return interviewId;
      }
      throw new Error(res.message || 'Failed to end interview');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to end interview';
      set({ error: msg, isLoading: false });
      toast.error(msg);
      return null;
    }
  },

  resumeInterview: async (id: string) => {
    set({ isLoading: true, error: null, interviewId: id });
    try {
      const res = await interviewService.getInterview(id);
      if (res.success && res.data) {
        const interview = res.data;
        if (interview.status === 'completed') {
          set({
            phase: 'completed',
            interviewData: interview,
            finalAssessment: interview.finalAssessment,
            isLoading: false,
          });
          return true;
        }

        if (interview.activeQuestion) {
          set({
            interviewData: interview,
            activeQuestion: interview.activeQuestion,
            phase: 'active',
            isLoading: false,
            questionsAnswered: interview.activeQuestion.totalAnswered || 0,
            plannedQuestions: interview.plannedQuestions || 6,
          });
          get().speakCurrentQuestion();
          return true;
        }

        // If in progress but no active question, call start
        return await get().startInterview(id);
      }
      throw new Error(res.message || 'Interview not found');
    } catch (err: any) {
      set({ error: err.message, phase: 'error', isLoading: false });
      return false;
    }
  },

  fetchHistory: async (page = 1, limit = 10) => {
    set({ isLoading: true });
    try {
      const res = await interviewService.getHistory(page, limit);
      if (res.success) {
        set({ interviews: res.data || [], isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false });
    }
  },

  fetchResult: async (id: string) => {
    set({ isLoading: true });
    try {
      const res = await interviewService.getInterviewResult(id);
      if (res.success && res.data) {
        set({
          finalAssessment: res.data.finalAssessment,
          interviewData: res.data.interview,
          isLoading: false,
        });
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch results');
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  speakCurrentQuestion: () => {
    const { activeQuestion, isMuted } = get();
    if (!activeQuestion?.question || isMuted) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeQuestion.question);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => set({ isSpeaking: true });
      utterance.onend = () => set({ isSpeaking: false });
      utterance.onerror = () => set({ isSpeaking: false });

      window.speechSynthesis.speak(utterance);
    }
  },

  stopSpeech: () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      set({ isSpeaking: false });
    }
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    set({ isMuted: nextMuted });
    if (nextMuted) {
      get().stopSpeech();
    } else {
      get().speakCurrentQuestion();
    }
  },

  setTranscript: (text: string) => set({ transcript: text }),
  appendTranscript: (text: string) => set(s => ({ transcript: (s.transcript + ' ' + text).trimStart() })),
  setIsListening: (val: boolean) => set({ isListening: val }),
  incrementElapsed: () => set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  recordIntegrityEvent: async (type: string, detail?: string) => {
    const { interviewId } = get();
    if (!interviewId) return;
    try {
      await interviewService.recordIntegrityEvent(interviewId, type, detail);
    } catch {
      // Keep session resilient if event recording fails silently
    }
  },

  reset: () => {
    get().stopSpeech();
    set({
      interviewId: null,
      interviewData: null,
      activeQuestion: null,
      phase: 'idle',
      isLoading: false,
      isSubmitting: false,
      error: null,
      finalAssessment: null,
      lastEvaluation: null,
      isSpeaking: false,
      isListening: false,
      transcript: '',
      questionsAnswered: 0,
      elapsedSeconds: 0,
    });
  },
}));