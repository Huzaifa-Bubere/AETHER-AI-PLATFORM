import { apiService } from './api';

const unwrap = (r: any) => {
  if (r?.success === false) throw new Error(r.error || 'Request failed');
  return r?.data ?? r;
};

export interface GdTopic {
  _id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  roleSlugs: string[];
  keywords: string[];
  openingContext: string;
  keyPoints: string[];
  brandingNote: string;
  isPublished: boolean;
  usageCount: number;
}

export interface GdParticipant {
  id: string;
  name: string;
  style: string;
}

export interface GdTurn {
  speakerType: 'CANDIDATE' | 'AI';
  speakerId?: string;
  speakerName: string;
  text: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  source: 'VOICE' | 'TEXT';
  sequence: number;
}

export interface GdSession {
  _id: string;
  topicId: string;
  topicSnapshot?: {
    title: string;
    description: string;
    keywords: string[];
    openingContext: string;
    category: string;
    difficulty: string;
    roleSlugs: string[];
  };
  roleSlug: string;
  difficulty: string;
  durationMinutes: number;
  participants: GdParticipant[];
  turns: GdTurn[];
  startedAt?: string;
  endedAt?: string;
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  candidateMetrics?: Record<string, number>;
  scoreBreakdown?: Record<string, number>;
  overallScore?: number | null;
  feedback?: {
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    summary: string;
  };
  recording?: {
    storageKey: string;
    contentType: string;
    durationSeconds: number;
    sizeBytes?: number;
    consentedAt?: string;
    uploadedAt?: string;
  };
  recordingConsent?: boolean;
  createdAt?: string;
}

export const groupDiscussionApi = {
  topics: async (params?: { category?: string; difficulty?: string; roleSlug?: string }) =>
    unwrap(
      await apiService.get('/group-discussion/topics', params ?? undefined),
    ),

  create: async (
    payload: {
      topicId: string;
      durationMinutes: number;
      aiParticipants?: number;
      roleSlug?: string;
      difficulty?: string;
    },
  ) => unwrap(await apiService.post('/group-discussion/sessions', payload)),

  get: async (id: string) => unwrap(await apiService.get(`/group-discussion/sessions/${id}`)),

  list: async (
    params?: { status?: string; roleSlug?: string },
  ) => unwrap(await apiService.get('/group-discussion/sessions', params ?? undefined)),

  /**
   * Submit a candidate turn. Returns the updated session plus whether an AI
   * participant actually replied — when the AI is unavailable the caller must
   * keep letting the candidate speak rather than appearing stuck.
   */
  turn: async (id: string, payload: { text: string; source?: 'VOICE' | 'TEXT'; durationSeconds?: number }) => {
    const res: any = await apiService.post(`/group-discussion/sessions/${id}/turns`, payload);
    const session = unwrap(res);
    return { session: session as GdSession, aiReplied: res?.aiReplied !== false };
  },

  consentRecording: async (id: string, consent: boolean) =>
    unwrap(
      await apiService.post(`/group-discussion/sessions/${id}/recording/consent`, { consent }),
    ),

  /**
   * Upload the audio actually captured by the microphone. The backend stores the
   * real file (local + optional Cloudinary mirror); a recording is never
   * represented by a client-invented key.
   */
  attachRecording: async (id: string, blob: Blob, durationSeconds: number) => {
    const form = new FormData();
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    form.append('recording', blob, `group-discussion-${id}.${ext}`);
    form.append('durationSeconds', String(Math.max(0, Math.round(durationSeconds))));
    return unwrap(await apiService.upload(`/group-discussion/sessions/${id}/recording`, form, 120000));
  },

  /**
   * End the discussion. `recordedEvidence` is false when the candidate never
   * spoke, in which case the backend abandons the session instead of storing a
   * meaningless 0/100 result.
   */
  end: async (id: string) => {
    const res: any = await apiService.post(`/group-discussion/sessions/${id}/end`, {});
    const session = unwrap(res);
    return { session: session as GdSession, recordedEvidence: res?.recordedEvidence !== false };
  },
};
