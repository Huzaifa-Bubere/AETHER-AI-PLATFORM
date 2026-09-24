import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen, ChevronRight, Clock, FileQuestion, GraduationCap, Loader2,
  CheckCircle2, Sparkles, Hammer, ArrowLeft,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { courseService, type CourseDetail } from '../services/courseService';
import toast from 'react-hot-toast';

/**
 * AETHER Career Learning — Course detail (spec §44–53).
 * Structured learning: modules → lessons → quizzes → projects, with server-side
 * progress and a lesson-grounded AI tutor ("Ask AETHER").
 */

interface LessonWithState {
  id: string; title: string; estimatedMinutes: number; order: number; state: string;
  content?: string;
  codeExamples?: Array<{ language: string; code: string; caption?: string }>;
  resources?: Array<{ title: string; url: string; provider: string; type: string }>;
  exercises?: Array<{ prompt: string; hint?: string; expectedKeywords: string[] }>;
}

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<{ moduleId: string; lesson: LessonWithState } | null>(null);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorAnswer, setTutorAnswer] = useState<{ answer: string; groundedIn: string; aiAvailable: boolean } | null>(null);
  const [askingTutor, setAskingTutor] = useState(false);

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const d = await courseService.getCourse(slug);
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [slug]);

  const flatLessons = useMemo(() => {
    if (!data) return [];
    return data.modules.flatMap(m => m.lessons.map(l => ({ ...l, moduleId: m.id })));
  }, [data]);

  const toggleLesson = async (lessonId: string, currentState: string) => {
    if (!slug) return;
    const next = currentState === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
    try {
      const res = await courseService.setLessonProgress(slug, lessonId, next);
      setData(prev => prev ? {
        ...prev,
        progress: {
          ...prev.progress,
          percentage: res.progressPercentage,
          completedLessons: next === 'COMPLETED' ? prev.progress.completedLessons + 1 : Math.max(0, prev.progress.completedLessons - 1),
        },
        modules: prev.modules.map(m => ({
          ...m,
          lessons: m.lessons.map(l => l.id === lessonId ? { ...l, state: next } : l),
          completedLessons: m.lessons.filter(l => (l.id === lessonId ? next : l.state) === 'COMPLETED').length,
        })),
      } : prev);
    } catch (e: any) {
      toast.error(e?.message || 'Progress update failed');
    }
  };

  const openLesson = async (moduleId: string, lesson: LessonWithState) => {
    if (!slug) return;
    try {
      const d = await courseService.getLesson(slug, moduleId, lesson.id);
      setActiveLesson({ moduleId, lesson: { ...d.lesson, state: d.state } });
      if (d.state === 'NOT_STARTED') void courseService.setLessonProgress(slug, lesson.id, 'IN_PROGRESS');
      setTutorAnswer(null); setTutorQuestion('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to open lesson');
    }
  };

  const takeQuiz = async (moduleId: string) => {
    if (!slug) return;
    try {
      const quiz = await courseService.getQuiz(slug, moduleId);
      const answers: number[] = [];
      for (const q of quiz.questions) {
        const pick = window.prompt(`${q.question}\n\n${q.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nEnter option number:`);
        answers.push(pick ? Number(pick) - 1 : -1);
      }
      const result = await courseService.submitQuiz(slug, moduleId, answers);
      toast.success(`Quiz score: ${result.score}%`);
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Quiz failed');
    }
  };

  const completeProject = async (moduleId: string) => {
    if (!slug) return;
    try {
      await courseService.completeProject(slug, moduleId);
      toast.success('Project marked complete — skill evidence updated.');
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update project');
    }
  };

  const askTutor = async () => {
    if (!slug || !tutorQuestion.trim()) return;
    setAskingTutor(true);
    try {
      const a = await courseService.ask(
        slug,
        tutorQuestion.trim(),
        activeLesson?.lesson.id
      );
      setTutorAnswer(a);
    } catch (e: any) {
      toast.error(e?.message || 'AI tutor unavailable');
    } finally {
      setAskingTutor(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen pt-16 flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-slate-600">{error || 'Course not found'}</p>
        <Button variant="outline" onClick={() => navigate('/career-learning')}>Back to Career Learning</Button>
      </div>
    );
  }

  const { course, modules, progress } = data;

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to={`/career-learning/${course.roleSlugs[0] || ''}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to roadmap
        </Link>

        {/* Course header */}
        <Card className="p-6 rounded-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
                <GraduationCap className="w-3.5 h-3.5" /> Course · {course.difficulty}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{course.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">{course.description}</p>
            </div>
            {/* Progress ring (real, persisted server-side) */}
            <div className="text-center">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2563EB" strokeWidth="3"
                    strokeDasharray={`${progress.percentage} ${100 - progress.percentage}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-slate-800">{progress.percentage}%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{progress.completedLessons} / {progress.totalLessons} lessons</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ~{Math.ceil(progress.estimatedRemainingMinutes / 60)}h remaining</span>
            {progress.quizAverage != null && <span className="inline-flex items-center gap-1"><FileQuestion className="w-3.5 h-3.5" /> Quiz average {progress.quizAverage}%</span>}
            <span className="inline-flex items-center gap-1"><Hammer className="w-3.5 h-3.5" /> Projects {progress.projectsCompleted}</span>
          </div>
        </Card>

        {/* Modules */}
        <div className="space-y-4">
          {modules.map(m => (
            <Card key={m.id} className="p-5 rounded-2xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-bold text-slate-800">{m.order}. {m.title}</h2>
                  <p className="text-xs text-slate-500">{m.description} · ~{m.estimatedMinutes} min</p>
                </div>
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{m.completedLessons}/{m.lessonCount} done</span>
              </div>

              <div className="space-y-1.5">
                {m.lessons.map(l => (
                  <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <button
                      onClick={() => toggleLesson(l.id, l.state)}
                      aria-label={l.state === 'COMPLETED' ? 'Mark incomplete' : 'Mark complete'}
                      className={`rounded-full p-0.5 ${l.state === 'COMPLETED' ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </button>
                    <button onClick={() => openLesson(m.id, l)} className="flex-1 text-left text-sm text-slate-700 hover:text-blue-700">
                      {l.title}
                    </button>
                    <span className="text-[11px] text-slate-400">{l.estimatedMinutes} min</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {m.hasQuiz && (
                  <Button variant="outline" size="sm" onClick={() => takeQuiz(m.id)}>
                    <FileQuestion className="w-3.5 h-3.5 mr-1" /> Quiz{m.quizScore != null ? ` — best ${m.quizScore}%` : ''}
                  </Button>
                )}
                {m.hasProject && (
                  <Button variant="outline" size="sm" onClick={() => completeProject(m.id)}>
                    <Hammer className="w-3.5 h-3.5 mr-1" /> Mark project complete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Lesson viewer */}
        {activeLesson && (
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">{activeLesson.lesson.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveLesson(null)}>Close</Button>
            </div>
            <div className="prose prose-slate prose-sm max-w-none text-sm text-slate-700 whitespace-pre-wrap">{activeLesson.lesson.content}</div>
            {activeLesson.lesson.codeExamples?.length > 0 && (
              <div className="mt-4 space-y-3">
                {activeLesson.lesson.codeExamples.map((c: any, i: number) => (
                  <div key={i}>
                    {c.caption && <p className="text-xs font-semibold text-slate-500 mb-1">{c.caption}</p>}
                    <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto">{c.code}</pre>
                  </div>
                ))}
              </div>
            )}
            {activeLesson.lesson.resources?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Official documentation & open resources</p>
                <ul className="space-y-1">
                  {activeLesson.lesson.resources.map((r: any, i: number) => (
                    <li key={i}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {r.title} <span className="text-slate-400">— {r.provider}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activeLesson.lesson.exercises?.length > 0 && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1.5">Practice</p>
                {activeLesson.lesson.exercises.map((ex: any, i: number) => (
                  <p key={i} className="text-sm text-slate-700">{ex.prompt}</p>
                ))}
              </div>
            )}

            {/* Ask AETHER — lesson-grounded tutor (spec §48) */}
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Ask AETHER — grounded in this lesson
              </p>
              <div className="flex gap-2">
                <input
                  value={tutorQuestion}
                  onChange={e => setTutorQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void askTutor(); }}
                  placeholder="e.g. Explain this simply… show a real-world use… compare X and Y"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  aria-label="Ask the AI tutor"
                />
                <Button size="sm" onClick={askTutor} disabled={askingTutor || !tutorQuestion.trim()}>
                  {askingTutor ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
                </Button>
              </div>
              {tutorAnswer && (
                <div className="mt-3 rounded-lg bg-white border border-border p-3.5">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{tutorAnswer.answer}</p>
                  <p className="text-[11px] text-slate-400 mt-2">Grounded in: {tutorAnswer.groundedIn}{!tutorAnswer.aiAvailable && ' · AI offline — lesson material shown'}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
