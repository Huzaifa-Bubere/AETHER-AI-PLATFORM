import { create } from 'zustand';
import api from '../lib/aptitudeApi';

export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type PaletteStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked-for-review' | 'answered-marked-for-review';
interface Question {
  _id: string; imageUrl: string; questionText?: string; options?: Record<OptionKey, string>;
  category: string; difficulty: string; marks: number;
}
interface ResponseState {
  question: string; selectedOption: OptionKey | null; status: PaletteStatus; timeSpentSeconds: number;
}
interface AptitudeState {
  attemptId: string | null; deadline: Date | null; questions: Question[];
  responses: Record<string, ResponseState>; currentIndex: number;
  loading: boolean; navigating: boolean; saving: boolean; submitting: boolean; error: string | null; submitted: boolean;
  loadAttempt: (attemptId: string) => Promise<void>;
  flushCurrent: () => Promise<boolean>;
  goTo: (index: number) => Promise<void>;
  selectOption: (option: OptionKey) => void;
  clearResponse: () => void; toggleMarkForReview: () => void;
  saveAndNext: () => Promise<void>; submit: (auto?: boolean) => Promise<void>; reset: () => void;
}
let enteredAt = Date.now();
let saveQueue: Promise<unknown> = Promise.resolve();
let pendingSaves = 0;
let generation = 0;
let dirty = new Map<string, number>();
const empty = { attemptId: null, deadline: null, questions: [], responses: {}, currentIndex: 0,
  loading: false, navigating: false, saving: false, submitting: false, error: null, submitted: false };
const marked = (r?: ResponseState) => r?.status === 'marked-for-review' || r?.status === 'answered-marked-for-review';
const payload = (r: ResponseState) => ({ questionId: r.question, selectedOption: r.selectedOption,
  markedForReview: marked(r), visited: r.status !== 'not-visited', timeSpentSeconds: r.timeSpentSeconds || 0 });

