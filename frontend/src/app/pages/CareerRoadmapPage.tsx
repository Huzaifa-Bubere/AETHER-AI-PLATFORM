import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, Lock, PlayCircle, SkipForward, Loader2,
  BookOpen, ExternalLink, Sparkles, Brain, ClipboardCheck, Target, Calendar,
  ChevronRight, RotateCcw, Award,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import careerService, {
  type RoadmapView, type TopicDetail, type CareerRoleDetail, type NodeState, type WeeklyPlan,
} from '../services/career';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const STATE_STYLES: Record<NodeState, { chip: string; icon: typeof Lock; label: string }> = {
  COMPLETED: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Completed' },
  IN_PROGRESS: { chip: 'bg-blue-50 text-blue-700 border-blue-200', icon: PlayCircle, label: 'In progress' },
  READY: { chip: 'bg-primary/10 text-primary border-primary/20', icon: Circle, label: 'Ready' },
  LOCKED: { chip: 'bg-secondary text-muted-foreground border-border', icon: Lock, label: 'Locked' },
  SKIPPED: { chip: 'bg-amber-50 text-amber-700 border-amber-200', icon: SkipForward, label: 'Skipped' },
};

export default function CareerRoadmapPage() {
  const { roleSlug } = useParams<{ roleSlug: string }>();
  const [roadmap, setRoadmap] = useState<RoadmapView | null>(null);
  const [role, setRole] = useState<CareerRoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);

  const [explanation, setExplanation] = useState<{ explanation: string; analogy: string; example: string; interviewConcepts: string[]; commonMistakes: string[]; nextSteps: string[] } | null>(null);
  const [explaining, setExplaining] = useState(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Array<{ question: string; options: string[] }>>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; results: Array<{ correct: boolean; correctIndex: number; explanation?: string }> } | null>(null);

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const load = () => {
    if (!roleSlug) return;
    setLoading(true);
    Promise.all([careerService.getRoadmap(roleSlug), careerService.getRole(roleSlug).catch(() => null)])
      .then(([rm, r]) => { setRoadmap(rm); setRole(r?.role ?? null); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [roleSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTopic = (nodeId: string) => {
    if (!roleSlug) return;
    setSelectedNode(nodeId);
    setTopicLoading(true);
    setTopic(null); setExplanation(null); setQuizOpen(false); setQuizResult(null);
    careerService.getTopic(roleSlug, nodeId)
      .then(setTopic)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setTopicLoading(false));
  };

  const markState = async (state: NodeState) => {
    if (!roleSlug || !selectedNode) return;
    try {
      await careerService.updateNodeState(roleSlug, selectedNode, state);
      toast.success(state === 'COMPLETED' ? 'Topic completed 🎉' : 'Updated');
      setSelectedNode(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  const explain = async () => {
    if (!topic || !role) return;
    setExplaining(true);
    careerService.explainSkill(topic.node.title, role.name)
      .then(res => setExplanation(res))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setExplaining(false));
  };

  const startQuiz = async () => {
    if (!roleSlug || !selectedNode) return;
    try {
      const data = await careerService.getQuiz(roleSlug, selectedNode);
      setQuizQuestions(data.questions);
      setQuizAnswers(new Array(data.questions.length).fill(-1));
      setQuizResult(null);
      setQuizOpen(true);
    } catch { toast.error('No quiz available for this topic'); }
  };

  const submitQuiz = async () => {
    if (!roleSlug || !selectedNode) return;
    if (quizAnswers.some(a => a < 0)) { toast.error('Answer all questions first'); return; }
    const res = await careerService.submitQuiz(roleSlug, selectedNode, quizAnswers);
    setQuizResult(res);
  };

  const generatePlan = async () => {
    if (!roleSlug) return;
    setPlanLoading(true);
    careerService.getPlan(roleSlug)
      .then(p => { setPlan(p); setShowPlan(true); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setPlanLoading(false));
  };

  const setAsGoal = async () => {
    if (!roleSlug) return;
    try {
      await careerService.setGoal({ roleSlug });
      toast.success('Set as your target role');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground pt-16"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading roadmap…</div>;
  }
  if (error || !roadmap) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 pt-16 text-center px-4">
        <p className="text-destructive text-sm">{error || 'Roadmap not found'}</p>
        <Link to="/career-learning" className="text-primary underline text-sm">Back to Career Learning</Link>
      </div>
    );
  }

  const pct = roadmap.progressSummary;
  const stagesWithNodes = roadmap.stages.map(stage => ({
    ...stage,
    nodes: stage.nodeIds.map(id => roadmap.nodes.find(n => n.id === id)).filter(Boolean) as RoadmapView['nodes'],
  }));

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Link to="/career-learning" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Career Learning
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight">{roadmap.roleName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pct.completed} / {pct.total} topics completed · {roadmap.nodes.filter(n => n.state === 'LOCKED').length} locked by prerequisites
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={setAsGoal} className="text-xs">
              <Target className="w-3.5 h-3.5 mr-1.5" /> Set as my goal
            </Button>
            <Button size="sm" onClick={generatePlan} disabled={planLoading} className="text-xs font-bold">
              {planLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5 mr-1.5" />}
              My weekly plan
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Roadmap progress</span>
            <span className="text-lg font-extrabold text-primary">{pct.percentage}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct.percentage}%` }} />
          </div>
          {roadmap.currentStageId && (
            <p className="text-xs text-muted-foreground mt-2">
              Current stage: <strong className="text-foreground">{roadmap.stages.find(s => s.id === roadmap.currentStageId)?.title}</strong>
            </p>
          )}
        </Card>

        {/* Roadmap stages */}
        <div className="space-y-6">
          {stagesWithNodes.map((stage, si) => (
            <div key={stage.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{si + 1}</span>
                <h2 className="font-bold text-foreground">{stage.title}</h2>
                {roadmap.currentStageId === stage.id && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">CURRENT</span>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stage.nodes.map(node => {
                  const style = STATE_STYLES[node.state];
                  const Icon = style.icon;
                  return (
                    <button key={node.id} onClick={() => openTopic(node.id)} className="text-left group">
                      <Card className={`p-4 rounded-xl border transition-all h-full ${node.state === 'LOCKED' ? 'opacity-70' : 'group-hover:border-primary/40 group-hover:shadow-sm'} ${node.state === 'COMPLETED' ? 'border-emerald-200' : 'border-border'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.chip}`}>
                            <Icon className="w-3 h-3" /> {style.label}
                          </span>
                          {node.estimatedHours && <span className="text-[10px] text-muted-foreground">{node.estimatedHours}h</span>}
                        </div>
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{node.title}</h3>
                        {node.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{node.description}</p>}
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          {node.quizCount > 0 && <span className="inline-flex items-center gap-0.5"><ClipboardCheck className="w-3 h-3" /> quiz</span>}
                          {node.hasProject && <span className="inline-flex items-center gap-0.5"><Award className="w-3 h-3" /> project</span>}
                          {node.resourceCount > 0 && <span className="inline-flex items-center gap-0.5"><BookOpen className="w-3 h-3" /> {node.resourceCount}</span>}
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic drawer */}
      {(selectedNode || topicLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedNode(null)} />
          <div className="relative w-full max-w-xl h-full bg-background border-l border-border overflow-y-auto p-6 space-y-5 animate-in slide-in-from-right">
            <button onClick={() => setSelectedNode(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-sm">✕</button>

            {topicLoading || !topic ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading topic…</div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-extrabold text-foreground pr-8">{topic.node.title}</h2>
                  {topic.node.whyItMatters && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{topic.node.whyItMatters}</p>}
                </div>

                {topic.prerequisites.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Prerequisites</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topic.prerequisites.map(p => (
                        <button key={p.id} onClick={() => openTopic(p.id)} className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border hover:border-primary/40 text-foreground inline-flex items-center gap-1">
                          {p.title} <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {topic.node.whatYouWillLearn.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">What you will learn</p>
                    <ul className="space-y-1.5">
                      {topic.node.whatYouWillLearn.map((item, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {topic.node.keyConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topic.node.keyConcepts.map((c, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-accent border border-border text-accent-foreground">{c}</span>
                    ))}
                  </div>
                )}

                {/* AI explanation */}
                <Card className="p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> AETHER AI</p>
                    {!explanation && (
                      <Button size="sm" variant="outline" onClick={explain} disabled={explaining} className="text-xs">
                        {explaining ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1" />} Explain with AETHER AI
                      </Button>
                    )}
                  </div>
                  {explanation && (
                    <div className="space-y-2 text-sm">
                      <p className="text-foreground leading-relaxed">{explanation.explanation}</p>
                      {explanation.analogy && <p className="text-muted-foreground text-xs"><strong className="text-foreground">Analogy:</strong> {explanation.analogy}</p>}
                      {explanation.example && <p className="text-muted-foreground text-xs"><strong className="text-foreground">Example:</strong> {explanation.example}</p>}
                      {explanation.interviewConcepts.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Key interview concepts</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{explanation.interviewConcepts.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                      )}
                      {explanation.commonMistakes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Common mistakes</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{explanation.commonMistakes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                      )}
                      {explanation.nextSteps.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Next steps</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{explanation.nextSteps.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Resources */}
                {topic.resources.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Learning resources</p>
                    <div className="space-y-1.5">
                      {topic.resources.map(r => (
                        <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:border-primary/40 bg-card text-sm group">
                          <div>
                            <span className="font-medium text-foreground group-hover:text-primary">{r.title}</span>
                            <span className="text-[10px] text-muted-foreground ml-2 uppercase">{r.type}</span>
                            <p className="text-[10px] text-muted-foreground">{r.provider}{r.estimatedTime ? ` · ${r.estimatedTime}` : ''}</p>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quiz */}
                {topic.node.hasQuiz && (
                  <Card className="p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5 text-primary" /> Topic quiz</p>
                      {!quizOpen && <Button size="sm" onClick={startQuiz} className="text-xs">Start quiz</Button>}
                    </div>
                    {quizOpen && !quizResult && (
                      <div className="space-y-4">
                        {quizQuestions.map((q, qi) => (
                          <div key={qi}>
                            <p className="text-sm font-medium text-foreground mb-1.5">{qi + 1}. {q.question}</p>
                            <div className="grid gap-1.5">
                              {q.options.map((opt, oi) => (
                                <button key={oi} onClick={() => setQuizAnswers(a => a.map((v, i) => i === qi ? oi : v))}
                                  className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${quizAnswers[qi] === oi ? 'bg-primary/10 border-primary text-primary font-semibold' : 'bg-card border-border hover:border-primary/30 text-foreground'}`}>
                                  {String.fromCharCode(65 + oi)}. {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <Button size="sm" onClick={submitQuiz} className="w-full text-xs font-bold">Submit quiz</Button>
                      </div>
                    )}
                    {quizResult && (
                      <div className="space-y-2">
                        <p className={`text-lg font-extrabold ${quizResult.score >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>Score: {quizResult.score}%</p>
                        {quizResult.results.map((r, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {r.correct ? '✅' : '❌'} Q{i + 1}: correct answer is {String.fromCharCode(65 + r.correctIndex)}
                            {r.explanation ? ` — ${r.explanation}` : ''}
                          </p>
                        ))}
                        <Button size="sm" variant="outline" onClick={startQuiz} className="text-xs"><RotateCcw className="w-3 h-3 mr-1" /> Retry</Button>
                      </div>
                    )}
                  </Card>
                )}

                {/* Project */}
                {topic.node.project && (
                  <Card className="p-4 rounded-xl space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Practice project</p>
                    <p className="text-sm font-bold text-foreground">{topic.node.project.title}</p>
                    <p className="text-xs text-muted-foreground">{topic.node.project.description}</p>
                  </Card>
                )}

                {/* Interview questions */}
                {topic.node.interviewQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Interview questions</p>
                    <ul className="space-y-1">
                      {topic.node.interviewQuestions.map((q, i) => (
                        <li key={i} className="text-xs text-foreground bg-secondary/60 rounded-lg px-3 py-2">“{q}”</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {topic.state !== 'COMPLETED' && (
                    <Button size="sm" onClick={() => markState('COMPLETED')} className="text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark completed
                    </Button>
                  )}
                  {topic.state === 'READY' && (
                    <Button size="sm" variant="outline" onClick={() => markState('IN_PROGRESS')} className="text-xs">
                      <PlayCircle className="w-3.5 h-3.5 mr-1" /> Start learning
                    </Button>
                  )}
                  {topic.state !== 'SKIPPED' && topic.state !== 'COMPLETED' && (
                    <Button size="sm" variant="ghost" onClick={() => markState('SKIPPED')} className="text-xs text-muted-foreground">
                      <SkipForward className="w-3.5 h-3.5 mr-1" /> Skip
                    </Button>
                  )}
                  {topic.state === 'COMPLETED' && (
                    <Button size="sm" variant="outline" onClick={() => markState('IN_PROGRESS')} className="text-xs">
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Weekly plan modal */}
      {showPlan && plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Weekly learning plan</h3>
              <button onClick={() => setShowPlan(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-xs text-muted-foreground">
              {plan.hoursPerWeek} hours/week · {plan.weeks} weeks · follows prerequisite order, skipping skills you already have evidence for.
            </p>
            <div className="space-y-2">
              {plan.plan.map(w => (
                <div key={w.week} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div>
                    <p className="text-xs font-bold text-primary">Week {w.week}</p>
                    <p className="text-sm text-foreground">{w.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{w.estimatedHours}h</span>
                </div>
              ))}
              {!plan.plan.length && <p className="text-sm text-emerald-600">All topics completed — try a new role! 🎉</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
