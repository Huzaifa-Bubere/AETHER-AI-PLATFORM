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

  startInterview: async (interviewId: string) => {
    console.log('=== STARTING INTERVIEW ===');
    console.log('Interview ID:', interviewId);
    
    set({ isLoading: true, error: null });
    
    try {
      // First, try to get the interview details if we don't have it
      const { currentInterview } = get();
      if (!currentInterview) {
        console.log('No current interview, fetching interview details...');
        const interviewResponse = await interviewService.getInterview(interviewId);
        if (interviewResponse.success && interviewResponse.data) {
          console.log('Interview details fetched:', interviewResponse.data);
          set({ currentInterview: interviewResponse.data });
        }
      }
      
      console.log('Starting interview session...');
      const response = await interviewService.startInterview(interviewId);
      console.log('Start interview response:', response);
      
      if (response.success && response.data) {
        console.log('Interview session started successfully');
        set({
          currentSession: response.data,
          isLoading: false,
        });
        
        // Only auto-fetch the first question if we don't already have one.
        // CodingInterviewPage fetches its own question on mount — avoid duplicate.
        const { currentQuestion } = get();
        if (!currentQuestion) {
          console.log('Getting first question...');
          await get().getNextQuestion();
        }
      } else {
        const errorMsg = response.error || 'Failed to start interview';
        console.error('Failed to start interview:', errorMsg);
        set({
          error: errorMsg,
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('Start interview error:', error);
      const errorMsg = error.message || 'Failed to start interview';
      set({
        error: errorMsg,
        isLoading: false,
      });
    }
  },

  endInterview: async () => {
    const { currentInterview, currentSession } = get();
    
    if (!currentInterview && !currentSession) {
      console.error('No current interview or session');
      return;
    }
    
    // Get interview ID
    const interviewId = currentSession?.interviewId || 
                       (currentInterview as any)?._id || 
                       currentInterview?.id;
    
    if (!interviewId) {
      console.error('No interview ID available');
      set({ error: 'Interview ID not found' });
      return;
    }
    
    console.log('Ending interview:', interviewId);
    set({ isLoading: true });
    
    try {
      // Stop recording if active
      get().stopRecording();
      
      const response = await interviewService.endInterview(interviewId);
      console.log('End interview response:', response);
      
      if (response.success && response.data) {
        console.log('Interview ended successfully');
        set({
          currentInterview: response.data,
          currentSession: null,
          currentQuestion: null,
          currentQuestionIndex: 0,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'Failed to end interview',
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('End interview error:', error);
      set({
        error: error.message || 'Failed to end interview',
        isLoading: false,
      });
    }
  },

  getNextQuestion: async () => {
    const { currentInterview, currentSession } = get();

    const interviewId =
      currentSession?.interviewId ||
      (currentInterview as any)?._id ||
      currentInterview?.id;

    if (!interviewId) {
      console.warn('getNextQuestion: no interviewId yet, skipping');
      return;
    }

    console.log('Getting next question for interview:', interviewId);

    try {
      const response = await interviewService.getNextQuestion(interviewId);
      console.log('Next question response:', response);

      // Backend now returns completed:true with data:null when all questions done
      const completed = (response as any).completed === true;

      if (response.success && response.data && !completed) {
        set((state) => ({
          currentQuestion: response.data,
          currentQuestionIndex: state.currentQuestionIndex + 1,
        }));
      } else {
        // No more questions — clear current question so UI can show "done" state
        console.log('All questions answered — interview complete');
        set({ currentQuestion: null });
      }
    } catch (error: any) {
      if (
        error?.code === 'ERR_CANCELED' ||
        error?.message === 'canceled' ||
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError'
      ) {
        console.warn('getNextQuestion: request canceled — ignoring');
        return;
      }
      console.error('Get next question error:', error);
      set({ error: error.message || 'Failed to get next question' });
    }
  },

  submitResponse: async (response: Partial<Response>) => {
    const { currentInterview, currentQuestion, currentSession } = get();

    if (!currentQuestion) {
      console.error('No current question');
      return;
    }

    const interviewId =
      currentSession?.interviewId ||
      (currentInterview as any)?._id ||
      currentInterview?.id;

    if (!interviewId) {
      console.error('No interview ID available');
      set({ error: 'Interview ID not found' });
      return;
    }

    console.log('Submitting response for interview:', interviewId, 'question:', currentQuestion.id);

    try {
      await interviewService.submitResponse(interviewId, currentQuestion.id, response);
      console.log('Response submitted successfully');
      // NOTE: Do NOT call getNextQuestion here.
      // CodingInterviewPage.handleSubmit controls the next-question flow
      // to avoid duplicate calls and race conditions.
    } catch (error: any) {
      console.error('Submit response error:', error);
      set({ error: error.message || 'Failed to submit response' });
      throw error; // re-throw so the page can catch it
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