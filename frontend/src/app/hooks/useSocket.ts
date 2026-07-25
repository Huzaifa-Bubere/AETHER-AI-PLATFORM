import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  autoConnect?: boolean;
}

interface SocketEvents {
  // Interview events
  'user-joined': (data: { userId: string; userEmail: string }) => void;
  'user-left': (data: { userId: string; userEmail: string }) => void;
  'interview-started': (data: { userId: string; timestamp: string }) => void;
  'interview-ended': (data: { userId: string; timestamp: string }) => void;
  'answer-received': (data: { userId: string; questionId: string; duration: number; timestamp: string }) => void;
  
  // Analysis events
  'video-analysis': (data: { timestamp: number; emotions: any; eyeContact: number; posture: number }) => void;
  'audio-analysis': (data: { timestamp: number; volume?: number; speechRate?: number; clarity?: number; fillerPercentage?: number; totalWords?: number }) => void;
  
  // Notification events
  'notification': (data: { type: string; title: string; message: string; timestamp: string }) => void;
  'system-notification': (data: { type: string; title: string; message: string; timestamp: string }) => void;
  
  // User events
  'user-typing': (data: { userId: string; userEmail: string }) => void;
  'user-stopped-typing': (data: { userId: string; userEmail: string }) => void;
  'user-disconnected': (data: { userId: string; userEmail: string; reason: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('No authentication token available');
      return;
    }

    // Socket.IO connects to the backend root (not /api).
    // VITE_API_BASE_URL may include /api suffix — strip it.
    const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
    const socketUrl = rawBase.replace(/\/api\/?$/, '');

    // Create socket connection
    const socket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
      setError(err.message);
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [autoConnect]);

  // Join interview room
  const joinInterview = (interviewId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-interview', interviewId);
    }
  };

  // Leave interview room
  const leaveInterview = (interviewId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-interview', interviewId);
    }
  };

  // Send interview start event
  const sendInterviewStart = (interviewId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('interview-start', { interviewId });
    }
  };

  // Send interview end event
  const sendInterviewEnd = (interviewId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('interview-end', { interviewId });
    }
  };

  // Send question answered event
  const sendQuestionAnswered = (data: {
    interviewId: string;
    questionId: string;
    answer: string;
    duration: number;
  }) => {
    if (socketRef.current) {
      socketRef.current.emit('question-answered', data);
    }
  };

  // Send video frame for analysis
  const sendVideoFrame = (data: {
    interviewId: string;
    frameData: string;
    timestamp: number;
  }) => {
    if (socketRef.current) {
      socketRef.current.emit('video-frame', data);
    }
  };

  // Send audio chunk for analysis
  const sendAudioChunk = (data: {
    interviewId: string;
    audioData?: ArrayBuffer;
    transcript?: string;
    timestamp: number;
  }) => {
    if (socketRef.current) {
      socketRef.current.emit('audio-chunk', data);
    }
  };

  // Send typing indicator
  const sendTypingStart = (interviewId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('typing-start', { interviewId });
    }
  };

  const sendTypingStop = (interviewId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('typing-stop', { interviewId });
    }
  };

  // Subscribe to events
  const on = <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler as any);
    }
  };

  // Unsubscribe from events
  const off = <K extends keyof SocketEvents>(event: K, handler?: SocketEvents[K]) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event, handler as any);
      } else {
        socketRef.current.off(event);
      }
    }
  };

  // Emit custom event
  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinInterview,
    leaveInterview,
    sendInterviewStart,
    sendInterviewEnd,
    sendQuestionAnswered,
    sendVideoFrame,
    sendAudioChunk,
    sendTypingStart,
    sendTypingStop,
    on,
    off,
    emit,
  };
}
