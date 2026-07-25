import { create } from 'zustand';
import axios from 'axios';

// ADAPT: reuse your existing configured axios instance (with baseURL + auth
// interceptor) instead of raw axios, e.g. `import api from '../lib/api'`.
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type PaletteStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked-for-review' | 'answered-marked-for-review';

interface Question {
  _id: string;
  imageUrl: string;
  category: string;
  difficulty: string;
  marks: number;
}

interface ResponseState {
  question: string;
  selectedOption: OptionKey | null;
  status: PaletteStatus;
}

interface AptitudeState {
  attemptId: string | null;
  deadline: Date | null;
  questions: Question[];
  responses: Record<string, ResponseState>;
  currentIndex: number;
  loading: boolean;
  error: string | null;
  submitted: boolean;

  loadAttempt: (attemptId: string) => Promise<void>;
  goTo: (index: number) => void;
  selectOption: (option: OptionKey) => void;
  clearResponse: () => void;
  toggleMarkForReview: () => void;
  saveAndNext: () => Promise<void>;
  submit: (auto?: boolean) => Promise<void>;
  reset: () => void;
}

let questionEnteredAt = Date.now();

export const useAptitudeStore = create<AptitudeState>((set, get) => ({
  attemptId: null,
  deadline: null,
  questions: [],
  responses: {},
  currentIndex: 0,
  loading: false,
  error: null,
  submitted: false,

  loadAttempt: async (attemptId) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get(`/api/aptitude/attempts/${attemptId}`);
      const responses: Record<string, ResponseState> = {};
      data.responses.forEach((r: ResponseState) => (responses[r.question] = r));
      set({
        attemptId: data.attemptId,
        deadline: new Date(data.deadline),
        questions: data.questions,
        responses,
        currentIndex: 0,
        loading: false,
      });
      questionEnteredAt = Date.now();
    } catch (err: any) {
      set({ loading: false, error: err?.response?.data?.message || 'Failed to load exam.' });
    }
  },

  goTo: (index) => {
    const { questions, responses } = get();
    const q = questions[index];
    if (!q) return;
    const r = responses[q._id];
    // Mark as "not-visited" -> "not-answered" the first time it's viewed
    if (r && r.status === 'not-visited') {
      set({ responses: { ...responses, [q._id]: { ...r, status: 'not-answered' } } });
    }
    set({ currentIndex: index });
    questionEnteredAt = Date.now();
  },

  selectOption: (option) => {
    const { questions, currentIndex, responses } = get();
    const q = questions[currentIndex];
    const existing = responses[q._id];
    const markedForReview = existing?.status === 'marked-for-review' || existing?.status === 'answered-marked-for-review';
    set({
      responses: {
        ...responses,
        [q._id]: {
          question: q._id,
          selectedOption: option,
          status: markedForReview ? 'answered-marked-for-review' : 'answered',
        },
      },
    });
  },

  clearResponse: () => {
    const { questions, currentIndex, responses } = get();
    const q = questions[currentIndex];
    set({ responses: { ...responses, [q._id]: { question: q._id, selectedOption: null, status: 'not-answered' } } });
  },

  toggleMarkForReview: () => {
    const { questions, currentIndex, responses } = get();
    const q = questions[currentIndex];
    const existing = responses[q._id];
    const hasAnswer = !!existing?.selectedOption;
    const currentlyMarked = existing?.status === 'marked-for-review' || existing?.status === 'answered-marked-for-review';
    const nextStatus: PaletteStatus = currentlyMarked
      ? hasAnswer
        ? 'answered'
        : 'not-answered'
      : hasAnswer
      ? 'answered-marked-for-review'
      : 'marked-for-review';
    set({
      responses: { ...responses, [q._id]: { question: q._id, selectedOption: existing?.selectedOption ?? null, status: nextStatus } },
    });
  },

  saveAndNext: async () => {
    const { questions, currentIndex, responses, attemptId } = get();
    const q = questions[currentIndex];
    const r = responses[q._id];
    const timeSpentSeconds = Math.round((Date.now() - questionEnteredAt) / 1000);

    try {
      await api.post(`/api/aptitude/attempts/${attemptId}/response`, {
        questionId: q._id,
        selectedOption: r?.selectedOption ?? null,
        markedForReview: r?.status === 'marked-for-review' || r?.status === 'answered-marked-for-review',
        timeSpentSeconds,
      });
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Server says time is already up — force submit flow.
        await get().submit(true);
        return;
      }
    }

    if (currentIndex < questions.length - 1) {
      get().goTo(currentIndex + 1);
    }
  },

  submit: async (auto = false) => {
    const { attemptId } = get();
    if (!attemptId) return;
    await api.post(`/api/aptitude/attempts/${attemptId}/submit`, { autoSubmitted: auto });
    set({ submitted: true });
  },

  reset: () =>
    set({
      attemptId: null,
      deadline: null,
      questions: [],
      responses: {},
      currentIndex: 0,
      loading: false,
      error: null,
      submitted: false,
    }),
}));
