import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ShieldCheck, Loader2, ChevronRight, Sparkles, Mic, Camera, ArrowLeft, FileText, Video } from 'lucide-react';
import { useAdaptiveInterviewStore } from '../../store/adaptiveInterviewStore';
import { SystemCheck } from '../components/interview/SystemCheck';
import { resumeService } from '../services/resume';
import toast from 'react-hot-toast';

const DOMAINS = [
  { id: 'Data Structures & Algorithms', desc: 'DSA', icon: '🧩' },
  { id: 'Web Development', desc: 'Frontend + Backend', icon: '🌐' },
  { id: 'DBMS', desc: 'SQL & Databases', icon: '🗄️' },
  { id: 'Operating Systems', desc: 'OS Concepts', icon: '⚙️' },
  { id: 'Computer Networks', desc: 'Networking', icon: '🔗' },
  { id: 'Java', desc: 'Java & JVM', icon: '☕' },
  { id: 'Python', desc: 'Python Core', icon: '🐍' },
  { id: 'JavaScript', desc: 'JS & TS', icon: '✨' },
  { id: 'React', desc: 'React Framework', icon: '⚛️' },
  { id: 'Node.js', desc: 'Node & APIs', icon: '🟢' },
  { id: 'Machine Learning', desc: 'ML & AI', icon: '🤖' },
  { id: 'System Design', desc: 'Architecture', icon: '🏗️' },
  { id: 'OOP', desc: 'Object Oriented', icon: '📦' },
  { id: 'Software Testing', desc: 'QA & Testing', icon: '🧪' },
  { id: 'Cloud & DevOps', desc: 'AWS · Docker · CI/CD', icon: '☁️' },
];

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', desc: 'Fundamentals' },
  { id: 'medium', label: 'Medium', desc: 'Interview level' },
  { id: 'hard', label: 'Hard', desc: 'Expert level' },
] as const;

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'hr', label: 'HR' },
  { id: 'project', label: 'Project Deep-Dive' },
  { id: 'mixed', label: 'Mixed (Full Loop)' },
] as const;

const EXPERIENCE_LEVELS = ['Fresher / Junior', 'Mid-Level', 'Senior'] as const;

