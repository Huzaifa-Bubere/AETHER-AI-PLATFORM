import { create } from 'zustand';
import {
  Interview,
  InterviewSession,
  Question,
  Response,
  InterviewAnalysis,
  InterviewFeedback,
  InterviewSetupForm,
} from '../types';
import { interviewService } from '../services/interview';

interface InterviewState {
  // Current interview session
  currentInterview: Interview | null;
  currentSession: InterviewSession | null;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  
  // Interview history
  interviews: Interview[];
  
  // Analysis and feedback
  analysis: InterviewAnalysis | null;
  feedback: InterviewFeedback | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  isRecording: boolean;
  
  // WebRTC state
  mediaStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  
  // Actions
  createInterview: (setup: InterviewSetupForm) => Promise<void>;
  startInterview: (interviewId: string) => Promise<void>;
  endInterview: () => Promise<void>;
  getNextQuestion: () => Promise<void>;
  submitResponse: (response: Partial<Response>) => Promise<void>;
  getInterviewHistory: () => Promise<void>;
  getAnalysis: (interviewId: string) => Promise<void>;
  getFeedback: (interviewId: string) => Promise<void>;
  
  // Media controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  setMediaStream: (stream: MediaStream | null) => void;
  
  // Utility
  clearError: () => void;
  resetSession: () => void;
}

const starting = new Map<string, Promise<void>>();
let loadingInterviewId = '';

