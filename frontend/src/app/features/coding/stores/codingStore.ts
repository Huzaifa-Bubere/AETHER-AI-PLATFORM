import { create } from 'zustand';
import { codingService } from '../services/coding.service';
import type {
  CodingLanguage, CodingProblem, IExecutionResult, ISubmitResult, IAstAnalysis,
} from '../types';

interface CodingWorkspaceState {
  problem: CodingProblem | null;
  language: CodingLanguage;
  codeByLanguage: Record<string, string>;
  activeTab: string;
  isRunning: boolean;
  isSubmitting: boolean;
  isAnalyzing: boolean;
  runResult: IExecutionResult | null;
  submitResult: ISubmitResult | null;
  analysis: IAstAnalysis | null;
  selectedLine: number | null;
  customInput: string;
  error: string | null;

  loadProblem: (slug: string) => Promise<boolean>;
  setLanguage: (lang: CodingLanguage) => void;
  setCode: (code: string) => void;
  resetCode: () => void;
  setActiveTab: (tab: string) => void;
  setCustomInput: (input: string) => void;
  setSelectedLine: (line: number | null) => void;
  runCode: (mode: 'sample' | 'custom') => Promise<void>;
  submitCode: () => Promise<ISubmitResult | null>;
  refreshAnalysis: () => Promise<void>;
  clear: () => void;
}

/** Starter code fallback when the problem has none for a language. */
function fallbackStarter(problem: CodingProblem, lang: CodingLanguage): string {
  const fn = problem.functionNames?.[lang] || 'solve';
  if (lang === 'python') return `def ${fn}():\n    # Write your solution here\n    pass\n`;
  if (lang === 'java') return `class Solution {\n    public ${'int'} ${fn}() {\n        // Write your solution here\n        return 0;\n    }\n}\n`;
  if (lang === 'cpp' || lang === 'c') return `class Solution {\npublic:\n    // Write your solution here\n};\n`;
  return `function ${fn}() {\n  // Write your solution here\n}\n`;
}

export const useCodingStore = create<CodingWorkspaceState>((set, get) => ({
  problem: null,
  language: 'python',
  codeByLanguage: {},
  activeTab: 'testcases',
  isRunning: false,
  isSubmitting: false,
  isAnalyzing: false,
  runResult: null,
  submitResult: null,
  analysis: null,
  selectedLine: null,
  customInput: '',
  error: null,

  loadProblem: async (slug: string) => {
    set({ problem: null, runResult: null, submitResult: null, analysis: null, error: null, selectedLine: null });
    const res = await codingService.getProblem(slug);
    if (res.success && res.data) {
      const problem = res.data;
      // Seed code per language: stored draft > starter code
      const savedDrafts = readDrafts(slug);
      const codeByLanguage: Record<string, string> = {};
      for (const lang of ['python', 'javascript', 'typescript', 'java', 'cpp', 'c']) {
        codeByLanguage[lang] = savedDrafts[lang] ?? (problem.starterCode as any)?.[lang] ?? fallbackStarter(problem, lang as CodingLanguage);
      }
      set({ problem, codeByLanguage, language: 'python' });
      return true;
    }
    set({ error: res.message || 'Failed to load problem' });
    return false;
  },

  setLanguage: (lang) => {
    set({ language: lang });
    const { problem } = get();
    if (problem) persistDraft(problem.slug, lang, get().codeByLanguage[lang] || '');
  },

  setCode: (code) => {
    const { problem, language } = get();
    set(state => ({ codeByLanguage: { ...state.codeByLanguage, [language]: code } }));
    if (problem) persistDraft(problem.slug, language, code);
  },

  resetCode: () => {
    const { problem, language } = get();
    if (!problem) return;
    const starter = (problem.starterCode as any)?.[language] || fallbackStarter(problem, language);
    set(state => ({ codeByLanguage: { ...state.codeByLanguage, [language]: starter } }));
    persistDraft(problem.slug, language, starter);
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setCustomInput: (input) => set({ customInput: input }),
  setSelectedLine: (line) => set({ selectedLine: line }),

  runCode: async (mode) => {
    const { problem, language, codeByLanguage, customInput } = get();
    if (!problem) return;
    set({ isRunning: true, error: null, activeTab: mode === 'custom' ? 'output' : 'testcases' });
    try {
      const res = await codingService.runCode({
        problemSlug: problem.slug,
        language,
        sourceCode: codeByLanguage[language] || '',
        customInput: mode === 'custom' ? customInput : undefined,
      });
      if (res.success && res.data) {
        set({ runResult: res.data, isRunning: false });
      } else {
        set({ isRunning: false, error: res.message || 'Run failed' });
      }
    } catch (err: any) {
      set({ isRunning: false, error: err?.message || 'Run failed' });
    }
  },

  submitCode: async () => {
    const { problem, language, codeByLanguage } = get();
    if (!problem) return null;
    set({ isSubmitting: true, error: null, activeTab: 'analysis' });
    try {
      const res = await codingService.submitCode({
        problemSlug: problem.slug,
        language,
        sourceCode: codeByLanguage[language] || '',
      });
      if (res.success && res.data) {
        set({ submitResult: res.data, isSubmitting: false, analysis: res.data.astAnalysis });
        return res.data;
      }
      set({ isSubmitting: false, error: res.message || 'Submission failed' });
      return null;
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message || 'Submission failed' });
      return null;
    }
  },

  refreshAnalysis: async () => {
    const { problem, language, codeByLanguage } = get();
    if (!problem) return;
    set({ isAnalyzing: true });
    try {
      const res = await codingService.analyzeCode({
        problemSlug: problem.slug,
        language,
        sourceCode: codeByLanguage[language] || '',
      });
      if (res.success && res.data) {
        set({ analysis: res.data, isAnalyzing: false });
      } else {
        set({ isAnalyzing: false });
      }
    } catch {
      set({ isAnalyzing: false });
    }
  },

  clear: () => {
    set({
      problem: null, codeByLanguage: {}, runResult: null, submitResult: null,
      analysis: null, error: null, selectedLine: null, customInput: '', activeTab: 'testcases',
    });
  },
}));

// ── localStorage draft persistence (problem + language scoped) ──────────────

const DRAFT_PREFIX = 'aether-coding-draft';

function readDrafts(slug: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}:${slug}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistDraft(slug: string, language: string, code: string): void {
  try {
    const drafts = readDrafts(slug);
    drafts[language] = code;
    localStorage.setItem(`${DRAFT_PREFIX}:${slug}`, JSON.stringify(drafts));
  } catch {
    // storage full/unavailable — non-fatal
  }
}
