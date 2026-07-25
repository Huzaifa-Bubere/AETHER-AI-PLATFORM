import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';

// WebRTC type definitions for Node.js environment
type RTCSessionDescriptionInit = {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
};

type RTCIceCandidateInit = {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
};

interface PeerConnection {
  userId: string;
  interviewId: string;
  socket: Socket;
}

class WebRTCService {
  private peers: Map<string, PeerConnection> = new Map();

  setupWebRTCHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
      logger.info(`WebRTC: Client connected ${socket.id}`);

      // Handle WebRTC offer
      socket.on('webrtc:offer', (data: {
        interviewId: string;
        offer: RTCSessionDescriptionInit;
        targetUserId?: string;
      }) => {
        logger.info(`WebRTC: Offer received for interview ${data.interviewId}`);
        
        // Broadcast offer to other participants in the interview
        socket.to(`interview-${data.interviewId}`).emit('webrtc:offer', {
          userId: (socket as any).userId,
          offer: data.offer,
        });
      });

      // Handle WebRTC answer
      socket.on('webrtc:answer', (data: {
        interviewId: string;
        answer: RTCSessionDescriptionInit;
        targetUserId?: string;
      }) => {
        logger.info(`WebRTC: Answer received for interview ${data.interviewId}`);
        
        // Send answer to the specific peer
        socket.to(`interview-${data.interviewId}`).emit('webrtc:answer', {
          userId: (socket as any).userId,
          answer: data.answer,
        });
      });

      // Handle ICE candidate
      socket.on('webrtc:ice-candidate', (data: {
        interviewId: string;
        candidate: RTCIceCandidateInit;
        targetUserId?: string;
      }) => {
        logger.info(`WebRTC: ICE candidate received for interview ${data.interviewId}`);
        
        // Forward ICE candidate to other participants
        socket.to(`interview-${data.interviewId}`).emit('webrtc:ice-candidate', {
          userId: (socket as any).userId,
          candidate: data.candidate,
        });
      });

      // Handle peer ready
      socket.on('webrtc:ready', (data: {
        interviewId: string;
      }) => {
        logger.info(`WebRTC: Peer ready for interview ${data.interviewId}`);
        
        // Store peer connection
        this.peers.set(socket.id, {
          userId: (socket as any).userId,
          interviewId: data.interviewId,
          socket,
        });

        // Notify other participants
        socket.to(`interview-${data.interviewId}`).emit('webrtc:peer-ready', {
          userId: (socket as any).userId,
        });
      });

      // Handle peer disconnect
      socket.on('webrtc:disconnect', (data: {
        interviewId: string;
      }) => {
        logger.info(`WebRTC: Peer disconnecting from interview ${data.interviewId}`);
        
        // Remove peer connection
        this.peers.delete(socket.id);

        // Notify other participants
        socket.to(`interview-${data.interviewId}`).emit('webrtc:peer-disconnected', {
          userId: (socket as any).userId,
        });
      });

      // Handle socket disconnect
      socket.on('disconnect', () => {
        const peer = this.peers.get(socket.id);
        if (peer) {
          logger.info(`WebRTC: Peer ${peer.userId} disconnected from interview ${peer.interviewId}`);
          
          // Notify other participants
          socket.to(`interview-${peer.interviewId}`).emit('webrtc:peer-disconnected', {
            userId: peer.userId,
          });

          // Remove peer connection
          this.peers.delete(socket.id);
        }
      });
    });

    logger.info('WebRTC handlers initialized');
  }

  // Get active peers for an interview
  getInterviewPeers(interviewId: string): PeerConnection[] {
    return Array.from(this.peers.values()).filter(
      (peer) => peer.interviewId === interviewId
    );
  }

  // Get peer count for an interview
  getInterviewPeerCount(interviewId: string): number {
    return this.getInterviewPeers(interviewId).length;
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;
