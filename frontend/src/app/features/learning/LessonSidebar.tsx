import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, Lock, PlayCircle, Bookmark, BookmarkCheck, StickyNote,
  Loader2, Sparkles, Send, AlertTriangle, Save,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import learningTopicsService, {
  type TopicNavItem, type TopicState, type AskAnswer,
} from '../../services/learningTopics';
import { Button } from '../../components/ui/button';

/**
 * AETHER Career Learning — the left navigation column and right learning-tools
 * column (spec §48–§51, §55).
 */

const STATE_ICON: Record<TopicState, typeof Circle> = {
  COMPLETED: CheckCircle2,
  IN_PROGRESS: PlayCircle,
  REVIEW_NEEDED: AlertTriangle,
  NOT_STARTED: Circle,
};

const STATE_COLOR: Record<TopicState, string> = {
  COMPLETED: 'text-emerald-600',
  IN_PROGRESS: 'text-blue-600',
  REVIEW_NEEDED: 'text-amber-600',
  NOT_STARTED: 'text-muted-foreground/50',
};

export function TopicNavColumn({
  activeSlug, groups, topics, onSelectGroup, activeGroup,
}: {
  activeSlug: string;
  groups: string[];
  topics: TopicNavItem[];
  activeGroup: string | null;
  onSelectGroup: (g: string | null) => void;
}) {
  const done = topics.filter(t => t.state === 'COMPLETED').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Course navigation</h2>
        <span className="text-[11px] text-muted-foreground">{done}/{topics.length} done</span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${topics.length ? Math.round((done / topics.length) * 100) : 0}%` }} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onSelectGroup(null)}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${activeGroup === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
          All
        </button>
        {groups.map(g => (
          <button key={g} onClick={() => onSelectGroup(g)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${activeGroup === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
            {g}
          </button>
        ))}
      </div>

      <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1">
        {topics.map(t => {
          const Icon = STATE_ICON[t.state];
          const isActive = t.slug === activeSlug;
          return (
            <Link
              key={t.slug}
              to={`/career-learning/topics/${t.slug}`}
              className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-secondary/70 text-foreground'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${STATE_COLOR[t.state]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t.title}</span>
                <span className="block text-[10.5px] text-muted-foreground">
                  {t.estimatedMinutes} min · {t.level}
                  {t.state === 'REVIEW_NEEDED' ? ' · review needed' : ''}
                  {t.locked ? ' · prerequisite' : ''}
                </span>
              </span>
              {t.locked && <Lock className="w-3 h-3 text-muted-foreground mt-1 shrink-0" />}
              {t.bookmarked && <BookmarkCheck className="w-3 h-3 text-primary mt-1 shrink-0" />}
            </Link>
          );
        })}
        {topics.length === 0 && (
          <p className="text-[12px] text-muted-foreground px-1 py-2">No published topics in this group yet.</p>
        )}
      </nav>
    </div>
  );
}

export function LearningTools({
  slug, title, state, bookmarked, notes, bestQuizScore, attempts,
  onState, onBookmark, onNotes,
}: {
  slug: string;
  title: string;
  state: TopicState;
  bookmarked: boolean;
  notes: string;
  bestQuizScore: number | null;
  attempts: number;
  onState: (state: TopicState) => Promise<void> | void;
  onBookmark: () => Promise<void> | void;
  onNotes: (notes: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(notes || '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const onNotesRef = useRef(onNotes);
  useEffect(() => { onNotesRef.current = onNotes; }, [onNotes]);
  useEffect(() => { setDraft(notes || ''); dirtyRef.current = false; setSaveState('idle'); }, [notes, slug]);

  // Debounced autosave to the backend — notes survive a refresh (spec §50).
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        await onNotesRef.current(draft);
        dirtyRef.current = false;
        setSaveState('saved');
        setLastSaved(new Date().toLocaleTimeString());
      } catch {
        setSaveState('error');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const ask = async (text: string) => {
    const q = text.trim();
    if (q.length < 3) { toast.error('Ask a slightly longer question.'); return; }
    setAsking(true);
    setAskError(null);
    try {
      const res = await learningTopicsService.ask(slug, q);
      setAnswer(res);
    } catch (e: any) {
      // Spec §56: the lesson stays 100% readable when the AI is unavailable.
      setAskError(e?.message || 'AETHER AI is unavailable right now — the lesson above is complete without it.');
      setAnswer(null);
    } finally {
      setAsking(false);
    }
  };

  const quickPrompts = [
    'Explain this more simply',
    'Give me another example',
    'Quiz me on this topic',
    'Ask me an interview question',
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-bold text-foreground">Your progress</h2>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">State</span>
            <span className="font-semibold text-foreground">{state.replace(/_/g, ' ').toLowerCase()}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Best quiz score</span>
            <span className="font-semibold text-foreground">{bestQuizScore != null ? `${bestQuizScore}%` : '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Quiz attempts</span>
            <span className="font-semibold text-foreground">{attempts}</span>
          </div>
        </div>
        <div className="grid gap-1.5">
          {state !== 'COMPLETED' ? (
            <Button size="sm" onClick={() => onState('COMPLETED')} className="text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark complete
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onState('REVIEW_NEEDED')} className="text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Mark for review
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onBookmark} className="text-xs">
            {bookmarked
              ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1 text-primary" /> Bookmarked</>
              : <><Bookmark className="w-3.5 h-3.5 mr-1" /> Bookmark</>}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5 text-primary" /> Notes
          </h2>
          <span className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1">
            {saveState === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>}
            {saveState === 'saved' && <><Save className="w-3 h-3 text-emerald-600" /> Saved {lastSaved}</>}
            {saveState === 'error' && <span className="text-rose-600">Save failed</span>}
            {saveState === 'idle' && (notes ? 'Autosaves' : 'Autosaves as you type')}
          </span>
        </div>
        <textarea
          value={draft}
          onChange={e => { dirtyRef.current = true; setDraft(e.target.value); }}
          rows={5}
          placeholder={`Notes on ${title}…`}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        <p className="text-[10.5px] text-muted-foreground">Saved to your account — visible after a refresh.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
        <h2 className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Ask AETHER
        </h2>
        <p className="text-[10.5px] text-muted-foreground">
          Supplementary only — it answers from this lesson's stored content.
        </p>
        <div className="flex gap-1.5">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(question); }}
            placeholder="Ask about this topic…"
            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={() => ask(question)} disabled={asking} className="text-xs shrink-0">
            {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map(p => (
            <button key={p} onClick={() => { setQuestion(p); ask(p); }} disabled={asking}
              className="text-[10.5px] px-2 py-1 rounded-full border border-border bg-secondary/50 hover:border-primary/40 text-foreground transition-colors disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>

        {askError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] text-amber-800">
            {askError}
          </div>
        )}
        {answer && (
          <div className="rounded-lg border border-border bg-secondary/40 p-2.5 space-y-1.5">
            <p className="text-[12.5px] text-foreground whitespace-pre-wrap leading-relaxed">{answer.answer}</p>
            {answer.points?.length ? (
              <ul className="list-disc pl-4 space-y-0.5">
                {answer.points.map((p, i) => <li key={i} className="text-[11.5px] text-muted-foreground">{p}</li>)}
              </ul>
            ) : null}
            {answer.example && <p className="text-[11.5px] text-muted-foreground"><strong className="text-foreground">Example: </strong>{answer.example}</p>}
            {answer.groundedIn && <p className="text-[10px] text-muted-foreground/80">Grounded in: {answer.groundedIn}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
