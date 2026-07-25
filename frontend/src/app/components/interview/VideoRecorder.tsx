import { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, Mic, MicOff, AlertTriangle, RefreshCw } from 'lucide-react';

interface VideoRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onVideoData?: (data: Blob) => void;
  onVideoFrame?: (frameData: string) => void;
  className?: string;
}

export function VideoRecorder({
  isRecording,
  onStartRecording,
  onStopRecording,
  onVideoData,
  onVideoFrame,
  className = '',
}: VideoRecorderProps) {
  const videoRef         = useRef<HTMLVideoElement>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const frameTimerRef    = useRef<number | null>(null);

  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Stop all tracks ───────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => {
    return () => {
      if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    };
  }, []);

  // ── Initialize media ──────────────────────────────────────────────────
  const initMedia = useCallback(async (forceAudioOnly = false) => {
    stopStream();
    setStatus('loading');
    setErrorMsg('');
    setAudioOnly(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Camera API unavailable. Use Chrome/Firefox/Edge over HTTPS or localhost.');
      setStatus('error');
      return;
    }

    const attempts: MediaStreamConstraints[] = forceAudioOnly
      ? [{ video: false, audio: true }]
      : [
          {
            // Bug 28 fix: remove facingMode:'user' — causes black screen on desktop GPUs
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          },
          { video: true, audio: true },
          { video: false, audio: true },
        ];

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e: any) {
        lastErr = e;
        const n: string = e.name || '';
        if (n === 'NotAllowedError' || n === 'PermissionDeniedError') break;
        continue;
      }
    }

    if (!stream) {
      const n: string = lastErr?.name || '';
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
        setErrorMsg('Camera/microphone permission denied.\nClick the 🔒 icon in your browser address bar → allow Camera & Microphone → retry.');
      } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
        setErrorMsg('No camera or microphone found. Connect a device and retry.');
      } else if (n === 'NotReadableError' || n === 'TrackStartError') {
        setErrorMsg('Camera is in use by another app (Zoom, Teams…). Close it and retry.');
      } else {
        setErrorMsg(`Could not access media: ${lastErr?.message || 'Unknown error'}`);
      }
      setStatus('error');
      return;
    }

    streamRef.current = stream;

    const vTracks = stream.getVideoTracks();
    const aTracks = stream.getAudioTracks();
    const gotVideo = vTracks.length > 0;

    setAudioOnly(!gotVideo);
    setHasVideo(gotVideo);
    setHasAudio(aTracks.length > 0);

    // Attach stream to video element BEFORE setting status to ready
    if (gotVideo && videoRef.current) {
      videoRef.current.srcObject = stream;
      // Bug 29 fix: wait for metadata before playing so first frame is visible
      await new Promise<void>(resolve => {
        if (!videoRef.current) { resolve(); return; }
        if (videoRef.current.readyState >= 1) { resolve(); return; }
        videoRef.current.onloadedmetadata = () => resolve();
        setTimeout(resolve, 3000); // fallback timeout
      });
      try { await videoRef.current.play(); } catch { /* autoplay blocked — muted so fine */ }
    }

    setStatus('ready');
  }, [stopStream]);

  useEffect(() => { initMedia(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Emit low-frequency preview frames for backend AI analysis
  useEffect(() => {
    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (!onVideoFrame || status !== 'ready' || audioOnly) return;
    frameTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg', 0.6);
        onVideoFrame(frameData);
      } catch {
        // non-fatal: skip this frame
      }
    }, 5000);
    return () => {
      if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    };
  }, [onVideoFrame, status, audioOnly]);

  // ── Drive recording from prop ─────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !streamRef.current) return;

    if (isRecording) {
      chunksRef.current = [];
      const mimes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const mime = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' });
        onVideoData?.(blob);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      onStartRecording();
    } else {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      onStopRecording();
    }
  }, [isRecording, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle helpers ────────────────────────────────────────────────────
  const toggleVideo = () => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setHasVideo(t.enabled); }
  };
  const toggleAudio = () => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setHasAudio(t.enabled); }
  };

  // ── Shared wrapper style — always fills the parent container ──────────
  // The parent in InterviewRoomPage is a flex column with flex:1 and minHeight:0.
  // We must NOT use aspect-video here — it fights the grid layout.
  const wrapStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111827',
  };

  // ── Error state ───────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={wrapStyle} className={className}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 16, textAlign: 'center' }}>
          <AlertTriangle style={{ width: 28, height: 28, color: '#f59e0b', flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: '#fbbf24', whiteSpace: 'pre-line', lineHeight: 1.5, margin: 0 }}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => initMedia(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 11, height: 11 }} /> Retry
            </button>
            <button
              onClick={() => initMedia(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', cursor: 'pointer' }}
            >
              <Mic style={{ width: 11, height: 11 }} /> Audio only
            </button>
          </div>
        </div>
      </div>
    );
  }

  {(status === 'idle' || status === 'loading') && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: '#111827',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <Camera
      style={{
        width: 28,
        height: 28,
        color: '#4b5563',
      }}
    />

    <p
      style={{
        fontSize: 11,
        color: '#6b7280',
        margin: 0,
      }}
    >
      Starting camera…
    </p>
  </div>
)}

  // ── Ready state ───────────────────────────────────────────────────────
  return (
    <div style={wrapStyle} className={className}>
      {/* Video — always in DOM so ref is stable; hidden when audio-only */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: audioOnly ? 'none' : 'block',
        }}
      />

      {/* Audio-only placeholder */}
      {audioOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#6b7280' }}>
          <CameraOff style={{ width: 32, height: 32 }} />
          <p style={{ fontSize: 11, margin: 0 }}>Audio-only mode</p>
          {isRecording && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>● Recording audio</p>}
        </div>
      )}

      {/* REC badge */}
      {isRecording && (
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
          <span style={{ width: 5, height: 5, background: '#fff', borderRadius: '50%', animation: 'blink 1.2s ease infinite' }} />
          REC
        </div>
      )}

      {/* Camera / Mic toggles */}
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
        {!audioOnly && (
          <button
            onClick={toggleVideo}
            title={hasVideo ? 'Turn off camera' : 'Turn on camera'}
            style={{
              padding: 6, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: hasVideo ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.8)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            {hasVideo ? <Camera style={{ width: 13, height: 13 }} /> : <CameraOff style={{ width: 13, height: 13 }} />}
          </button>
        )}
        <button
          onClick={toggleAudio}
          title={hasAudio ? 'Mute mic' : 'Unmute mic'}
          style={{
            padding: 6, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: hasAudio ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.8)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          {hasAudio ? <Mic style={{ width: 13, height: 13 }} /> : <MicOff style={{ width: 13, height: 13 }} />}
        </button>
      </div>
    </div>
  );
}
