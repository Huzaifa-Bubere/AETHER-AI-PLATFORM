import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Square, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { SpeechRecognition } from '../components/interview/SpeechRecognition';
import { groupDiscussionApi, type GdSession, type GdTurn } from '../services/groupDiscussion';

/**
 * AETHER Group Discussion room.
 *
 * This is a VOICE-FIRST discussion. The design rule that shapes everything
 * below: a group discussion is people talking, so
 *  - the microphone is the primary input (Web Speech API), the textarea is the
 *    fallback for browsers without speech recognition,
 *  - AI participants are spoken aloud (SpeechSynthesis) so the candidate is
 *    actually responding to a spoken point, not reading a wall of text,
 *  - the floor is NEVER locked. The candidate may speak at any moment while the
 *    discussion is active. The previous version only rendered the composer when
 *    the last turn was an AI turn, so when the AI provider returned nothing (no
 *    API key, quota, outage) — including the very first turn of a new session —
 *    the composer never appeared and the discussion was unusable.
 */

function minutesSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function elapsedFromStartedAt(startedAt?: string | null) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export default function GroupDiscussionRoomPage() {
  const { sessionId = '' } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState<GdSession | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiOffline, setAiOffline] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [recordingSaved, setRecordingSaved] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const spokenSeqRef = useRef<number | null>(null);
  const listeningStartedAtRef = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStartedAtRef = useRef<number | null>(null);

  mutedRef.current = muted;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await groupDiscussionApi.get(sessionId);
      setSession(s);
    } catch (e: any) {
      setError(e.message || 'Could not load the discussion.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A live clock so the remaining-time display is honest without re-fetching.
  useEffect(() => {
    const t = setInterval(() => setElapsed(elapsedFromStartedAt(session?.startedAt)), 1000);
    return () => clearInterval(t);
  }, [session?.startedAt]);

  // ── AI participants speak aloud ───────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback((line: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // never talk over a previous line
    if (mutedRef.current) return;
    const u = new SpeechSynthesisUtterance(line);
    u.rate = 1;
    u.pitch = 1;
    u.lang = 'en-US';
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false); // TTS unavailable — the text is on screen
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    const turns = session?.turns ?? [];
    const aiTurns = turns.filter((t) => t.speakerType === 'AI');
    if (!aiTurns.length) return;
    const latest = aiTurns[aiTurns.length - 1];

    if (spokenSeqRef.current === null) {
      // Entering the room: voice the opening statement once so the candidate
      // hears the point they are expected to respond to.
      spokenSeqRef.current = latest.sequence;
      speak(latest.text);
      return;
    }
    if (latest.sequence > spokenSeqRef.current) {
      spokenSeqRef.current = latest.sequence;
      speak(latest.text);
    }
  }, [session, speak]);

  // Stop any speech when leaving the room.
  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const remainingSeconds = Math.max(
    0,
    (session?.startedAt
      ? session.durationMinutes * 60 - elapsed
      : session?.durationMinutes * 60) || 0,
  );

  const deadlinePassed = !!session?.startedAt && elapsed >= session.durationMinutes * 60;

  const candidateTurns = (session?.turns ?? []).filter((t) => t.speakerType === 'CANDIDATE').length;

  // ── Sending a point ───────────────────────────────────────────────────────
  const sendPoint = async (source: 'VOICE' | 'TEXT') => {
    const body = text.trim();
    if (!body || sending) return;
    const durationSeconds = source === 'VOICE' && listeningStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - listeningStartedAtRef.current) / 1000))
      : 0;

    setSending(true);
    setError('');
    stopSpeaking();       // the AI must not talk over the candidate
    setListening(false);  // release the mic while the participants answer
    listeningStartedAtRef.current = null;
    setAiThinking(true);
    try {
      const { session: next, aiReplied } = await groupDiscussionApi.turn(sessionId, {
        text: body,
        source,
        durationSeconds,
      });
      setSession(next);
      setText('');
      setAiOffline(!aiReplied);
    } catch (e: any) {
      setError(e.message || 'Could not send your point.');
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  };

  const startListening = () => {
    stopSpeaking(); // the AI must not be heard through the microphone
    setError('');
    listeningStartedAtRef.current = Date.now();
    setListening(true);
  };

  const stopListening = () => {
    setListening(false);
  };

  const onTranscript = (transcript: string, isFinal: boolean) => {
    if (!isFinal) return;
    const clean = transcript.trim();
    if (!clean) return;
    setText((prev) => (prev ? `${prev.trim()} ${clean}` : clean));
  };

  const endDiscussion = async () => {
    try {
      stopSpeaking();
      setListening(false);
      const { recordedEvidence } = await groupDiscussionApi.end(sessionId);
      // A discussion with no candidate contribution is not scored evidence, so
      // there is no report to show.
      nav(recordedEvidence ? `/group-discussion/${sessionId}/report` : '/group-discussion');
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Optional recording (real audio capture, real upload) ──────────────────
  const setConsent = async (consent: boolean) => {
    try {
      await groupDiscussionApi.consentRecording(sessionId, consent);
      setSession((prev) => (prev ? { ...prev, recordingConsent: consent } : prev));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot capture audio.');
      return;
    }
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      recorderChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) recorderChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordingActive(false);
        if (!blob.size) {
          setError('No audio was captured, so nothing was saved.');
          return;
        }
        const seconds = recorderStartedAtRef.current
          ? Math.round((Date.now() - recorderStartedAtRef.current) / 1000)
          : 0;
        setUploadingRecording(true);
        try {
          await groupDiscussionApi.attachRecording(sessionId, blob, seconds);
          setRecordingSaved(true);
        } catch (e: any) {
          setError(e.message || 'The recording could not be saved.');
        } finally {
          setUploadingRecording(false);
        }
      };

      recorderRef.current = recorder;
      recorderStartedAtRef.current = Date.now();
      recorder.start();
      setRecordingActive(true);
    } catch (e: any) {
      setError(e?.name === 'NotAllowedError'
        ? 'Microphone permission denied, so recording could not start.'
        : 'Recording could not start on this device.');
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
  };

  if (loading || session === undefined) {
    return <div className="p-8 text-center">Loading discussion…</div>;
  }

  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Discussion not found.'}</p>
        <Button className="mt-4" onClick={() => nav('/group-discussion')}>
          Back to setup
        </Button>
      </div>
    );
  }

  const topicTitle = session.topicSnapshot?.title || 'Group Discussion';
  const participants = session.participants ?? [];
  const isActive = session.status === 'IN_PROGRESS';
  const lastTurn = session.turns?.[session.turns.length - 1];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{topicTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {participants.length} AI participant{participants.length === 1 ? '' : 's'} ·{' '}
            {session.difficulty} · {session.durationMinutes} minutes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setMuted((m) => !m); stopSpeaking(); }}
            className="rounded-full border border-border p-2 text-muted-foreground hover:bg-muted"
            title={muted ? 'Unmute AI participants' : 'Mute AI participants'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <div className="text-right">
            <span className="text-lg tabular-nums font-mono">{minutesSeconds(remainingSeconds)}</span>
            <span className="ml-1 text-sm text-muted-foreground">remaining</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Who is in the room and who is talking right now */}
      <section className="grid gap-2 sm:grid-cols-2">
        {participants.map((p) => {
          const talking = speaking && lastTurn?.speakerName === p.name;
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-3 text-sm ${talking ? 'border-primary bg-primary/10' : 'bg-card'}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.style}</span>
                {talking && <span className="text-xs text-primary">speaking…</span>}
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border bg-primary/5 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">You</span>
            <span className="text-xs text-muted-foreground">
              {listening ? 'microphone live' : 'Candidate'}
            </span>
          </div>
        </div>
      </section>

      {aiOffline && isActive && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The AI participants could not respond — the AI service was unavailable or rate-limited.
          You can keep contributing your own points; they are still recorded and scored from what you
          actually say.
        </div>
      )}

      {/* Transcript */}
      <section className="max-h-[45vh] overflow-y-auto rounded-xl border bg-card p-4 space-y-3">
        {session.turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has spoken yet. Open the discussion with your own first point.
          </p>
        ) : (
          session.turns.map((t: GdTurn) => (
            <article
              key={t.sequence}
              className={t.speakerType === 'CANDIDATE' ? 'rounded bg-primary/10 p-3' : 'rounded bg-muted p-3'}
            >
              <div className="flex items-center justify-between">
                <b>{t.speakerName}</b>
                <span className="text-xs text-muted-foreground">
                  {t.source === 'VOICE' ? 'voice' : 'text'}
                  {t.durationSeconds ? ` · ${t.durationSeconds}s` : ''}
                </span>
              </div>
              <p className="mt-1 text-sm">{t.text}</p>
            </article>
          ))
        )}
      </section>

      {/* Recording consent + capture */}
      {isActive && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Optional recording</p>
            <p className="text-xs text-muted-foreground">
              Recording is off unless you consent and press record. Nothing is captured
              before you consent.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border"
              checked={!!session.recordingConsent}
              onChange={(e) => void setConsent(e.target.checked)}
            />
            <span>I consent to microphone recording of my own speaking turns for this session.</span>
          </label>

          {session.recordingConsent && (
            <div className="flex flex-wrap items-center gap-3">
              {recordingActive ? (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="mr-2 h-3.5 w-3.5" /> Stop recording
                </Button>
              ) : (
                <Button variant="outline" onClick={startRecording} disabled={uploadingRecording}>
                  <Mic className="mr-2 h-3.5 w-3.5" /> Record my audio
                </Button>
              )}
              {uploadingRecording && (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading recording…
                </span>
              )}
              {recordingSaved && !uploadingRecording && (
                <span className="inline-flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Recording saved ({session.recording?.sizeBytes
                    ? `${Math.round(session.recording.sizeBytes / 1024)} KB`
                    : 'stored'})
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Composer — always available while the discussion is active */}
      {isActive ? (
        <section className="space-y-3">
          <SpeechRecognition
            isListening={listening}
            onStartListening={startListening}
            onStopListening={stopListening}
            onTranscript={onTranscript}
            onSpeechStart={() => setError('')}
            onSpeechEnd={() => { /* keep the mic open until the candidate stops it */ }}
          />

          <textarea
            ref={textareaRef}
            className="w-full rounded border p-3 resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Speak using the microphone, or type your point here…"
            rows={4}
          />

          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={() => void sendPoint(listening ? 'VOICE' : 'TEXT')} disabled={!text.trim() || sending}>
              {sending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              {sending ? 'Waiting for participants…' : 'Send my point'}
            </Button>
            <Button
              variant="outline"
              disabled={sending}
              onClick={() => { setText('I pass this turn.'); }}
            >
              Pass
            </Button>
            <Button variant="destructive" onClick={() => void endDiscussion()} disabled={sending}>
              End discussion
            </Button>
            {listening && (
              <span className="inline-flex items-center gap-2 text-xs text-emerald-700">
                <Mic className="h-3.5 w-3.5" /> Microphone live — {text ? 'press “Send my point” when you finish' : 'start speaking'}
              </span>
            )}
            {!listening && !text && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <MicOff className="h-3.5 w-3.5" /> Click the mic to speak, or type
              </span>
            )}
          </div>

          {aiThinking && (
            <p className="text-xs text-muted-foreground">AI participants are responding…</p>
          )}
          {deadlinePassed && (
            <p className="text-sm text-amber-700">
              Time is up. End the discussion to see your report.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            You can speak at any time — {candidateTurns} contribution
            {candidateTurns === 1 ? '' : 's'} so far. Build on a point, disagree politely, or add a
            concrete example.
          </p>
        </section>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => nav(`/group-discussion/${sessionId}/report`)}>View report</Button>
          <Button variant="outline" onClick={() => nav('/group-discussion')}>New discussion</Button>
        </div>
      )}
    </div>
  );
}
