import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, Loader2, Lock,
  Target, Compass, GraduationCap, ExternalLink, ListChecks, Layers, AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import learningTopicsService, {
  type TopicPage, type TopicNavItem, type TopicState, type TopicLink,
} from '../services/learningTopics';
import { Card } from '../components/ui/card';
import LessonVideo from '../features/learning/LessonVideo';
import LessonQuiz from '../features/learning/LessonQuiz';
import { TopicNavColumn, LearningTools } from '../features/learning/LessonSidebar';
import {
  LessonSections, LessonExamples, LessonCommonMistakes, LessonInterviewTips, LessonPractice,
} from '../features/learning/LessonContent';

/**
 * AETHER Career Learning — the real lesson page (spec §30–§36, §48–§56, §70).
 *
 * Everything rendered here comes from the LearningTopic document in MongoDB:
 * overview, objectives, structured content, multiple examples, common mistakes,
 * interview tips, tiered practice, quiz, resources, stored video metadata,
 * prerequisites and next/related topics. AETHER AI is a supplementary panel,
 * never the lesson itself.
 */
export default function LearningTopicPage() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const [searchParams] = useSearchParams();
  const roleSlug = searchParams.get('role') || undefined;
  const fromNode = searchParams.get('node') || undefined;

  const [page, setPage] = useState<TopicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState<TopicNavItem[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(null);
    learningTopicsService.getTopic(topicSlug!)
      .then(data => {
        if (cancelled) return;
        setPage(data);
        setError(null);
        if (data.topic.group) setGroup(data.topic.group);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [topicSlug]);

  useEffect(() => {
    learningTopicsService.listTopics(roleSlug ? { role: roleSlug } : {})
      .then(res => { setNav(res.topics || []); setGroups(res.groups || []); })
      .catch(() => { /* navigation is non-critical; the lesson still renders */ });
  }, [roleSlug]);

  const visibleNav = useMemo(
    () => (group ? nav.filter(t => t.group === group) : nav),
    [nav, group],
  );

  const updateState = async (state: TopicState) => {
    try {
      const res = await learningTopicsService.setState(topicSlug!, state);
      setPage(p => (p ? { ...p, progress: { ...p.progress, state: res.state } } : p));
      setNav(list => list.map(t => (t.slug === res.topicSlug ? { ...t, state: res.state } : t)));
      toast.success(state === 'COMPLETED' ? 'Topic completed 🎉' : 'Progress updated');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update progress');
    }
  };

  const toggleBookmark = async () => {
    try {
      const res = await learningTopicsService.toggleBookmark(topicSlug!);
      setPage(p => (p ? { ...p, progress: { ...p.progress, bookmarked: res.bookmarked } } : p));
      setNav(list => list.map(t => (t.slug === res.topicSlug ? { ...t, bookmarked: res.bookmarked } : t)));
    } catch (e: any) {
      toast.error(e?.message || 'Could not update bookmark');
    }
  };

  const saveNotes = async (notes: string) => {
    const res = await learningTopicsService.saveNotes(topicSlug!, notes);
    setPage(p => (p ? { ...p, progress: { ...p.progress, notes: res.notes } } : p));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
        <div className="mx-auto max-w-7xl flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading lesson from the content database…
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
        <div className="mx-auto max-w-3xl space-y-4">
          <Card className="p-6 rounded-2xl border-destructive/30">
            <p className="text-sm font-semibold text-destructive mb-1">This lesson could not be loaded</p>
            <p className="text-[13px] text-muted-foreground">{error || 'Topic not found or not published.'}</p>
          </Card>
          <Link to="/career-learning" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to career learning
          </Link>
        </div>
      </div>
    );
  }

  const { topic, progress, prerequisites, nextTopics, relatedTopics, videos, videoStatus, stats } = page;
  const requiredPrereqs = prerequisites.filter(p => !p.optional);
  const optionalPrereqs = prerequisites.filter(p => p.optional);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Link to="/career-learning" className="hover:text-foreground inline-flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" /> Career Learning
          </Link>
          {roleSlug && (
            <>
              <span>/</span>
              <Link to={`/career-learning/${roleSlug}`} className="hover:text-foreground">{roleSlug.replace(/-/g, ' ')}</Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground font-medium">{topic.title}</span>
        </div>

        <div className="grid lg:grid-cols-[230px_minmax(0,1fr)_290px] gap-5 items-start">
          {/* ── Left: course navigation ── */}
          <aside className="hidden lg:block lg:sticky lg:top-20">
            <TopicNavColumn
              activeSlug={topic.slug}
              topics={visibleNav}
              groups={groups}
              activeGroup={group}
              onSelectGroup={setGroup}
            />
          </aside>

          {/* ── Middle: the lesson ── */}
          <main className="min-w-0 space-y-4">
            {/* Header (spec §49) */}
            <Card className="p-5 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{topic.group}</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground capitalize">{topic.level}</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {topic.estimatedMinutes} min
                </span>
                <span className={`px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                  progress.state === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : progress.state === 'REVIEW_NEEDED' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : progress.state === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-secondary text-muted-foreground border-border'
                }`}>
                  {progress.state === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : null}
                  {progress.state.replace(/_/g, ' ').toLowerCase()}
                </span>
                {progress.bestQuizScore != null && (
                  <span className="text-muted-foreground">Quiz best: <strong className="text-foreground">{progress.bestQuizScore}%</strong></span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{topic.title}</h1>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{topic.shortDescription}</p>
              </div>

              {topic.whyItMatters && (
                <div className="rounded-xl bg-secondary/50 border border-border p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Why it matters</p>
                  <p className="text-[13.5px] text-foreground/90 leading-relaxed">{topic.whyItMatters}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-[11.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {stats.totalBlocks} content blocks</span>
                <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> {stats.exampleCount} examples</span>
                <span className="inline-flex items-center gap-1"><Target className="w-3 h-3" /> {stats.practiceCount} practice</span>
                <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" /> {stats.quizCount} quiz questions</span>
              </div>

              {fromNode && (
                <Link to={`/career-learning/${roleSlug}`} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back to the roadmap step “{fromNode}”
                </Link>
              )}
            </Card>

            {(requiredPrereqs.length > 0 || optionalPrereqs.length > 0) && (
              <Card className="p-4 rounded-2xl space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prerequisites</p>
                <div className="flex flex-wrap gap-2">
                  {requiredPrereqs.map(p => (
                    <Link key={p.slug} to={`/career-learning/topics/${p.slug}`}
                      className={`text-[12px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                        p.state === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-card border-border hover:border-primary/40'
                      }`}>
                      {p.state === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {p.title}
                      <span className="text-[10px] text-muted-foreground">{p.estimatedMinutes} min</span>
                    </Link>
                  ))}
                  {optionalPrereqs.map(p => (
                    <Link key={p.slug} to={`/career-learning/topics/${p.slug}`}
                      className="text-[12px] px-2.5 py-1 rounded-full border bg-card border-border hover:border-primary/40 inline-flex items-center gap-1.5">
                      {p.title}
                      <span className="text-[10px] text-muted-foreground">optional</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5 rounded-2xl space-y-3">
              <h2 className="text-base font-bold inline-flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> What is {topic.title}?
              </h2>
              <p className="text-[14.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{topic.description}</p>
            </Card>

            {topic.learningObjectives.length > 0 && (
              <Card className="p-5 rounded-2xl space-y-2.5">
                <h2 className="text-base font-bold inline-flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Learning objectives
                </h2>
                <p className="text-[12px] text-muted-foreground">By the end of this topic you should be able to:</p>
                <ul className="space-y-1.5">
                  {topic.learningObjectives.map((o, i) => (
                    <li key={i} className="text-[13.5px] text-foreground/90 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {o}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-5 rounded-2xl">
              <LessonSections sections={topic.sections} />
            </Card>

            <Card className="p-5 rounded-2xl">
              <LessonExamples examples={topic.examples} />
            </Card>

            {topic.commonMistakes.length > 0 && (
              <Card className="p-5 rounded-2xl">
                <LessonCommonMistakes mistakes={topic.commonMistakes} />
              </Card>
            )}

            {topic.interviewTips.length > 0 && (
              <Card className="p-5 rounded-2xl">
                <LessonInterviewTips tips={topic.interviewTips} />
              </Card>
            )}

            {topic.interviewRelevance && (
              <Card className="p-5 rounded-2xl space-y-1.5">
                <h2 className="text-base font-bold inline-flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" /> How this appears in interviews
                </h2>
                <p className="text-[13.5px] text-foreground/90 leading-relaxed">{topic.interviewRelevance}</p>
              </Card>
            )}

            {topic.practice.length > 0 && (
              <Card className="p-5 rounded-2xl">
                <LessonPractice practice={topic.practice} />
              </Card>
            )}

            <LessonVideo videos={videos} status={videoStatus} />

            <LessonQuiz
              slug={topic.slug}
              onStateChange={state => {
                setPage(p => (p ? { ...p, progress: { ...p.progress, state, attempts: p.progress.attempts + 1 } } : p));
                setNav(list => list.map(t => (t.slug === topic.slug ? { ...t, state } : t)));
              }}
            />

            {topic.resources.length > 0 && (
              <Card className="p-5 rounded-2xl space-y-2">
                <h2 className="text-base font-bold inline-flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary" /> Official resources
                </h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {topic.resources.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-foreground truncate">{r.title}</span>
                        <span className="block text-[10.5px] text-muted-foreground">{r.provider} · {r.type}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Next / related (spec §54) */}
            <Card className="p-5 rounded-2xl space-y-3">
              <h2 className="text-base font-bold">Continue the curriculum</h2>
              {nextTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Next</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {nextTopics.map(t => <TopicLinkCard key={t.slug} topic={t} highlight />)}
                  </div>
                </div>
              )}
              {relatedTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Related</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {relatedTopics.map(t => <TopicLinkCard key={t.slug} topic={t} />)}
                  </div>
                </div>
              )}
              {nextTopics.length === 0 && relatedTopics.length === 0 && (
                <p className="text-[13px] text-muted-foreground">
                  This topic has no linked follow-ups yet — browse the course navigation for what comes next.
                </p>
              )}
            </Card>

            {progress.state === 'REVIEW_NEEDED' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800 inline-flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                You scored below 60% on this topic's quiz, so it is marked “review needed”. Revisit the sections above, then retry the quiz.
              </div>
            )}
          </main>

          {/* ── Right: learning tools ── */}
          <aside className="lg:sticky lg:top-20">
            <LearningTools
              slug={topic.slug}
              title={topic.title}
              state={progress.state}
              bookmarked={progress.bookmarked}
              notes={progress.notes}
              bestQuizScore={progress.bestQuizScore}
              attempts={progress.attempts}
              onState={updateState}
              onBookmark={toggleBookmark}
              onNotes={saveNotes}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function TopicLinkCard({ topic, highlight = false }: { topic: TopicLink; highlight?: boolean }) {
  return (
    <Link to={`/career-learning/topics/${topic.slug}`}
      className={`group rounded-xl border p-3 transition-colors ${highlight ? 'border-primary/30 bg-primary/5 hover:border-primary' : 'border-border bg-card hover:border-primary/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-foreground group-hover:text-primary transition-colors">{topic.title}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
      <p className="text-[11.5px] text-muted-foreground line-clamp-2 mt-0.5">{topic.shortDescription}</p>
      <p className="text-[10.5px] text-muted-foreground mt-1 capitalize">
        {topic.level}{topic.estimatedMinutes ? ` · ${topic.estimatedMinutes} min` : ''}
      </p>
    </Link>
  );
}
