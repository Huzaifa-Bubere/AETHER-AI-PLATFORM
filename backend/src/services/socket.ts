import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import logger from '../utils/logger';
import webrtcService from './webrtc';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  interviewId?: string;
}

// ── Python AI server helper ───────────────────────────────────────────────────
async function callPythonAI(path: string, payload: any): Promise<any> {
  const url = process.env.PYTHON_AI_SERVER_URL;
  const key = process.env.PYTHON_AI_SERVER_API_KEY;
  if (!url || !key) {
    throw new Error('PYTHON_AI_SERVER_URL or PYTHON_AI_SERVER_API_KEY not configured');
  }
  const res = await axios.post(`${url}${path}`, payload, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: 10000,
  });
  return res.data?.data ?? res.data;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  interviewId?: string;
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Setup WebRTC handlers
  webrtcService.setupWebRTCHandlers(io);

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: ${socket.id}, User: ${socket.userId}`);

    // Join interview room
    socket.on('join-interview', (interviewId: string) => {
      socket.interviewId = interviewId;
      socket.join(`interview-${interviewId}`);
      logger.info(`User ${socket.userId} joined interview ${interviewId}`);
      
      // Notify others in the room
      socket.to(`interview-${interviewId}`).emit('user-joined', {
        userId: socket.userId,
        timestamp: new Date(),
      });
    });

    // Leave interview room
    socket.on('leave-interview', (interviewId: string) => {
      socket.leave(`interview-${interviewId}`);
      logger.info(`User ${socket.userId} left interview ${interviewId}`);
      
      socket.to(`interview-${interviewId}`).emit('user-left', {
        userId: socket.userId,
        timestamp: new Date(),
      });
    });

    // Real-time interview updates
    socket.on('interview-update', (data: any) => {
      const { interviewId, type, payload } = data;
      
      // Broadcast to all users in the interview room
      io.to(`interview-${interviewId}`).emit('interview-update', {
        type,
        payload,
        timestamp: new Date(),
      });
      
      logger.info(`Interview update: ${type} for interview ${interviewId}`);
    });

    // Real-time analysis updates
    socket.on('analysis-update', (data: any) => {
      const { interviewId, analysisType, metrics } = data;
      
      // Send analysis update to the specific user
      socket.emit('analysis-result', {
        analysisType,
        metrics,
        timestamp: new Date(),
      });
      
      logger.info(`Analysis update: ${analysisType} for user ${socket.userId}`);
    });

    // Video frame analysis — calls Python AI server
    socket.on('video-frame', async (data: any) => {
      const { interviewId, frameData, timestamp } = data;

      try {
        if (!frameData) {
          socket.emit('video-analysis-error', { error: 'No frame data provided' });
          return;
        }

        const result = await callPythonAI('/api/emotion/analyze', {
          image_data: frameData,
          timestamp: timestamp ?? Date.now(),
        });

        socket.emit('video-analysis', {
          emotions: result.emotions ?? {},
          eyeContact: 0,
          posture: 0,
          faceDetected: true,
          frameQuality: 'good',
          timestamp,
        });
      } catch (error: any) {
        logger.error('Video frame analysis error:', error.message);
        socket.emit('video-analysis-error', { error: error.message });
      }
    });

    // Audio chunk analysis — calls Python AI server
    socket.on('audio-chunk', async (data: any) => {
      const { interviewId, audioData, transcript } = data;

      try {
        // If transcript provided, run filler-word + speech pattern analysis
        if (transcript) {
          const fillerResult = await callPythonAI('/api/audio/filler-words', {
            transcript,
            timestamps: [],
          });

          socket.emit('audio-analysis', {
            fillerWords: fillerResult.filler_frequency ?? {},
            fillerPercentage: fillerResult.filler_percentage ?? 0,
            totalWords: fillerResult.total_words ?? 0,
            assessment: fillerResult.assessment ?? '',
            timestamp: Date.now(),
          });
          return;
        }

        // If raw audio data provided, run full audio analysis
        if (audioData) {
          const result = await callPythonAI('/api/audio/analyze', {
            audio_data: audioData,
            sample_rate: 44100,
            duration: 0,
          });

          socket.emit('audio-analysis', {
            speechRate: result.speech_rate?.words_per_minute ?? 0,
            speechRateAssessment: result.speech_rate?.assessment ?? '',
            clarityScore: result.clarity_score ?? 0,
            volumeAssessment: result.volume_analysis?.volume_assessment ?? '',
            pauseCount: result.pause_analysis?.length ?? 0,
            timestamp: Date.now(),
          });
          return;
        }

        socket.emit('audio-analysis-error', { error: 'No audio data or transcript provided' });
      } catch (error: any) {
        logger.error('Audio chunk analysis error:', error.message);
        socket.emit('audio-analysis-error', { error: error.message });
      }
    });

    // Code execution updates
    socket.on('code-execution', (data: any) => {
      const { interviewId, language, status } = data;
      
      socket.to(`interview-${interviewId}`).emit('code-execution-update', {
        language,
        status,
        timestamp: new Date(),
      });
    });

    // Typing indicator
    socket.on('typing', (data: any) => {
      const { interviewId, isTyping } = data;
      
      socket.to(`interview-${interviewId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping,
      });
    });

    // Question navigation
    socket.on('question-change', (data: any) => {
      const { interviewId, questionIndex } = data;
      
      socket.to(`interview-${interviewId}`).emit('question-changed', {
        userId: socket.userId,
        questionIndex,
        timestamp: new Date(),
      });
    });

    // Interview status updates
    socket.on('interview-status', (data: any) => {
      const { interviewId, status } = data;
      
      io.to(`interview-${interviewId}`).emit('status-update', {
        status,
        timestamp: new Date(),
      });
      
      logger.info(`Interview ${interviewId} status: ${status}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error);
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}, User: ${socket.userId}`);
      
      if (socket.interviewId) {
        socket.to(`interview-${socket.interviewId}`).emit('user-left', {
          userId: socket.userId,
          timestamp: new Date(),
        });
      }
    });
  });

  logger.info('Socket.IO handlers initialized');
}
