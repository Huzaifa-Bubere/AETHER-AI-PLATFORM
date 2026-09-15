import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ShieldCheck, Loader2, ChevronRight, CheckCircle2, Sparkles, Mic, Camera, ArrowLeft } from 'lucide-react';
import { useAdaptiveInterviewStore } from '../../store/adaptiveInterviewStore';
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
  { id: 'easy', label: 'Easy', desc: 'Fundamentals', color: '#10b981' },
  { id: 'medium', label: 'Medium', desc: 'Interview level', color: '#f59e0b' },
  { id: 'hard', label: 'Hard', desc: 'Expert level', color: '#ef4444' },
] as const;

export function AdaptiveSetupPage() {
  const navigate = useNavigate();
  const createSession = useAdaptiveInterviewStore(s => s.createSession);
  const creating = useAdaptiveInterviewStore(s => s.creating);

  const [domain, setDomain] = useState('');
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(6);

  const handleStart = async () => {
    if (!domain) return toast.error('Select your domain first');
    const sessionId = await createSession({ domain, role, difficulty, questionCount });
    if (sessionId) navigate(`/ai-interview/${sessionId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b1020', color: '#e2e8f0', fontFamily: "'Sora', system-ui, sans-serif", padding: '90px 16px 60px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header */}
        <button onClick={() => navigate('/interview-setup')} style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back to interview types
        </button>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#a5b4fc', marginBottom: 18, fontWeight: 600 }}>
            <Brain style={{ width: 13, height: 13 }} />
            Adaptive AI Interview
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            Pick Your Domain. AI Handles the Rest.
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: 0, lineHeight: 1.6 }}>
            The AI asks questions that matter in your field — and every next question adapts to your last answer.
            Your camera stays on. Tab-switching, copy-paste and leaving fullscreen are tracked.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { icon: Sparkles, text: 'Adaptive follow-up questions' },
              { icon: Camera, text: 'Camera proctoring' },
              { icon: Mic, text: 'Speak or type your answers' },
              { icon: ShieldCheck, text: 'Integrity report' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#818cf8' }}>
                <f.icon style={{ width: 13, height: 13 }} /> {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Domain grid */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>1 · Choose Domain</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, marginBottom: 32 }}>
          {DOMAINS.map(d => {
            const active = domain === d.id;
            return (
              <button key={d.id} onClick={() => setDomain(d.id)} style={{
                all: 'unset', cursor: 'pointer', padding: '16px', borderRadius: 14,
                background: active ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.15s', textAlign: 'left',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{d.icon}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: active ? '#c7d2fe' : '#e2e8f0' }}>{d.id}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{d.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Role + difficulty + count */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>2 · Configure</p>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, display: 'grid', gap: 20, marginBottom: 32 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, color: '#94a3b8', marginBottom: 8 }}>Target role <span style={{ color: '#475569' }}>(optional)</span></label>
            <input
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Frontend Developer, SDE-1, Data Analyst"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, color: '#94a3b8', marginBottom: 8 }}>Difficulty</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {DIFFICULTIES.map(d => (
                <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
                  all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '11px 8px', borderRadius: 10,
                  background: difficulty === d.id ? `${d.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${difficulty === d.id ? d.color : 'rgba(255,255,255,0.1)'}`,
                }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: difficulty === d.id ? d.color : '#94a3b8' }}>{d.label}</div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#94a3b8', marginBottom: 8 }}>
              <span>Questions</span><span style={{ color: '#a5b4fc', fontWeight: 700 }}>{questionCount}</span>
            </label>
            <input type="range" min={4} max={12} value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1' }} />
            <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>
              The AI may ask extra follow-ups on weak answers — the count is the minimum it plans for.
            </p>
          </div>
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={creating}
          style={{
            all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '16px', borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 15, fontWeight: 700,
            boxShadow: '0 6px 24px rgba(99,102,241,0.35)',
          }}
        >
          {creating
            ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Preparing your interview…</>
            : <>Start AI Interview <ChevronRight style={{ width: 18, height: 18 }} /></>}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ShieldCheck style={{ width: 13, height: 13 }} /> You'll need camera + microphone access. Use Chrome or Edge.
        </p>
      </div>
    </div>
  );
}

export default AdaptiveSetupPage;
