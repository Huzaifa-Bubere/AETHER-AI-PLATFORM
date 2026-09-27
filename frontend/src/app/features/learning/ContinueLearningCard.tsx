import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, Loader2, AlertTriangle, Bookmark } from 'lucide-react';
import learningTopicsService, {
  type ContinueLearningItem, type TopicRecommendation,
} from '../../services/learningTopics';
import { Card } from '../../components/ui/card';

/**
 * AETHER Career Learning — dashboard Continue Learning (spec §51) and
 * evidence-based recommendations (spec §59, §64).
 *
 * Every number here comes from stored TopicProgress/quiz records. With no
 * activity the card shows an honest empty state instead of a fake chart.
 */
export default function ContinueLearningCard() {
  const [items, setItems] = useState<ContinueLearningItem[]>([]);
  const [emptyState, setEmptyState] = useState<string | null>(null);
  const [recs, setRecs] = useState<TopicRecommendation[]>([]);
  const [recEmpty, setRecEmpty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      learningTopicsService.continueLearning(),
      learningTopicsService.recommendations(),
    ])
      .then(([cont, rec]) => {
        if (cancelled) return;
        if (cont.status === 'fulfilled') {
          setItems(cont.value.items || []);
          setEmptyState(cont.value.emptyState ?? null);
        } else {
          setEmptyState('Learning progress is unavailable right now.');
        }
        if (rec.status === 'fulfilled') {
          setRecs(rec.value.recommendations || []);
          setRecEmpty(rec.value.emptyState ?? null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your learning activity…
        </div>
      </Card>
    );
  }

  const hasAnything = items.length > 0 || recs.length > 0;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Continue Learning</h3>
            <p className="text-xs text-muted-foreground">
              {items.length > 0
                ? `${items.length} lesson${items.length === 1 ? '' : 's'} in progress · saved to your account`
                : 'Your lesson progress, quizzes and notes live here'}
            </p>
          </div>
        </div>
        <Link to="/career-learning" className="text-xs text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap">
          All topics <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {!hasAnything && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="text-[13px] text-foreground font-medium">No learning activity yet.</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {emptyState || 'Start with a topic from any role roadmap — every topic is a full lesson with examples, practice and a quiz.'}
          </p>
          <Link to="/career-learning" className="mt-3 inline-flex">
            <span className="text-xs font-bold text-primary inline-flex items-center gap-1">
              Browse topics <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <Link key={item.topicSlug} to={`/career-learning/topics/${item.topicSlug}`}
              className="group rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{item.group}</span>
                {item.state === 'REVIEW_NEEDED' && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> review
                  </span>
                )}
              </div>
              <p className="text-[14px] font-bold text-foreground group-hover:text-primary transition-colors mt-1 truncate">{item.title}</p>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${item.progressPercent}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10.5px] text-muted-foreground">
                <span>{item.progressPercent}% · {item.estimatedMinutes} min</span>
                {item.bestQuizScore != null && <span>quiz {item.bestQuizScore}%</span>}
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                Continue <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {recs.length > 0 && (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5" /> Recommended next — based on your quiz results and target role
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {recs.map(r => (
              <Link key={r.slug} to={`/career-learning/topics/${r.slug}`}
                className="group rounded-xl border border-border bg-secondary/30 p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">{r.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{r.reason}</p>
              </Link>
            ))}
          </div>
          {recEmpty && <p className="text-[11px] text-muted-foreground">{recEmpty}</p>}
        </div>
      )}
    </Card>
  );
}
