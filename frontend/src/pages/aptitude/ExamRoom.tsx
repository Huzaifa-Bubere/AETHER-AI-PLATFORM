import { useEffect, useCallback, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAptitudeStore } from '../../store/aptitudeStore';
import Timer from '../../components/aptitude/Timer';
import QuestionPalette from '../../components/aptitude/QuestionPalette';

export default function ExamRoom() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const {
    loading,
    error,
    questions,
    responses,
    currentIndex,
    deadline,
    submitted,
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
  const tabSwitchCountRef = useRef(0);

  useEffect(() => {
    if (attemptId) loadAttempt(attemptId);
  }, [attemptId, loadAttempt]);

  useEffect(() => {
    if (submitted) navigate(`/aptitude/attempts/${attemptId}/result`, { replace: true });
  }, [submitted, attemptId, navigate]);

  // Warn before refresh/close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Tab-switch / minimize -> auto-submit (per spec)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !submitted) {
        tabSwitchCountRef.current += 1;
        submit(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [submit, submitted]);

  const enterFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {
      /* fullscreen may be blocked — exam still works without it */
    });
  }, []);

  useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  const handleExpire = useCallback(() => {
    submit(true);
  }, [submit]);

  if (loading) return <CenteredMessage text="Loading your exam…" />;
  if (error) return <CenteredMessage text={error} isError />;
  if (!questions.length) return <CenteredMessage text="No questions loaded." isError />;

  const q = questions[currentIndex];
  const r = responses[q._id];
  const statuses = questions.map((qq) => responses[qq._id]?.status ?? 'not-visited');

  return (
    <div ref={containerRef} className="min-h-screen bg-background pt-16 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div>
          <p className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {questions.length} · {q.category.replace(/-/g, ' ')} · <span className="uppercase">{q.difficulty}</span>
          </p>
        </div>
        {deadline && <Timer deadline={deadline} onExpire={handleExpire} />}
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        {/* Question area */}
        <main className="flex-1">
          <div className="rounded-xl border border-border bg-card p-4">
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
              <img
                src={q.imageUrl}
                alt={`Question ${currentIndex + 1}`}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                className="select-none transition-transform"
                draggable={false}
              />
            </div>
          </div>

          {/* Options */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => (
              <button
                key={opt}
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
                Option {opt}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                onClick={clearResponse}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Clear Response
              </button>
              <button
                onClick={toggleMarkForReview}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium hover:bg-violet-600"
              >
                Mark for Review & Next
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveAndNext}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {currentIndex < questions.length - 1 ? 'Save & Next →' : 'Save'}
              </button>
              <button
                onClick={() => setConfirmSubmitOpen(true)}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold hover:bg-emerald-500"
              >
                Submit Test
              </button>
            </div>
          </div>
        </main>

        <QuestionPalette total={questions.length} currentIndex={currentIndex} statuses={statuses} onNavigate={goTo} />
      </div>

      {confirmSubmitOpen && (
        <ConfirmSubmitModal
          answered={statuses.filter((s) => s === 'answered' || s === 'answered-marked-for-review').length}
          total={questions.length}
          onCancel={() => setConfirmSubmitOpen(false)}
          onConfirm={() => submit(false)}
        />
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
          <button onClick={onConfirm} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
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