export const useAptitudeStore = create<AptitudeState>((set, get) => {
  const trackTime = () => {
    const { questions, currentIndex, responses } = get();
    const q = questions[currentIndex];
    if (!q) return;
    const r = responses[q._id] || { question: q._id, selectedOption: null, status: 'not-answered', timeSpentSeconds: 0 };
    set({ responses: { ...responses, [q._id]: { ...r, timeSpentSeconds: (r.timeSpentSeconds || 0) + Math.max(0, (Date.now() - enteredAt) / 1000) } } });
    dirty.set(q._id, (dirty.get(q._id) || 0) + 1);
    enteredAt = Date.now();
  };
  const saveCurrent = (): Promise<boolean> => {
    trackTime();
    const { attemptId, questions, currentIndex, responses, submitted } = get();
    const q = questions[currentIndex];
    if (!q || !attemptId || submitted) return Promise.resolve(false);
    const data = payload(responses[q._id]);
    const currentGeneration = generation;
    const revision = dirty.get(q._id);
    pendingSaves++;
    set({ saving: true });
    const task = saveQueue.then(async () => {
      try {
        await api.post(`/api/aptitude/attempts/${attemptId}/response`, data);
        if (currentGeneration === generation) {
          if (dirty.get(q._id) === revision) dirty.delete(q._id);
          set({ error: null });
        }
        return true;
      } catch (error: any) {
        if (currentGeneration === generation) {
          if (error?.response?.status === 409 && error.response.data?.submitted) set({ submitted: true });
          else set({ error: error?.response?.data?.message || error?.response?.data?.error || 'Could not save your answer. Please retry.' });
        }
        return false;
      } finally {
        if (currentGeneration === generation) { pendingSaves--; set({ saving: pendingSaves > 0 }); }
      }
    });
    saveQueue = task;
    return task;
  };
  return {
    ...empty,
    flushCurrent: saveCurrent,
    loadAttempt: async attemptId => {
      const currentGeneration = ++generation;
      dirty = new Map(); pendingSaves = 0; saveQueue = Promise.resolve();
      set({ ...empty, attemptId, loading: true });
      try {
        const { data } = await api.get(`/api/aptitude/attempts/${attemptId}`);
        if (currentGeneration !== generation) return;
        const responses: Record<string, ResponseState> = {};
        data.responses.forEach((r: ResponseState) => { responses[r.question] = { ...r, timeSpentSeconds: r.timeSpentSeconds || 0 }; });
        const first = data.questions[0]?._id;
        if (first && responses[first]?.status === 'not-visited') responses[first].status = 'not-answered';
        const deadline = new Date(data.deadline);
        if (data.serverTime) deadline.setTime(Date.now() + deadline.getTime() - new Date(data.serverTime).getTime());
        set({ deadline, questions: data.questions, responses,
          submitted: data.status === 'completed', loading: false });
        enteredAt = Date.now();
      } catch (error: any) {
        if (currentGeneration === generation) set({ loading: false, error: error?.response?.data?.message || error?.response?.data?.error || 'Failed to load exam.' });
      }
    },
    goTo: async index => {
      if (get().navigating || get().submitting || get().submitted || !get().questions[index]) return;
      const currentGeneration = generation;
      set({ navigating: true });
      const saved = await saveCurrent();
      if (currentGeneration !== generation) return;
      set({ navigating: false });
      if (!saved || get().submitting || get().submitted) return;
      const { questions, responses } = get();
      const q = questions[index];
      const r = responses[q._id];
      set({ currentIndex: index, responses: { ...responses, [q._id]: { ...r, status: r.status === 'not-visited' ? 'not-answered' : r.status } } });
      enteredAt = Date.now();
    },
    selectOption: option => {
      const { questions, currentIndex, responses, submitting, submitted } = get();
      const q = questions[currentIndex];
      if (!q || submitting || submitted || get().navigating) return;
      const r = responses[q._id];
      set({ responses: { ...responses, [q._id]: { ...r, selectedOption: option,
        status: marked(r) ? 'answered-marked-for-review' : 'answered' } } });
      void saveCurrent();
    },
    clearResponse: () => {
      const { questions, currentIndex, responses, submitting, submitted } = get();
      const q = questions[currentIndex];
      if (!q || submitting || submitted || get().navigating) return;
      const r = responses[q._id];
      set({ responses: { ...responses, [q._id]: { ...r, selectedOption: null, status: marked(r) ? 'marked-for-review' : 'not-answered' } } });
      void saveCurrent();
    },
    toggleMarkForReview: () => {
      const { questions, currentIndex, responses, submitting, submitted } = get();
      const q = questions[currentIndex];
      if (!q || submitting || submitted || get().navigating) return;
      const r = responses[q._id];
      const status = marked(r) ? (r.selectedOption ? 'answered' : 'not-answered') : (r.selectedOption ? 'answered-marked-for-review' : 'marked-for-review');
      set({ responses: { ...responses, [q._id]: { ...r, status } } });
      void get().saveAndNext();
    },
    saveAndNext: async () => {
      const { currentIndex, questions } = get();
      if (currentIndex < questions.length - 1) await get().goTo(currentIndex + 1);
      else await saveCurrent();
    },
    submit: async (auto = false) => {
      const { attemptId, submitted, submitting } = get();
      if (!attemptId || submitted || submitting) return;
      const currentGeneration = generation;
      set({ submitting: true, error: null });
      trackTime();
      await saveQueue;
      if (currentGeneration !== generation) return;
      try {
        await api.post(`/api/aptitude/attempts/${attemptId}/submit`, {
          autoSubmitted: auto, responses: Object.values(get().responses).filter(r => dirty.has(r.question)).map(payload),
        });
        if (currentGeneration === generation) set({ submitted: true });
      } catch (error: any) {
        if (currentGeneration === generation) set({ error: error?.response?.data?.message || error?.response?.data?.error || 'Submission failed. Please retry.' });
      } finally {
        if (currentGeneration === generation) set({ submitting: false });
      }
    },
    reset: () => { generation++; dirty = new Map(); pendingSaves = 0; saveQueue = Promise.resolve(); set({ ...empty }); },
  };
});
