import { useRef, useEffect, useState, useCallback } from 'react';

interface AudioAnalysisData {
  volume: number;
  frequency: number;
  speechRate: number;
  pauseDuration: number;
  isActive: boolean;
}

interface UseAudioAnalysisReturn {
  analysisData: AudioAnalysisData;
  startAnalysis: () => Promise<void>;
  stopAnalysis: () => void;
  isAnalyzing: boolean;
  error: string | null;
}

export function useAudioAnalysis() {
  const [analysisData, setAnalysisData] = useState<AudioAnalysisData>({
    volume: 0,
    frequency: 0,
    speechRate: 0,
    pauseDuration: 0,
    isActive: false,
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Speech detection variables
  const speechStartTimeRef = useRef<number | null>(null);
  const lastSpeechTimeRef = useRef<number | null>(null);
  const wordCountRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number | null>(null);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyArray = new Uint8Array(bufferLength);
    
    analyserRef.current.getByteTimeDomainData(dataArray);
    analyserRef.current.getByteFrequencyData(frequencyArray);

    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = (dataArray[i] - 128) / 128;
      sum += sample * sample;
    }
    const volume = Math.sqrt(sum / bufferLength);

    // Calculate dominant frequency
    let maxIndex = 0;
    let maxValue = 0;
    for (let i = 0; i < frequencyArray.length; i++) {
      if (frequencyArray[i] > maxValue) {
        maxValue = frequencyArray[i];
        maxIndex = i;
      }
    }
    const frequency = (maxIndex * (audioContextRef.current?.sampleRate || 44100)) / (2 * bufferLength);

    // Detect speech activity
    const speechThreshold = 0.01;
    const isActive = volume > speechThreshold;
    const currentTime = Date.now();

    // Use refs to avoid dependency on state that changes frequently
    let speechRate = 0;
    let pauseDuration = 0;

    if (isActive) {
      if (!speechStartTimeRef.current) {
        speechStartTimeRef.current = currentTime;
      }
      lastSpeechTimeRef.current = currentTime;
      
      if (pauseStartTimeRef.current) {
        pauseDuration = currentTime - pauseStartTimeRef.current;
        pauseStartTimeRef.current = null;
      }
    } else {
      if (lastSpeechTimeRef.current && !pauseStartTimeRef.current) {
        pauseStartTimeRef.current = currentTime;
      }
    }

    // Calculate speech rate (words per minute)
    if (speechStartTimeRef.current && lastSpeechTimeRef.current) {
      const speechDuration = (lastSpeechTimeRef.current - speechStartTimeRef.current) / 1000 / 60; // minutes
      if (speechDuration > 0) {
        speechRate = wordCountRef.current / speechDuration;
      }
    }

    setAnalysisData({
      volume: volume * 100,
      frequency,
      speechRate,
      pauseDuration,
      isActive,
    });

    animationRef.current = requestAnimationFrame(analyzeAudio);
  }, []); // Remove dependency on analysisData to prevent infinite loop

  const startAnalysis = useCallback(async () => {
    try {
      setError(null);
      setIsAnalyzing(true);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Create audio context and analyzer
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

      // Configure analyzer
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Connect nodes
      microphoneRef.current.connect(analyserRef.current);

      // Reset counters
      speechStartTimeRef.current = null;
      lastSpeechTimeRef.current = null;
      wordCountRef.current = 0;
      pauseStartTimeRef.current = null;

      // Start analysis loop
      analyzeAudio();

    } catch (err: any) {
      setError(err.message || 'Failed to start audio analysis');
      setIsAnalyzing(false);
    }
  }, [analyzeAudio]);

  const stopAnalysis = useCallback(() => {
    // Stop animation loop
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Disconnect nodes
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    analyserRef.current = null;
    setIsAnalyzing(false);
    
    // Reset analysis data
    setAnalysisData({
      volume: 0,
      frequency: 0,
      speechRate: 0,
      pauseDuration: 0,
      isActive: false,
    });
  }, []);

  // Method to update word count (called from speech recognition)
  const updateWordCount = useCallback((count: number) => {
    wordCountRef.current = count;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysis();
    };
  }, [stopAnalysis]);

  return {
    analysisData,
    startAnalysis,
    stopAnalysis,
    updateWordCount,
    isAnalyzing,
    error,
  };
}