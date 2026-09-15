import axios from 'axios';
import { apiBaseURL, attachAuthentication } from '../app/services/http';

// Adaptive interview endpoints live under /api/adaptive-interview.
const client = attachAuthentication(axios.create({
  baseURL: apiBaseURL.replace(/\/api$/, ''),
  timeout: 90000, // answer evaluation can take a while on Gemini
}));

export interface PlanItem { topic: string; planned: number; asked: number; avgScore?: number | null }
export interface ClientQuestion {
  id: string; text: string; topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  depth: 'starter' | 'follow-up' | 'deep-dive' | 'scenario';
  expectedDuration: number;
}
export interface AnswerFeedback {
  scores: { correctness: number; depth: number; communication: number; confidence: number };
  overallScore: number;
  verdict: 'poor' | 'below-average' | 'average' | 'good' | 'excellent';
  strengths: string[]; improvements: string[];
  matchedKeywords: string[]; aiSummary: string;
}
export interface ProctorEvent { type: string; at: string; detail?: string }
export interface TopicPerformance { topic: string; questionsAsked: number; avgScore: number; verdict: string }
export interface AdaptiveReport {
  overallScore: number;
  domainReadiness: 'needs-work' | 'developing' | 'competent' | 'strong' | 'placement-ready';
  topicPerformance: TopicPerformance[];
  strengths: string[]; weaknesses: string[]; recommendations: string[]; suggestedLearningPath: string[];
  summary: string;
  integrity: { score: number; eventCounts: Record<string, number>; note: string };
  generatedAt: string; source: 'ai' | 'computed';
}
export interface TranscriptItem {
  questionId: string; questionText: string; topic: string; answer: string;
  durationSeconds: number; overallScore: number; verdict: string;
  strengths: string[]; improvements: string[]; aiSummary: string; timestamp: string;
}
export interface RecordingInfo {
  available: boolean;
  storageType?: 'cloudinary' | 'local';
  sizeBytes?: number;
  durationSeconds?: number | null;
  playbackUrl: string | null;
  uploadedAt?: string;
}

function unwrap(data: any): any {
  if (data?.success === false) throw new Error(data.error || data.message || 'Request failed');
  // Backend wraps payloads as { success, data } — return the inner payload.
  return data?.data !== undefined ? data.data : data;
}

export const adaptiveInterviewApi = {
  async createSession(payload: { domain: string; role?: string; difficulty: string; questionCount: number }) {
    const res = await client.post('/api/adaptive-interview/create', payload);
    return unwrap(res.data);
  },
  async getSession(sessionId: string) {
    const res = await client.get(`/api/adaptive-interview/${sessionId}`);
    return unwrap(res.data);
  },
  async submitAnswer(sessionId: string, payload: { questionId: string; answer: string; durationSeconds: number }) {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/answer`, payload);
    return unwrap(res.data) as { feedback: AnswerFeedback; nextQuestion: ClientQuestion | null; completed: boolean; answeredCount: number; plannedQuestions: number; reason: string };
  },
  async reportProctorEvent(sessionId: string, type: string, detail?: string) {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/proctor`, { type, detail });
    return unwrap(res.data) as { integrityScore: number; totalEvents: number };
  },
  async endInterview(sessionId: string) {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/end`, {});
    return unwrap(res.data) as { sessionId: string; completed: boolean; report: AdaptiveReport };
  },
  async uploadRecording(sessionId: string, blob: Blob, durationSeconds?: number) {
    const form = new FormData();
    form.append('recording', blob, 'interview-recording.webm');
    if (durationSeconds && durationSeconds > 0) form.append('durationSeconds', String(Math.round(durationSeconds)));
    const res = await client.post(`/api/adaptive-interview/${sessionId}/recording`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // large video files need a longer window
    });
    return unwrap(res.data) as { storageType: string; sizeBytes: number; playbackUrl: string };
  },
  async getReport(sessionId: string) {
    const res = await client.get(`/api/adaptive-interview/${sessionId}/report`);
    return unwrap(res.data) as {
      sessionId: string; domain: string; role: string; difficulty: string;
      durationSeconds: number; report: AdaptiveReport; transcript: TranscriptItem[]; recording: RecordingInfo;
    };
  },
  // Authorized playback: <video src> cannot send the auth header, so we fetch bytes ourselves.
  async fetchRecordingBlob(sessionId: string): Promise<Blob> {
    const res = await client.get(`/api/adaptive-interview/${sessionId}/recording`, { responseType: 'blob', timeout: 120000 });
    return res.data as Blob;
  },

  async getHistory(page = 1, limit = 10) {
    const res = await client.get('/api/adaptive-interview', { params: { page, limit } });
    if (res.data?.success === false) throw new Error(res.data.error || 'Failed to load history');
    return { items: (res.data?.data || []) as any[], pagination: res.data?.pagination };
  },
};

export default adaptiveInterviewApi;