export const useInterviewStore = create<InterviewState>((set, get) => ({
  // Initial state
  currentInterview: null,
  currentSession: null,
  currentQuestion: null,
  currentQuestionIndex: 0,
  interviews: [],
  analysis: null,
  feedback: null,
  isLoading: false,
  error: null,
  isRecording: false,
  mediaStream: null,
  peerConnection: null,

  createInterview: async (setup: InterviewSetupForm) => {
    get().resetSession();
    console.log('Creating interview with setup:', setup);
    set({ isLoading: true, error: null });
    
    try {
      // Validate setup before sending
      if (!setup.type) {
        throw new Error('Interview type is required');
      }
      if (!setup.settings?.role) {
        throw new Error('Target role is required');
      }
      if (!setup.settings?.difficulty) {
        throw new Error('Difficulty level is required');
      }
      if (!setup.settings?.duration) {
        throw new Error('Duration is required');
      }
      
      console.log('Sending interview creation request...');
      const response = await interviewService.createInterview(setup);
      console.log('Interview creation response:', response);
      
      if (response.success && response.data) {
        console.log('Interview created successfully:', response.data);
        set({
          currentInterview: response.data,
          isLoading: false,
        });
      } else {
        const errorMsg = response.error || response.message || 'Failed to create interview';
        console.error('Interview creation failed:', errorMsg, response.details);
        set({
          error: errorMsg,
          isLoading: false,
        });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Interview creation error:', error);
      const errorMsg = error.message || 'Failed to create interview';
      set({
        error: errorMsg,
        isLoading: false,
      });
      throw error;
    }
  },

  startInterview: (interviewId: string) => {
    const existing = starting.get(interviewId);
    if (existing) return existing;
    loadingInterviewId = interviewId;
    get().resetSession();
    set({ isLoading: true, error: null });
    const task = (async () => {
      try {
        const session = await interviewService.startInterview(interviewId);
        if (!session.success || !session.data) throw new Error(session.error || 'Failed to start interview');
        const detail = await interviewService.getInterview(interviewId);
        if (!detail.success || !detail.data) throw new Error(detail.error || 'Failed to load interview');
        if (loadingInterviewId !== interviewId) return;
        set({ currentInterview: detail.data, currentSession: session.data, isLoading: false });
        await get().getNextQuestion();
      } catch (error: any) {
        if (loadingInterviewId === interviewId) set({ error: error.message || 'Failed to start interview', isLoading: false });
        throw error;
      }
    })().finally(() => { starting.delete(interviewId); });
    starting.set(interviewId, task);
    return task;
  },

  endInterview: async () => {
    const { currentInterview, currentSession } = get();
    const interviewId = currentSession?.interviewId || (currentInterview as any)?._id || currentInterview?.id;
    if (!interviewId) throw new Error('Interview ID not found');
    set({ isLoading: true, error: null });
    try {
      get().stopRecording();
      const response = await interviewService.endInterview(interviewId);
      if (!response.success || !response.data) throw new Error(response.error || 'Failed to end interview');
      set({ currentInterview: response.data, currentSession: null, currentQuestion: null, currentQuestionIndex: 0, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to end interview', isLoading: false });
      throw error;
    }
  },

  getNextQuestion: async () => {
    const { currentInterview, currentSession } = get();
    const interviewId = currentSession?.interviewId || (currentInterview as any)?._id || currentInterview?.id;
    if (!interviewId) throw new Error('Interview is not loaded');
    try {
      const response = await interviewService.getNextQuestion(interviewId);
      if (!response.success) throw new Error(response.error || 'Failed to get next question');
      if (get().currentSession?.interviewId !== currentSession?.interviewId) return;
      if ((response as any).completed === true) {
        set({ currentQuestion: null, currentQuestionIndex: currentInterview?.questions.length || 0 });
      } else if (response.data) {
        const index = currentInterview?.questions.findIndex(q => q.id === response.data!.id) ?? -1;
        set({ currentQuestion: response.data, currentQuestionIndex: index >= 0 ? index + 1 : ((response as any).answeredQuestions || 0) + 1, error: null });
      } else throw new Error('The server returned no question');
    } catch (error: any) {
      set({ error: error.message || 'Failed to get next question' });
      throw error;
    }
  },

  submitResponse: async (response: Partial<Response>) => {
    const { currentInterview, currentQuestion, currentSession } = get();
    const interviewId = currentSession?.interviewId || (currentInterview as any)?._id || currentInterview?.id;
    if (!interviewId || !currentQuestion) throw new Error('Interview question is not loaded');
    try {
      const saved = await interviewService.submitResponse(interviewId, currentQuestion.id, response);
      if (!saved.success) throw new Error(saved.error || 'Failed to save answer');
      set({ error: null });
    } catch (error: any) {
      set({ error: error.message || 'Failed to save answer' });
      throw error;
    }
  },

  getInterviewHistory: async () => {
    console.log('=== FETCHING INTERVIEW HISTORY ===');
    set({ isLoading: true, error: null });
    
    try {
      const response = await interviewService.getInterviewHistory(1, 100); // Get up to 100 interviews
      console.log('Interview history raw response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', Object.keys(response));
      
      // The response is a PaginatedResponse with data and pagination at root level
      if (response && response.data && Array.isArray(response.data)) {
        console.log('✅ Interview history loaded:', response.data.length, 'interviews');
        console.log('First interview sample:', response.data[0]);
        console.log('Pagination info:', response.pagination);
        
        set({
          interviews: response.data,
          isLoading: false,
          error: null,
        });
      } else {
        console.error('❌ Unexpected response structure:', response);
        console.error('response.data type:', typeof response.data);
        console.error('response.data value:', response.data);
        
        set({
          interviews: [],
          error: 'Invalid response format from server',
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('=== INTERVIEW HISTORY ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      
      set({
        interviews: [],
        error: error.message || 'Failed to get interview history',
        isLoading: false,
      });
    }
  },

  getAnalysis: async (interviewId: string) => {
    set({ isLoading: true });
    
    try {
      const response = await interviewService.getInterviewAnalysis(interviewId);
      
      if (response.success && response.data) {
        set({
          analysis: response.data,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to get analysis',
        isLoading: false,
      });
    }
  },

  getFeedback: async (interviewId: string) => {
    set({ isLoading: true });
    
    try {
      const response = await interviewService.getFeedback(interviewId);
      
      if (response.success && response.data) {
        set({
          feedback: response.data,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to get feedback',
        isLoading: false,
      });
    }
  },

  startRecording: async () => {
    // Recording state is controlled by VideoRecorder.
    // Do not request getUserMedia here to avoid duplicate media prompts/races.
    set({ isRecording: true });
  },

  stopRecording: () => {
    const { mediaStream } = get();
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    set({
      mediaStream: null,
      isRecording: false,
    });
  },

  setMediaStream: (stream: MediaStream | null) => {
    set({ mediaStream: stream });
  },

  clearError: () => set({ error: null }),

  resetSession: () => {
    const { mediaStream } = get();
    
    // Clean up media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    set({
      currentInterview: null,
      currentSession: null,
      currentQuestion: null,
      currentQuestionIndex: 0,
      analysis: null,
      feedback: null,
      isRecording: false,
      mediaStream: null,
      peerConnection: null,
      error: null,
    });
  },
}));