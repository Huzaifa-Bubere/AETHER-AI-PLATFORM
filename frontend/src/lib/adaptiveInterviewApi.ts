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
  followUpEvidence?: { parentQuestionId: string; triggerText: string; reason: string; decidedBy: string } | null;
}
export interface FollowUpTrailItem {
  questionId: string; parentQuestionId: string | null; questionText: string; topic: string;
  depth: string; triggerText: string; reason: string; decidedBy: string;
}
export interface LearningRecommendation { skill: string; reason: string; learningPath?: string; cta: string }
export interface EnglishAnalysis {
  grammar: number; clarity: number; vocabulary: number; coherence: number;
  evidence: string[]; improvements: string[]; measuredAt: string;
}
export interface SpeakingMetrics {
  wordsPerMinute: number | null; totalWords: number; fillerCount: number;
  fillerRatePerMinute: number | null; averageResponseSeconds: number | null;
  pauseRatioEstimate: number | null; responseCount: number;
}
export interface StarResult { situation: boolean; task: boolean; action: boolean; result: boolean; recommendation: string }
export interface BehaviorSegment {
  label: string; startSec: number; endSec: number;
  presence: number; engagement: number | null; note: string;
}
export interface BehaviorAnalysis {
  available: boolean;
  engine: string;
  framesAnalyzed: number;
  presenceScore: number;
  eyeContactScore: number | null;
  postureScore: number | null;
  engagementScore: number | null;
  confidenceIndex: number | null;
  segments: BehaviorSegment[];
  summary: string;
  notes: string[];
  analyzedAt: string;
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
  async createSession(payload: {
    domain: string; role?: string; difficulty: string; questionCount: number;
    experienceLevel?: string; interviewType?: string; resumeId?: string | null;
    jobDescription?: string; consentRecording?: boolean;
  }) {
    const res = await client.post('/api/adaptive-interview/create', payload);
    return unwrap(res.data);
  },
  async getSession(sessionId: string) {
    const res = await client.get(`/api/adaptive-interview/${sessionId}`);
    return unwrap(res.data);
  },
  async submitAnswer(sessionId: string, payload: { questionId: string; answer: string; durationSeconds: number; answerSource?: 'voice' | 'text' }) {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/answer`, payload);
    return unwrap(res.data) as { feedback: AnswerFeedback; nextQuestion: ClientQuestion | null; completed: boolean; answeredCount: number; plannedQuestions: number; reason: string };
  },
  async reportProctorEvent(sessionId: string, type: string, detail?: string) {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/proctor`, { type, detail });
    return unwrap(res.data) as { integrityScore: number; totalEvents: number };
  },
  async endInterview(sessionId: string, terminationReason?: 'INTEGRITY_WARNING_LIMIT') {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/end`, terminationReason ? { terminationReason } : {});
    return unwrap(res.data) as { sessionId: string; completed: boolean; report: AdaptiveReport };
  },
  /**
   * Upload the recording with bounded retry (spec §4G).
   *
   * A retry only happens for transient failures (network error, timeout, 5xx).
   * A 4xx is a contract problem (too large / wrong type) and retrying would just
   * repeat it. The recording blob is validated before the first attempt so a
   * zero-byte Blob is never uploaded (spec §4D).
   */
  async uploadRecording(sessionId: string, blob: Blob, durationSeconds?: number) {
    if (!blob || blob.size <= 0) {
      throw new Error('Recording contains no media data.');
    }
    const extension = /mp4|mpeg/i.test(blob.type) ? 'mp4' : 'webm';
    const displayName = `interview-recording.${extension}`;

    const attempt = async () => {
      const form = new FormData();
      form.append('recording', blob, displayName);
      if (durationSeconds && durationSeconds > 0) form.append('durationSeconds', String(Math.round(durationSeconds)));
      const res = await client.post(`/api/adaptive-interview/${sessionId}/recording`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // large video files need a longer window
      });
      return unwrap(res.data) as { storageType: string; sizeBytes: number; playbackUrl: string };
    };

    const MAX_ATTEMPTS = 3;
    let lastError: any;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        return await attempt();
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status as number | undefined;
        const transient = status === undefined || status === 408 || status === 429 || status >= 500;
        if (!transient || i === MAX_ATTEMPTS - 1) break;
        // Small exponential backoff: 800ms, 1600ms.
        await new Promise(resolve => setTimeout(resolve, 800 * Math.pow(2, i)));
      }
    }
    throw lastError;
  },
  async getReport(sessionId: string) {
    const res = await client.get(`/api/adaptive-interview/${sessionId}/report`);
    return unwrap(res.data) as {
      sessionId: string; domain: string; role: string; difficulty: string;
      durationSeconds: number; report: AdaptiveReport; transcript: TranscriptItem[]; recording: RecordingInfo;
      speakingMetrics?: SpeakingMetrics | null;
      englishAnalysis?: EnglishAnalysis | null;
      behaviorAnalysis?: BehaviorAnalysis | null;
      followUpTrail?: FollowUpTrailItem[];
      learningRecommendations?: LearningRecommendation[];
      starByQuestion?: Array<{ questionId: string; star: StarResult | null }>;
    };
  },

  // Re-run the body-language/confidence analysis (e.g. it failed during upload).
  async reanalyzeBehavior(sessionId: string): Promise<BehaviorAnalysis | null> {
    const res = await client.post(`/api/adaptive-interview/${sessionId}/behavior-analysis`, {}, { timeout: 180000 });
    const data = unwrap(res.data) as { behaviorAnalysis?: BehaviorAnalysis | null };
    return data?.behaviorAnalysis ?? null;
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
