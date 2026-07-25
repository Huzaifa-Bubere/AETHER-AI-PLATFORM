import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket';

interface UseWebRTCOptions {
  interviewId: string;
  autoConnect?: boolean;
}

export function useWebRTC({ interviewId, autoConnect = false }: UseWebRTCOptions) {
  const { socket, isConnected } = useSocket({ autoConnect: true });
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(iceServers);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice-candidate', {
          interviewId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        setIsReady(true);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection failed');
        setIsConnecting(false);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [interviewId, socket]);

  // Add local stream to peer connection
  const addLocalStream = useCallback(async (stream: MediaStream) => {
    const pc = initializePeerConnection();
    localStreamRef.current = stream;

    // Add tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    console.log('Local stream added to peer connection');
  }, [initializePeerConnection]);

  // Create offer
  const createOffer = useCallback(async () => {
    if (!socket || !isConnected) {
      setError('Socket not connected');
      return;
    }

    try {
      setIsConnecting(true);
      const pc = initializePeerConnection();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', {
        interviewId,
        offer: offer.toJSON(),
      });

      console.log('Offer created and sent');
    } catch (err: any) {
      console.error('Error creating offer:', err);
      setError(err.message);
      setIsConnecting(false);
    }
  }, [socket, isConnected, interviewId, initializePeerConnection]);

  // Handle incoming offer
  const handleOffer = useCallback(async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
    try {
      const pc = initializePeerConnection();

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('webrtc:answer', {
          interviewId,
          answer: answer.toJSON(),
        });
      }

      console.log('Answer created and sent');
    } catch (err: any) {
      console.error('Error handling offer:', err);
      setError(err.message);
    }
  }, [interviewId, socket, initializePeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('No peer connection available');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('Answer received and set');
    } catch (err: any) {
      console.error('Error handling answer:', err);
      setError(err.message);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('No peer connection available');
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      console.log('ICE candidate added');
    } catch (err: any) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);

    socket.on('webrtc:peer-ready', (data: { userId: string }) => {
      console.log('Peer ready:', data.userId);
    });

    socket.on('webrtc:peer-disconnected', (data: { userId: string }) => {
      console.log('Peer disconnected:', data.userId);
      setRemoteStream(null);
    });

    return () => {
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('webrtc:peer-ready');
      socket.off('webrtc:peer-disconnected');
    };
  }, [socket, isConnected, handleOffer, handleAnswer, handleIceCandidate]);

  // Notify that we're ready
  const notifyReady = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('webrtc:ready', { interviewId });
    }
  }, [socket, isConnected, interviewId]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('webrtc:disconnect', { interviewId });
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setRemoteStream(null);
    setIsReady(false);
    setIsConnecting(false);
  }, [socket, isConnected, interviewId]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && isConnected && !isReady && !isConnecting) {
      notifyReady();
    }
  }, [autoConnect, isConnected, isReady, isConnecting, notifyReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isReady,
    isConnecting,
    error,
    remoteStream,
    addLocalStream,
    createOffer,
    notifyReady,
    disconnect,
  };
}
