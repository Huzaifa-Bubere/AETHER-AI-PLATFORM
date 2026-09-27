import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2, RotateCcw, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import learningTopicsService, { type QuizQuestionView, type QuizResult, type TopicState } from '../../services/learningTopics';
import { Button } from '../../components/ui/button';

/**
 * AETHER Career Learning — topic quiz (spec §57–§58).
 *
 * Questions and grading both come from the backend; the browser never receives
 * the answer key before submitting. Results show the score, the wrong topic tags
 * and evidence-based review recommendations.
 */
export default function LessonQuiz({
  slug, onStateChange,
}: { slug: string; onStateChange?: (state: TopicState) => void }) {
  const [questions, setQuestions] = useState<QuizQuestionView[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setResult(null);
    setAnswers([]);
    learningTopicsService.getQuiz(slug)
      .then(res => { setQuestions(res.questions || []); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (answers.filter(a => typeof a === 'number').length < questions.length) {
      toast.error('Answer every question before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await learningTopicsService.submitQuiz(slug, answers);
      setResult(res);
      onStateChange?.(res.stateAfter);
      toast.success(`Quiz scored ${res.score}%`);
      window.setTimeout(() => document.getElementById('quiz-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    } catch (e: any) {
      toast.error(e?.message || 'Quiz submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading quiz…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{error}</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        No quiz has been authored for this topic yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" /> Topic quiz
          <span className="text-[11px] font-normal text-muted-foreground">({questions.length} questions)</span>
        </h2>
        {result && (
          <Button size="sm" variant="outline" onClick={load} className="text-xs">
            <RotateCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        )}
      </div>

      {!result && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id || qi}>
              <p className="text-[13.5px] font-medium text-foreground mb-1.5">
                {qi + 1}. {q.question}
              </p>
              <div className="grid gap-1.5">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setAnswers(a => { const next = [...a]; next[qi] = oi; return next; })}
                    className={`text-left text-[13px] px-3 py-2 rounded-lg border transition-colors ${
                      answers[qi] === oi
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'bg-card border-border hover:border-primary/30 text-foreground'
                    }`}
                  >
                    <span className="font-bold mr-1.5">{String.fromCharCode(65 + oi)}.</span>{opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={submit} disabled={submitting} className="w-full text-sm font-bold">
            {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Submit quiz
          </Button>
        </div>
      )}

      {result && (
        <div id="quiz-result" className="space-y-3">
          <div className={`rounded-xl border p-4 ${result.score >= 60 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-2xl font-extrabold ${result.score >= 60 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {result.correct} / {result.total}
              <span className="text-base font-bold ml-2">{result.score}%</span>
            </p>
            <p className="text-[12.5px] text-foreground/80 mt-0.5">
              {result.score >= 60
                ? 'Passed. The topic stays available for review.'
                : 'Below 60% — this topic is now marked Review needed in your progress.'}
            </p>
          </div>

          {result.results.map((r, i) => (
            <div key={r.id || i} className="flex items-start gap-2 text-[12.5px]">
              {r.correct
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              <div>
                <p className="text-foreground">
                  Q{i + 1}: {r.correct ? 'Correct' : `Correct answer is ${String.fromCharCode(65 + r.correctIndex)}`}
                  {r.topicTag ? <span className="text-muted-foreground"> · {r.topicTag}</span> : null}
                </p>
                {r.explanation && <p className="text-muted-foreground leading-relaxed">{r.explanation}</p>}
              </div>
            </div>
          ))}

          {result.recommendations.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Recommended next</p>
              <div className="space-y-1.5">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{rec.title}</p>
                      <p className="text-[11.5px] text-muted-foreground">{rec.reason}</p>
                    </div>
                    {rec.slug && (
                      <Link to={`/career-learning/topics/${rec.slug}`} className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 whitespace-nowrap">
                        Review <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
