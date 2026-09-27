import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, ChevronRight, Eye, EyeOff, Archive,
  CheckCircle2, AlertTriangle, RefreshCw, Video, ShieldCheck, Search,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import learningTopicsService, {
  type AdminTopicSummary, type AdminTopicDetail, type AdminTopicVideo,
  type TopicBlock, type BlockType, type TopicStatus,
} from '../../services/learningTopics';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

/**
 * AETHER Admin — learning content management (spec §39, §71).
 *
 * Editors change lessons in the database, not in React source: editing "Python"
 * here and refreshing the lesson page shows the new content immediately.
 */

const BLOCK_TYPES: BlockType[] = ['heading', 'paragraph', 'list', 'code', 'tip', 'warning', 'note', 'table', 'steps', 'compare'];

const STATUS_STYLE: Record<TopicStatus, string> = {
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-secondary text-muted-foreground border-border',
  review: 'bg-blue-50 text-blue-700 border-blue-200',
  archived: 'bg-amber-50 text-amber-700 border-amber-200',
};

const inputCls = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1';

function toLines(value: string): string[] {
  return value.split('\n').map(l => l.trim()).filter(Boolean);
}

export default function LearningContentAdminPage() {
  const [topics, setTopics] = useState<AdminTopicSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | TopicStatus>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminTopicDetail | null>(null);
  const [videos, setVideos] = useState<AdminTopicVideo[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [videoConfigured, setVideoConfigured] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadList = () => {
    setLoading(true);
    learningTopicsService.adminListTopics()
      .then(res => { setTopics(res.topics || []); setVideoConfigured(res.videoRefreshConfigured); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadList, []);

  const open = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    learningTopicsService.adminGetTopic(id)
      .then(res => { setDraft(res.topic); setVideos(res.videos || []); })
      .catch((e: Error) => toast.error(e.message));
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter(t =>
      (statusFilter === 'all' || t.status === statusFilter) &&
      (!q || t.title.toLowerCase().includes(q) || t.slug.includes(q)),
    );
  }, [topics, statusFilter, search]);

  const patch = (fields: Partial<AdminTopicDetail>) => setDraft(d => (d ? { ...d, ...fields } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await learningTopicsService.adminUpdateTopic(draft._id, {
        title: draft.title,
        shortDescription: draft.shortDescription,
        description: draft.description,
        whyItMatters: draft.whyItMatters,
        interviewRelevance: draft.interviewRelevance,
        group: draft.group,
        order: Number(draft.order) || 0,
        level: draft.level,
        estimatedMinutes: Number(draft.estimatedMinutes) || 30,
        learningObjectives: draft.learningObjectives,
        prerequisites: draft.prerequisites,
        optionalPrerequisites: draft.optionalPrerequisites,
        nextTopicSlugs: draft.nextTopicSlugs,
        relatedTopicSlugs: draft.relatedTopicSlugs,
        skillSlugs: draft.skillSlugs,
        roleSlugs: draft.roleSlugs,
        reviewedBy: draft.reviewedBy,
        sections: draft.sections,
        examples: draft.examples,
        commonMistakes: draft.commonMistakes,
        interviewTips: draft.interviewTips,
        practice: draft.practice,
        quiz: draft.quiz,
        resources: draft.resources,
      });
      setDraft({ ...res } as AdminTopicDetail);
      toast.success(`Saved — content version ${res.contentVersion}. The lesson page shows this immediately.`);
      loadList();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (action: 'publish' | 'unpublish' | 'archive') => {
    if (!draft) return;
    try {
      if (action === 'publish') await learningTopicsService.adminPublishTopic(draft._id);
      else if (action === 'unpublish') await learningTopicsService.adminUnpublishTopic(draft._id);
      else await learningTopicsService.adminArchiveTopic(draft._id);
      toast.success(action === 'publish' ? 'Published' : action === 'unpublish' ? 'Unpublished' : 'Archived');
      open(draft._id);
      loadList();
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    }
  };

  const refreshVideos = async (slug?: string) => {
    setRefreshing(true);
    try {
      const res = await learningTopicsService.adminRefreshVideos(slug ? { slug } : {});
      if (!res.configured) {
        toast.error(res.message || 'YOUTUBE_API_KEY is not configured — no metadata is fabricated.');
      } else {
        toast.success(`Refresh: ${res.topicsProcessed} topic(s), ${res.videosStored} video(s) stored${res.quotaExceeded ? ' (quota hit — stopped early)' : ''}`);
        if (draft) open(draft._id);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const createTopic = async () => {
    setCreating(true);
    try {
      const slug = window.prompt('New topic slug (kebab-case, e.g. graph-algorithms):')?.trim().toLowerCase();
      if (!slug) return;
      const title = window.prompt('Topic title (e.g. Graph Algorithms):')?.trim();
      if (!title) return;
      const created = await learningTopicsService.adminCreateTopic({
        slug,
        title,
        shortDescription: `${title} — add a one-line summary in the admin editor.`,
        description: `Write the lesson overview for ${title} here. A topic must never publish as an empty shell.`,
        level: 'beginner',
        group: 'General',
        status: 'draft',
      });
      toast.success('Draft topic created — add sections, examples and a quiz, then publish.');
      loadList();
      open(created._id);
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Admin
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight">Learning Content</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage database-backed lessons. Editing content here changes the learner's topic page — no source-code change needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => refreshVideos()} disabled={refreshing} className="text-xs">
              {refreshing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Refresh all videos
            </Button>
            <Button size="sm" onClick={createTopic} disabled={creating} className="text-xs font-bold">
              {creating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              New topic
            </Button>
          </div>
        </div>

        <Card className="p-3 rounded-2xl">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search topics by title or slug…"
                className={`${inputCls} pl-8`} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'published', 'draft', 'review', 'archived'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {!videoConfigured && (
            <p className="mt-2 text-[11px] text-amber-700 inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> YOUTUBE_API_KEY is not configured — video refresh is disabled and no metadata is fabricated.
            </p>
          )}
        </Card>

        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">
          {/* Topic list */}
          <Card className="p-2 rounded-2xl lg:sticky lg:top-20 max-h-[75vh] overflow-y-auto">
            {loading ? (
              <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading topics…
              </div>
            ) : visible.length === 0 ? (
              <p className="p-4 text-[13px] text-muted-foreground">No topics match this filter.</p>
            ) : (
              visible.map(t => (
                <button key={t._id} onClick={() => open(t._id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${selectedId === t._id ? 'bg-primary/10' : 'hover:bg-secondary/70'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[13px] font-semibold ${selectedId === t._id ? 'text-primary' : 'text-foreground'}`}>{t.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                    <span className="text-[10px] text-muted-foreground">{t.group} · v{t.contentVersion}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-1">
                    {t.counts?.blocks ?? 0} blocks · {t.counts?.examples ?? 0} examples · {t.counts?.quiz ?? 0} quiz
                  </p>
                </button>
              ))
            )}
          </Card>

          {/* Editor */}
          <div className="min-w-0 space-y-4">
            {!draft ? (
              <Card className="p-6 rounded-2xl text-sm text-muted-foreground">
                Select a topic to edit its lesson content, or create a new draft.
              </Card>
            ) : (
              <>
                <Card className="p-5 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold">{draft.title}</h2>
                      <p className="text-[11px] text-muted-foreground">
                        slug <code className="bg-secondary px-1 rounded">{draft.slug}</code> · v{draft.contentVersion} · {draft.source}
                        {draft.reviewedBy ? ` · reviewed by ${draft.reviewedBy}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" onClick={save} disabled={saving} className="text-xs font-bold">
                        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => changeStatus('publish')} className="text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Publish
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => changeStatus('unpublish')} className="text-xs">
                        <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Unpublish
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => changeStatus('archive')} className="text-xs">
                        <Archive className="w-3.5 h-3.5 mr-1.5" /> Archive
                      </Button>
                      <Link to={`/career-learning/topics/${draft.slug}`} target="_blank">
                        <Button size="sm" variant="ghost" className="text-xs">Preview lesson</Button>
                      </Link>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><label className={labelCls}>Title</label>
                      <input className={inputCls} value={draft.title} onChange={e => patch({ title: e.target.value })} /></div>
                    <div><label className={labelCls}>Group</label>
                      <input className={inputCls} value={draft.group} onChange={e => patch({ group: e.target.value })} /></div>
                    <div><label className={labelCls}>Short description</label>
                      <input className={inputCls} value={draft.shortDescription} onChange={e => patch({ shortDescription: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={labelCls}>Level</label>
                        <select className={inputCls} value={draft.level} onChange={e => patch({ level: e.target.value as any })}>
                          <option value="beginner">beginner</option>
                          <option value="intermediate">intermediate</option>
                          <option value="advanced">advanced</option>
                        </select></div>
                      <div><label className={labelCls}>Minutes</label>
                        <input type="number" className={inputCls} value={draft.estimatedMinutes} onChange={e => patch({ estimatedMinutes: Number(e.target.value) })} /></div>
                      <div><label className={labelCls}>Order</label>
                        <input type="number" className={inputCls} value={draft.order} onChange={e => patch({ order: Number(e.target.value) })} /></div>
                    </div>
                    <div className="sm:col-span-2"><label className={labelCls}>Overview (what is this topic?)</label>
                      <textarea rows={3} className={inputCls} value={draft.description} onChange={e => patch({ description: e.target.value })} /></div>
                    <div><label className={labelCls}>Why it matters</label>
                      <textarea rows={3} className={inputCls} value={draft.whyItMatters} onChange={e => patch({ whyItMatters: e.target.value })} /></div>
                    <div><label className={labelCls}>Interview relevance</label>
                      <textarea rows={3} className={inputCls} value={draft.interviewRelevance} onChange={e => patch({ interviewRelevance: e.target.value })} /></div>
                    <div><label className={labelCls}>Learning objectives (one per line)</label>
                      <textarea rows={5} className={inputCls} value={(draft.learningObjectives || []).join('\n')}
                        onChange={e => patch({ learningObjectives: toLines(e.target.value) })} /></div>
                    <div><label className={labelCls}>Prerequisites — required (slug per line)</label>
                      <textarea rows={2} className={inputCls} value={(draft.prerequisites || []).join('\n')}
                        onChange={e => patch({ prerequisites: toLines(e.target.value) })} />
                      <label className={`${labelCls} mt-2`}>Optional prerequisites (slug per line)</label>
                      <textarea rows={2} className={inputCls} value={(draft.optionalPrerequisites || []).join('\n')}
                        onChange={e => patch({ optionalPrerequisites: toLines(e.target.value) })} />
                    </div>
                    <div><label className={labelCls}>Next topics (slug per line)</label>
                      <textarea rows={2} className={inputCls} value={(draft.nextTopicSlugs || []).join('\n')}
                        onChange={e => patch({ nextTopicSlugs: toLines(e.target.value) })} />
                      <label className={`${labelCls} mt-2`}>Related topics (slug per line)</label>
                      <textarea rows={2} className={inputCls} value={(draft.relatedTopicSlugs || []).join('\n')}
                        onChange={e => patch({ relatedTopicSlugs: toLines(e.target.value) })} />
                    </div>
                    <div><label className={labelCls}>Skill slugs (per line)</label>
                      <textarea rows={2} className={inputCls} value={(draft.skillSlugs || []).join('\n')}
                        onChange={e => patch({ skillSlugs: toLines(e.target.value) })} />
                      <label className={`${labelCls} mt-2`}>Role slugs (per line)</label>
                      <textarea rows={2} className={inputCls} value={(draft.roleSlugs || []).join('\n')}
                        onChange={e => patch({ roleSlugs: toLines(e.target.value) })} />
                    </div>
                    <div><label className={labelCls}>Reviewed by</label>
                      <input className={inputCls} value={draft.reviewedBy || ''} onChange={e => patch({ reviewedBy: e.target.value })} /></div>
                  </div>
                </Card>

                {/* Sections */}
                <Card className="p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">Content sections ({(draft.sections || []).length})</h3>
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => patch({ sections: [...(draft.sections || []), { type: 'paragraph', content: '' }] })}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add block
                    </Button>
                  </div>
                  {(draft.sections || []).map((block, i) => (
                    <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select className={inputCls + ' max-w-[160px]'} value={block.type}
                          onChange={e => {
                            const sections = [...draft.sections];
                            sections[i] = { type: e.target.value as BlockType };
                            patch({ sections });
                          }}>
                          {BLOCK_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <span className="text-[10.5px] text-muted-foreground">#{i + 1}</span>
                        <div className="ml-auto flex gap-1">
                          <button className="text-[11px] text-muted-foreground hover:text-foreground px-2"
                            onClick={() => {
                              if (i === 0) return;
                              const sections = [...draft.sections];
                              [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]];
                              patch({ sections });
                            }}>↑</button>
                          <button className="text-[11px] text-muted-foreground hover:text-foreground px-2"
                            onClick={() => {
                              if (i === draft.sections.length - 1) return;
                              const sections = [...draft.sections];
                              [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]];
                              patch({ sections });
                            }}>↓</button>
                          <button className="text-[11px] text-rose-600 hover:text-rose-700 px-2"
                            onClick={() => patch({ sections: draft.sections.filter((_, j) => j !== i) })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <BlockFields block={block} onChange={next => {
                        const sections = [...draft.sections];
                        sections[i] = next;
                        patch({ sections });
                      }} />
                    </div>
                  ))}
                </Card>

                {/* Examples */}
                <Card className="p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">Worked examples ({(draft.examples || []).length})</h3>
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => patch({ examples: [...(draft.examples || []), { title: '', kind: 'Simple', explanation: '', language: 'text', code: '', output: '' }] })}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add example
                    </Button>
                  </div>
                  {(draft.examples || []).map((ex, i) => (
                    <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Example {i + 1}</p>
                        <button className="text-[11px] text-rose-600"
                          onClick={() => patch({ examples: draft.examples.filter((_, j) => j !== i) })}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <input className={inputCls} placeholder="Title" value={ex.title}
                          onChange={e => { const a = [...draft.examples]; a[i] = { ...ex, title: e.target.value }; patch({ examples: a }); }} />
                        <select className={inputCls} value={ex.kind}
                          onChange={e => { const a = [...draft.examples]; a[i] = { ...ex, kind: e.target.value }; patch({ examples: a }); }}>
                          {['Simple', 'User input', 'Real world', 'Interview style'].map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <input className={inputCls} placeholder="Language" value={ex.language}
                          onChange={e => { const a = [...draft.examples]; a[i] = { ...ex, language: e.target.value }; patch({ examples: a }); }} />
                      </div>
                      <textarea rows={2} className={inputCls} placeholder="Explanation" value={ex.explanation}
                        onChange={e => { const a = [...draft.examples]; a[i] = { ...ex, explanation: e.target.value }; patch({ examples: a }); }} />
                      <textarea rows={4} className={inputCls + ' font-mono text-[12px]'} placeholder="Code" value={ex.code}
                        onChange={e => { const a = [...draft.examples]; a[i] = { ...ex, code: e.target.value }; patch({ examples: a }); }} />
                      <textarea rows={2} className={inputCls + ' font-mono text-[12px]'} placeholder="Output (optional)" value={ex.output || ''}
                        onChange={e => { const a = [...draft.examples]; a[i] = { ...ex, output: e.target.value }; patch({ examples: a }); }} />
                    </div>
                  ))}
                </Card>

                {/* Quiz */}
                <Card className="p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">Quiz ({(draft.quiz || []).length})</h3>
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => patch({
                        quiz: [...(draft.quiz || []), {
                          id: `${draft.slug}-q${(draft.quiz || []).length + 1}`,
                          question: '', options: ['', '', '', ''], correctIndex: 0,
                          explanation: '', difficulty: 'beginner', topicTag: 'general',
                        }],
                      })}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add question
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Grading is server-side. At least 3 questions with valid answers are required before a topic can be published.
                  </p>
                  {(draft.quiz || []).map((q, i) => (
                    <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Question {i + 1}</p>
                        <button className="text-[11px] text-rose-600"
                          onClick={() => patch({ quiz: draft.quiz.filter((_, j) => j !== i) })}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <input className={inputCls} placeholder="Question" value={q.question}
                        onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, question: e.target.value }; patch({ quiz: a }); }} />
                      <textarea rows={4} className={inputCls} placeholder="One option per line" value={q.options.join('\n')}
                        onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, options: toLines(e.target.value) }; patch({ quiz: a }); }} />
                      <div className="grid grid-cols-4 gap-2">
                        <div><label className={labelCls}>Correct #</label>
                          <input type="number" min={0} className={inputCls} value={q.correctIndex}
                            onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, correctIndex: Number(e.target.value) }; patch({ quiz: a }); }} /></div>
                        <div><label className={labelCls}>Difficulty</label>
                          <select className={inputCls} value={q.difficulty}
                            onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, difficulty: e.target.value as any }; patch({ quiz: a }); }}>
                            {['beginner', 'intermediate', 'advanced'].map(d => <option key={d} value={d}>{d}</option>)}
                          </select></div>
                        <div><label className={labelCls}>Topic tag</label>
                          <input className={inputCls} value={q.topicTag}
                            onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, topicTag: e.target.value }; patch({ quiz: a }); }} /></div>
                        <div><label className={labelCls}>Id</label>
                          <input className={inputCls} value={q.id}
                            onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, id: e.target.value }; patch({ quiz: a }); }} /></div>
                      </div>
                      <input className={inputCls} placeholder="Explanation shown after grading" value={q.explanation}
                        onChange={e => { const a = [...draft.quiz]; a[i] = { ...q, explanation: e.target.value }; patch({ quiz: a }); }} />
                    </div>
                  ))}
                </Card>

                {/* Practice + resources + mistakes + tips */}
                <Card className="p-5 rounded-2xl space-y-4">
                  <h3 className="text-base font-bold">Practice, resources & interview material</h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Practice ({(draft.practice || []).length})</p>
                      <Button size="sm" variant="ghost" className="text-xs"
                        onClick={() => patch({ practice: [...(draft.practice || []), { level: 'EASY', prompt: '', hint: '' }] })}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {(draft.practice || []).map((p, i) => (
                      <div key={i} className="grid sm:grid-cols-[110px_minmax(0,1fr)_26px] gap-2 items-start">
                        <select className={inputCls} value={p.level}
                          onChange={e => { const a = [...draft.practice]; a[i] = { ...p, level: e.target.value as any }; patch({ practice: a }); }}>
                          {['EASY', 'MEDIUM', 'CHALLENGE'].map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <div className="space-y-1.5">
                          <textarea rows={2} className={inputCls} placeholder="Prompt" value={p.prompt}
                            onChange={e => { const a = [...draft.practice]; a[i] = { ...p, prompt: e.target.value }; patch({ practice: a }); }} />
                          <input className={inputCls} placeholder="Hint (optional)" value={p.hint || ''}
                            onChange={e => { const a = [...draft.practice]; a[i] = { ...p, hint: e.target.value }; patch({ practice: a }); }} />
                        </div>
                        <button className="text-rose-600 mt-1.5" onClick={() => patch({ practice: draft.practice.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resources ({(draft.resources || []).length})</p>
                      <Button size="sm" variant="ghost" className="text-xs"
                        onClick={() => patch({ resources: [...(draft.resources || []), { title: '', url: 'https://', provider: '', type: 'DOCUMENTATION' }] })}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {(draft.resources || []).map((r, i) => (
                      <div key={i} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_120px_140px_26px] gap-2 items-center">
                        <input className={inputCls} placeholder="Title" value={r.title}
                          onChange={e => { const a = [...draft.resources]; a[i] = { ...r, title: e.target.value }; patch({ resources: a }); }} />
                        <input className={inputCls} placeholder="https://…" value={r.url}
                          onChange={e => { const a = [...draft.resources]; a[i] = { ...r, url: e.target.value }; patch({ resources: a }); }} />
                        <input className={inputCls} placeholder="Provider" value={r.provider}
                          onChange={e => { const a = [...draft.resources]; a[i] = { ...r, provider: e.target.value }; patch({ resources: a }); }} />
                        <select className={inputCls} value={r.type}
                          onChange={e => { const a = [...draft.resources]; a[i] = { ...r, type: e.target.value as any }; patch({ resources: a }); }}>
                          {['DOCUMENTATION', 'ARTICLE', 'VIDEO', 'PRACTICE', 'BOOK'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button className="text-rose-600" onClick={() => patch({ resources: draft.resources.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Common mistakes ({(draft.commonMistakes || []).length})</p>
                      <Button size="sm" variant="ghost" className="text-xs"
                        onClick={() => patch({ commonMistakes: [...(draft.commonMistakes || []), { title: '', wrong: '', why: '', fix: '' }] })}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {(draft.commonMistakes || []).map((m, i) => (
                      <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input className={inputCls} placeholder="Mistake title" value={m.title}
                            onChange={e => { const a = [...draft.commonMistakes]; a[i] = { ...m, title: e.target.value }; patch({ commonMistakes: a }); }} />
                          <button className="text-rose-600" onClick={() => patch({ commonMistakes: draft.commonMistakes.filter((_, j) => j !== i) })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea rows={3} className={inputCls + ' font-mono text-[12px]'} placeholder="Wrong code / behaviour" value={m.wrong}
                          onChange={e => { const a = [...draft.commonMistakes]; a[i] = { ...m, wrong: e.target.value }; patch({ commonMistakes: a }); }} />
                        <textarea rows={3} className={inputCls + ' font-mono text-[12px]'} placeholder="Fix (optional)" value={m.fix || ''}
                          onChange={e => { const a = [...draft.commonMistakes]; a[i] = { ...m, fix: e.target.value }; patch({ commonMistakes: a }); }} />
                        <textarea rows={2} className={inputCls} placeholder="Why it is wrong" value={m.why}
                          onChange={e => { const a = [...draft.commonMistakes]; a[i] = { ...m, why: e.target.value }; patch({ commonMistakes: a }); }} />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Interview tips ({(draft.interviewTips || []).length})</p>
                      <Button size="sm" variant="ghost" className="text-xs"
                        onClick={() => patch({ interviewTips: [...(draft.interviewTips || []), { question: '', answer: '', difficulty: 'beginner' }] })}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {(draft.interviewTips || []).map((t, i) => (
                      <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input className={inputCls} placeholder="Interview question" value={t.question}
                            onChange={e => { const a = [...draft.interviewTips]; a[i] = { ...t, question: e.target.value }; patch({ interviewTips: a }); }} />
                          <select className={inputCls + ' max-w-[130px]'} value={t.difficulty || 'beginner'}
                            onChange={e => { const a = [...draft.interviewTips]; a[i] = { ...t, difficulty: e.target.value as any }; patch({ interviewTips: a }); }}>
                            {['beginner', 'intermediate', 'advanced'].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <button className="text-rose-600" onClick={() => patch({ interviewTips: draft.interviewTips.filter((_, j) => j !== i) })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea rows={2} className={inputCls} placeholder="Answer" value={t.answer}
                          onChange={e => { const a = [...draft.interviewTips]; a[i] = { ...t, answer: e.target.value }; patch({ interviewTips: a }); }} />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Videos */}
                <Card className="p-5 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold inline-flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" /> Stored videos ({videos.length})
                    </h3>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs" disabled={refreshing} onClick={() => refreshVideos(draft.slug)}>
                        {refreshing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} Refresh this topic
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={async () => {
                        try {
                          const res = await learningTopicsService.adminValidateVideos();
                          toast.success(res.reason || `Checked ${res.checked}, deactivated ${res.deactivated}`);
                          open(draft._id);
                        } catch (e: any) { toast.error(e?.message || 'Validation failed'); }
                      }}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Validate
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Videos are discovered through the YouTube Data API and ranked deterministically, then stored here. View and like counts are real API metadata — never invented.
                  </p>
                  {videos.length === 0 ? (
                    <p className="text-[12.5px] text-muted-foreground">
                      No video stored yet. {videoConfigured ? 'Run a refresh to fetch and rank candidates.' : 'Refresh is disabled because YOUTUBE_API_KEY is missing.'}
                    </p>
                  ) : (
                    videos.map(v => (
                      <div key={v._id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-foreground truncate">{v.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {v.channelTitle} · {v.duration || 'duration unknown'} ·
                            {' '}{v.viewCount != null ? `${v.viewCount.toLocaleString()} views` : 'views unavailable (not fabricated)'} ·
                            {' '}score {v.rankingScore?.toFixed(3)}
                          </p>
                          <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">{(v.rankingReasons || []).join(' · ')}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${
                          v.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-secondary text-muted-foreground border-border'
                        }`}>
                          {v.active ? 'active' : 'inactive'}
                        </span>
                      </div>
                    ))
                  )}
                </Card>

                {draft.status !== 'published' && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-[12.5px] text-blue-800 inline-flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    This topic is <strong>{draft.status}</strong> — learners cannot see it until it is published. Publishing requires at least 3 content sections, 1 example, 2 objectives and 3 quiz questions.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: TopicBlock; onChange: (next: TopicBlock) => void }) {
  const set = (fields: Partial<TopicBlock>) => onChange({ ...block, ...fields });

  if (block.type === 'code') {
    return (
      <div className="space-y-2">
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={inputCls} placeholder="Language" value={block.language || ''} onChange={e => set({ language: e.target.value })} />
          <input className={inputCls + ' sm:col-span-2'} placeholder="Caption (optional)" value={block.caption || ''} onChange={e => set({ caption: e.target.value })} />
        </div>
        <textarea rows={5} className={inputCls + ' font-mono text-[12px]'} placeholder="Code" value={block.code || ''} onChange={e => set({ code: e.target.value })} />
        <textarea rows={2} className={inputCls + ' font-mono text-[12px]'} placeholder="Output (optional)" value={block.output || ''} onChange={e => set({ output: e.target.value })} />
      </div>
    );
  }

  if (block.type === 'list' || block.type === 'steps') {
    return <textarea rows={4} className={inputCls} placeholder="One item per line" value={(block.items || []).join('\n')}
      onChange={e => set({ items: toLines(e.target.value) })} />;
  }

  if (block.type === 'table') {
    return (
      <div className="space-y-2">
        <textarea rows={2} className={inputCls} placeholder="Column headers (one per line)" value={(block.columns || []).join('\n')}
          onChange={e => set({ columns: toLines(e.target.value) })} />
        <textarea rows={4} className={inputCls + ' font-mono text-[12px]'} placeholder="Rows — one row per line, cells separated by |"
          value={(block.rows || []).map(r => r.join(' | ')).join('\n')}
          onChange={e => set({ rows: e.target.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(c => c.trim())) })} />
      </div>
    );
  }

  if (block.type === 'compare') {
    return (
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <input className={inputCls} placeholder="Left title" value={block.leftTitle || ''} onChange={e => set({ leftTitle: e.target.value })} />
          <textarea rows={3} className={inputCls} placeholder="Left items (one per line)" value={(block.leftItems || []).join('\n')}
            onChange={e => set({ leftItems: toLines(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <input className={inputCls} placeholder="Right title" value={block.rightTitle || ''} onChange={e => set({ rightTitle: e.target.value })} />
          <textarea rows={3} className={inputCls} placeholder="Right items (one per line)" value={(block.rightItems || []).join('\n')}
            onChange={e => set({ rightItems: toLines(e.target.value) })} />
        </div>
      </div>
    );
  }

  return <textarea rows={3} className={inputCls} placeholder={`${block.type} text`} value={block.content || ''} onChange={e => set({ content: e.target.value })} />;
}
