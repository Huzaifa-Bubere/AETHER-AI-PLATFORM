import { aptitudeImageUrl } from '../../lib/aptitudeApi';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useCallback, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAptitudeStore } from '../../store/aptitudeStore';
import Timer from '../../components/aptitude/Timer';
import QuestionPalette from '../../components/aptitude/QuestionPalette';
import { useIntegrityMonitor } from '../../app/features/integrity/useIntegrityMonitor';
import { DEFAULT_POLICIES } from '../../app/features/integrity/integrity.types';
import { IntegrityWarningModal } from '../../app/features/integrity/IntegrityWarningModal';
import { IntegrityIndicator } from '../../app/features/integrity/IntegrityIndicator';

export default function ExamRoom() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Technical MCQ shares this room — module determines the integrity policy.
  const module = searchParams.get('round') === 'technical' ? DEFAULT_POLICIES.TECHNICAL_MCQ : DEFAULT_POLICIES.APTITUDE;
  const {
    loading,
    error,
    questions,
    responses,
    currentIndex,
    deadline,
    submitted,
    submitting,
    saving,
    navigating,
    flushCurrent,
    reset,
    attemptId: loadedAttemptId,
    loadAttempt,
    goTo,
    selectOption,
    clearResponse,
    toggleMarkForReview,
    saveAndNext,
    submit,
  } = useAptitudeStore();

  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  useEffect(() => {
    if (attemptId) loadAttempt(attemptId);
    return reset;
  }, [attemptId, loadAttempt, reset]);

  useEffect(() => {
    if (loading || submitted || !questions.length) return;
    const interval = setInterval(() => { if (!useAptitudeStore.getState().submitting) void flushCurrent(); }, 15000);
    return () => clearInterval(interval);
  }, [loading, submitted, questions.length, flushCurrent]);

  useEffect(() => {
    if (submitted && loadedAttemptId === attemptId && !loading) navigate(`/aptitude/attempts/${attemptId}/result`, { replace: true });
  }, [submitted, loadedAttemptId, loading, attemptId, navigate]);

  // Warn before refresh/close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Shared integrity system (5 warnings → auto-submit) ────────────────────
  const integrity = useIntegrityMonitor({
    policy: module,
    attemptId: attemptId ?? null,
    active: !loading && !submitted && loadedAttemptId === attemptId,
    // Warning 5: flush the current answer, then submit. The backend grades
    // whatever was actually answered — unanswered stays unanswered.
    onAutoSubmit: async () => {
      await flushCurrent().catch(() => {});
      await submit(true);
    },
  });

  useEffect(() => {
    if (integrity.requestFullscreen) integrity.requestFullscreen();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enterFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {
      /* fullscreen may be blocked — exam still works without it */
    });
  }, []);

  useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen, loading]);

  const handleExpire = useCallback(() => {
    submit(true);
  }, [submit]);

  if (loading) return <CenteredMessage text="Loading your exam…" />;
  if (error && !questions.length) return <div className="px-6 pt-32"><p role="alert">{error}</p><button onClick={() => attemptId && loadAttempt(attemptId)} className="mt-4 text-primary underline">Retry loading exam</button></div>;
  if (!questions.length) return <CenteredMessage text="No questions loaded." isError />;

  const q = questions[currentIndex];
  const r = responses[q._id];
  const statuses = questions.map((qq) => responses[qq._id]?.status ?? 'not-visited');

  return (
    <div ref={containerRef} className="min-h-screen bg-background pt-16 text-foreground">
      {error && <p role="alert" className="bg-red-50 p-4 text-red-700">{error} <button disabled={submitting || navigating} onClick={() => { setConfirmSubmitOpen(false); void submit(deadline ? Date.now() >= deadline.getTime() : false); }} className="underline">Retry submission</button></p>}
      <p role="status" className="px-6 text-sm text-muted-foreground">{submitting ? 'Submitting…' : saving ? 'Saving answer…' : 'Answers save automatically.'}</p>
      {/* Top bar */}
      <header className="sticky top-16 z-10 flex flex-wrap gap-2 items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div>
          <p className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {questions.length} · {q.category.replace(/-/g, ' ')} · <span className="uppercase">{q.difficulty}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <IntegrityIndicator warningCount={integrity.warningCount} maximumWarnings={integrity.maximumWarnings} active={!submitted} />
          {deadline && <Timer deadline={deadline} onExpire={handleExpire} />}
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row gap-6 p-4 sm:p-6">
        {/* Question area */}
        <main className="flex-1">
          {q.imageUrl && <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="rounded-md bg-secondary px-3 py-1 text-sm hover:bg-muted"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="w-12 text-center text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="rounded-md bg-secondary px-3 py-1 text-sm hover:bg-muted"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>

            <div className="flex justify-center overflow-auto rounded-lg bg-white p-4" style={{ maxHeight: '60vh' }}>
              {q.imageUrl && <img
                src={aptitudeImageUrl(q.imageUrl)}
                alt={`Question ${currentIndex + 1}`}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                className="select-none transition-transform"
                draggable={false}
              />}
            </div>
          </div>}

          {q.questionText && <p className="mt-4 whitespace-pre-wrap text-lg">{q.questionText}</p>}
          {/* Options */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => (
              <button
                key={opt}
                disabled={submitting || navigating}
                onClick={() => selectOption(opt)}
                className={`rounded-lg border px-4 py-3 text-left font-medium transition-colors ${
                  r?.selectedOption === opt
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-border bg-card hover:border-border'
                }`}
              >
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-sm">
                  {opt}
                </span>
                {/* Image-only questions carry their options inside the image. */}
                {q.imageUrl ? '' : (q.options?.[opt] || `Option ${opt}`)}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0 || submitting || navigating}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                disabled={submitting || navigating} onClick={clearResponse}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Clear Response
              </button>
              <button
                disabled={submitting || navigating} onClick={toggleMarkForReview}
                className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-medium hover:bg-violet-600"
              >
                Mark for Review & Next
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={submitting || navigating} onClick={saveAndNext}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {currentIndex < questions.length - 1 ? 'Save & Next →' : 'Save'}
              </button>
              <button
                disabled={submitting || navigating} onClick={() => setConfirmSubmitOpen(true)}
                className="rounded-lg bg-emerald-600 text-white px-5 py-2 text-sm font-semibold hover:bg-emerald-500"
              >
                Submit Test
              </button>
            </div>
          </div>
        </main>

        <QuestionPalette total={questions.length} currentIndex={currentIndex} statuses={statuses} onNavigate={goTo} disabled={submitting || navigating} />
      </div>

      {confirmSubmitOpen && (
        <ConfirmSubmitModal
          answered={statuses.filter((s) => s === 'answered' || s === 'answered-marked-for-review').length}
          total={questions.length}
          onCancel={() => setConfirmSubmitOpen(false)}
          onConfirm={() => { setConfirmSubmitOpen(false); void submit(false); }}
        />
      )}

      {/* Shared integrity warning modal (warnings 1–4) */}
      {integrity.modalEvent && !integrity.shouldAutoSubmit && (
        <IntegrityWarningModal
          event={integrity.modalEvent}
          warningNumber={integrity.modalWarningNumber}
          maximumWarnings={integrity.maximumWarnings}
          onContinue={integrity.dismissModal}
        />
      )}

      {/* Warning-5 auto-submit overlay — huge full-screen red */}
      {integrity.submittingWork && (
        <div className="fixed inset-0 z-[210] bg-red-700 flex flex-col items-center justify-center gap-4">
          <ShieldAlert className="w-20 h-20 text-white animate-pulse" />
          <p className="text-4xl font-black tracking-tight text-white text-center px-4">ASSESSMENT TERMINATED</p>
          <p className="text-lg font-bold text-red-100 text-center px-4">Maximum integrity warnings reached (5 of 5)</p>
          <p className="text-sm text-red-200 text-center px-4">Your answers are being saved and your attempt is being submitted.</p>
        </div>
      )}
    </div>
  );
}

function ConfirmSubmitModal({
  answered,
  total,
  onCancel,
  onConfirm,
}: {
  answered: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Submit the test?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You've answered {answered} of {total} questions. Once submitted, you can't change your responses.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg bg-secondary px-4 py-2 text-sm hover:bg-muted">
            Keep Reviewing
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
            Submit Now
          </button>
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className={isError ? 'text-destructive' : 'text-muted-foreground'}>{text}</p>
    </div>
  );
}