/** AETHER AI Mock Interview setup — light theme + pre-interview system check. */
export function AdaptiveSetupPage() {
  const navigate = useNavigate();
  const createSession = useAdaptiveInterviewStore(s => s.createSession);
  const creating = useAdaptiveInterviewStore(s => s.creating);

  const [domain, setDomain] = useState('');
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(6);
  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  const [interviewType, setInterviewType] = useState<string>('technical');
  const [experienceLevel, setExperienceLevel] = useState<string>('Fresher / Junior');
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeLabel, setResumeLabel] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [consentRecording, setConsentRecording] = useState(false);
  const [resumes, setResumes] = useState<Array<{ _id: string; filename: string }>>([]);

  useEffect(() => {
    resumeService.getResumes(1, 20)
      .then((res: any) => {
        const items = res?.resumes || res?.data?.resumes || res?.items || [];
        setResumes(items.map((r: any) => ({ _id: r._id ?? r.id, filename: r.filename || 'Resume' })));
      })
      .catch(() => setResumes([]));
  }, []);

  const handleStart = async () => {
    if (!domain) return toast.error('Select your domain first');
    if (systemOk === false) return toast.error('System check failed — camera and microphone are required');
    const sessionId = await createSession({
      domain, role, difficulty, questionCount,
      interviewType, experienceLevel,
      resumeId: resumeId || null,
      jobDescription: jobDescription.trim() || undefined,
      consentRecording,
    });
    if (sessionId) navigate(`/ai-interview/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-14 px-4 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/interview-setup')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to interview types
        </button>

        <div className="text-center mb-9">
          <div className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/15 rounded-full px-3.5 py-1 text-xs font-semibold text-primary mb-4">
            <Brain className="w-3.5 h-3.5" /> AI Mock Interview
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Adaptive AI Interview</h1>
          <p className="text-muted-foreground text-[15px] max-w-2xl mx-auto leading-relaxed">
            Practice realistic adaptive interviews with voice, camera and explainable feedback.
            The AI speaks every question and adapts the next one to your answers.
          </p>
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {[
              { icon: Sparkles, text: 'Adaptive follow-ups' },
              { icon: Camera, text: 'Camera + integrity monitoring' },
              { icon: Mic, text: 'Speak or type answers' },
              { icon: ShieldCheck, text: 'Explainable feedback' },
            ].map(f => (
              <span key={f.text} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <f.icon className="w-3.5 h-3.5" /> {f.text}
              </span>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* Left column: configuration */}
          <div className="space-y-6">
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">1 · Choose domain</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DOMAINS.map(d => {
                  const active = domain === d.id;
                  return (
                    <button key={d.id} onClick={() => setDomain(d.id)} aria-pressed={active}
                      className={`text-left p-3.5 rounded-xl border transition-colors ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-blue-300'}`}>
                      <span className="text-lg" aria-hidden>{d.icon}</span>
                      <p className={`text-sm font-semibold mt-1 ${active ? 'text-primary' : 'text-slate-800'}`}>{d.id}</p>
                      <p className="text-[11px] text-slate-400">{d.desc}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">2 · Target role <span className="normal-case font-normal text-slate-400">(optional)</span></p>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Backend Developer, Data Analyst…"
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400/50" />
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">3 · Difficulty</p>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map(d => {
                  const active = difficulty === d.id;
                  return (
                    <button key={d.id} onClick={() => setDifficulty(d.id)} aria-pressed={active}
                      className={`p-3 rounded-xl border text-center transition-colors ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-blue-300'}`}>
                      <p className={`text-sm font-bold ${active ? 'text-primary' : 'text-slate-800'}`}>{d.label}</p>
                      <p className="text-[11px] text-slate-400">{d.desc}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">4 · Questions</p>
              <div className="flex items-center gap-3">
                <input type="range" min={3} max={12} value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                  className="flex-1 accent-blue-600" aria-label="Number of questions" />
                <span className="text-sm font-bold tabular-nums text-slate-700 w-8 text-center">{questionCount}</span>
              </div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">5 · Interview type & experience</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {INTERVIEW_TYPES.map(t => (
                  <button key={t.id} onClick={() => setInterviewType(t.id)} aria-pressed={interviewType === t.id}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${interviewType === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_LEVELS.map(x => (
                  <button key={x} onClick={() => setExperienceLevel(x)} aria-pressed={experienceLevel === x}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${experienceLevel === x ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                    {x}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">6 · Resume & job description <span className="normal-case font-normal">(optional — makes questions personal)</span></p>
              {resumes.length > 0 ? (
                <select
                  value={resumeId ?? ''}
                  onChange={e => { setResumeId(e.target.value || null); setResumeLabel(resumes.find(r => r._id === e.target.value)?.filename || ''); }}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm mb-2"
                  aria-label="Use resume"
                >
                  <option value="">No resume — general questions</option>
                  {resumes.map(r => <option key={r._id} value={r._id}>Use Resume: {r.filename}</option>)}
                </select>
              ) : (
                <p className="text-xs text-slate-400 mb-2">Upload a resume in the Resume Analyzer to unlock resume-aware questions.</p>
              )}
              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the job description (optional) — the interviewer will balance questions between your resume, the JD and role fundamentals."
                className="w-full h-20 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
                aria-label="Job description"
              />
            </section>
          </div>

          {/* Right column: system check + start */}
          <div className="space-y-4 lg:sticky lg:top-20">
            <SystemCheck onDone={setSystemOk} />

            {/* Recording consent (spec §37) — explicit, stored with timestamp */}
            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5 cursor-pointer">
              <input type="checkbox" checked={consentRecording} onChange={e => setConsentRecording(e.target.checked)}
                className="mt-0.5 accent-blue-600" aria-label="Consent to recording" />
              <span className="text-xs leading-relaxed text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-800"><Video className="w-3.5 h-3.5" /> Recording consent.</span>{' '}
                This interview records audio/video for playback and feedback. Recordings are private — only you can view them,
                and you can request deletion. If you decline, the interview runs normally without recording.
              </span>
            </label>
            <button onClick={handleStart} disabled={creating || !domain}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</> : <>Start Interview <ChevronRight className="w-4 h-4" /></>}
            </button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              By starting you accept integrity monitoring: tab switches, leaving fullscreen and camera events are
              recorded. 5 warnings automatically submit the interview. Scores from completed answers are always kept.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdaptiveSetupPage;
