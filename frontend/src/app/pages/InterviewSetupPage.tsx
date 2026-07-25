import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, Upload, X, FileText, Cpu, Code2, Users, Layout, CheckCircle2, Clock, Zap, BarChart2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useInterviewStore } from '../stores/interviewStore';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const interviewTypes = [
  {
    id: 'technical',
    label: 'Technical',
    sub: 'Resume-based deep dive',
    icon: Cpu,
    accent: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.3)',
    requiresResume: true,
  },
  {
    id: 'skill-based',
    label: 'Skill / Language',
    sub: 'Domain-specific questions',
    icon: BarChart2,
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    requiresDomain: true,
  },
  {
    id: 'coding',
    label: 'Coding',
    sub: 'Algorithmic challenges',
    icon: Code2,
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
  },
  {
    id: 'behavioral',
    label: 'Behavioral',
    sub: 'Soft skills & culture fit',
    icon: Users,
    accent: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'system-design',
    label: 'System Design',
    sub: 'Architecture & scalability',
    icon: Layout,
    accent: '#a855f7',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.3)',
  },
];

const technicalDomains = [
  'Java', 'Python', 'JavaScript', 'React', 'Node.js',
  'DBMS', 'Operating Systems', 'Computer Networks',
  'System Design', 'Data Structures',
];

const difficulties = [
  { id: 'easy',   label: 'Easy',   desc: 'Fundamentals',    color: '#10b981' },
  { id: 'medium', label: 'Medium', desc: 'Industry ready',  color: '#f59e0b' },
  { id: 'hard',   label: 'Hard',   desc: 'Senior level',    color: '#ef4444' },
] as const;

const durationMarks = [15, 30, 45, 60, 90, 120];

/* ─── Component ─────────────────────────────────────────────────────────────── */

export function InterviewSetupPage() {
  const navigate = useNavigate();
  const { createInterview, isLoading } = useInterviewStore();

  const [selectedType, setSelectedType]       = useState('');
  const [selectedRole, setSelectedRole]       = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [duration, setDuration]               = useState(30);
  const [selectedDomain, setSelectedDomain]   = useState('');
  const [resumeFile, setResumeFile]           = useState<File | null>(null);
  const [roleFocused, setRoleFocused]         = useState(false);

  const activeType = interviewTypes.find(t => t.id === selectedType);
  const step = selectedType ? 2 : 1;

  const handleStart = async () => {
    if (!selectedType)  return toast.error('Select an interview type');
    if (!selectedRole.trim()) return toast.error('Enter your target role');
    if (selectedType === 'skill-based' && !selectedDomain)
      return toast.error('Select a skill domain');

    try {
      let resumeId: string | undefined;

      if (resumeFile) {
        const formData = new FormData();
        formData.append('resume', resumeFile);
        const uploadRes = await apiService.upload('/resume/upload', formData);
        if (!uploadRes.success) { toast.error(uploadRes.message || 'Resume upload failed'); return; }
        // Handle both _id and id field names
        resumeId = (uploadRes.data as any)?._id?.toString() || (uploadRes.data as any)?.id?.toString();
        if (!resumeId) { toast.error('Resume saved but ID missing — try again'); return; }
      }

      const payload = {
        type: selectedType as 'behavioral' | 'technical' | 'skill-based' | 'coding' | 'system-design',
        resumeId,
        settings: {
          role: selectedRole,
          difficulty: selectedDifficulty,
          duration,
          ...(selectedType === 'skill-based' && { domain: selectedDomain }),
          includeVideo: true,
          includeAudio: true,
          includeCoding: selectedType === 'coding',
        },
      };

      await createInterview(payload);
      const interview = useInterviewStore.getState().currentInterview;
      const interviewId = (interview as any)?._id || interview?.id;
      if (!interviewId) { toast.error('Interview ID missing'); return; }

      navigate(selectedType === 'coding'
        ? `/coding-interview?id=${interviewId}`
        : `/interview-room?id=${interviewId}`
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Interview creation failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fc', color: '#111827', fontFamily: "'DM Sans', system-ui, sans-serif", padding: '80px 16px 60px' }}>

      {/* ── Background texture ── */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#6b7280', marginBottom: 20, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Zap style={{ width: 12, height: 12, color: '#f59e0b' }} />
            AI-Powered Practice
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 12px', background: 'linear-gradient(135deg, #111827 0%, #4b5563 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Set Up Your Interview
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 16, margin: 0 }}>
            Choose a format, configure your session, and get started.
          </p>
        </div>

        {/* ── Step indicators ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
          {['Interview Type', 'Configuration'].map((label, i) => {
            const isActive  = step === i + 1;
            const isDone    = step > i + 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isActive || isDone ? 1 : 0.35, transition: 'opacity 0.3s' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isDone ? '#10b981' : isActive ? '#3b82f6' : 'rgba(0,0,0,0.06)', color: '#fff', transition: 'background 0.3s' }}>
                    {isDone ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: isActive ? '#111827' : '#9ca3af', fontWeight: isActive ? 600 : 400 }}>{label}</span>
                </div>
                {i < 1 && <div style={{ width: 40, height: 1, background: step > 1 ? '#3b82f6' : 'rgba(0,0,0,0.1)', transition: 'background 0.4s' }} />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Type cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 32 }}>
          {interviewTypes.map((type) => {
            const Icon = type.icon;
            const active = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type.id); setSelectedDomain(''); setResumeFile(null); }}
                style={{
                  all: 'unset', cursor: 'pointer', display: 'block',
                  background: active ? type.bg : '#ffffff',
                  border: `1px solid ${active ? type.border : 'rgba(0,0,0,0.09)'}`,
                  borderRadius: 16, padding: '20px 22px',
                  transition: 'all 0.2s ease',
                  transform: active ? 'translateY(-2px)' : 'none',
                  boxShadow: active ? `0 8px 32px ${type.accent}22` : 'none',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.2)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.09)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: active ? `${type.accent}22` : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                    <Icon style={{ width: 20, height: 20, color: active ? type.accent : '#9ca3af' }} />
                  </div>
                  {active && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: type.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#fff' }} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: active ? '#111827' : '#374151', marginBottom: 4 }}>{type.label}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>{type.sub}</div>
              </button>
            );
          })}
        </div>

        {/* ── Step 2: Config panel ── */}
        {selectedType && (
          <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '32px', animation: 'slideUp 0.3s ease' }}>
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              {activeType && <activeType.icon style={{ width: 18, height: 18, color: activeType.accent }} />}
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Configure {activeType?.label} Interview</span>
            </div>

            <div style={{ display: 'grid', gap: 24 }}>

              {/* Role input */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 8, letterSpacing: '0.03em' }}>Target Role</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="e.g. Software Engineer, Frontend Developer"
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    onFocus={() => setRoleFocused(true)}
                    onBlur={() => setRoleFocused(false)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#f9fafb',
                      border: `1px solid ${roleFocused ? (activeType?.accent || '#3b82f6') : 'rgba(0,0,0,0.12)'}`,
                      borderRadius: 10, padding: '12px 16px',
                      color: '#111827', fontSize: 14, outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Domain picker (skill-based only) */}
              {selectedType === 'skill-based' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 10, letterSpacing: '0.03em' }}>Domain / Skill</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {technicalDomains.map(domain => (
                      <button
                        key={domain}
                        onClick={() => setSelectedDomain(domain)}
                        style={{
                          all: 'unset', cursor: 'pointer',
                          padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                          background: selectedDomain === domain ? 'rgba(16,185,129,0.12)' : '#f3f4f6',
                          border: `1px solid ${selectedDomain === domain ? '#10b981' : 'rgba(0,0,0,0.1)'}`,
                          color: selectedDomain === domain ? '#059669' : '#6b7280',
                          transition: 'all 0.15s',
                        }}
                      >{domain}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume upload (technical only) */}
              {selectedType === 'technical' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 8, letterSpacing: '0.03em' }}>
                    Resume <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                  </label>
                  {resumeFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
                      <FileText style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#d1d5db', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumeFile.name}</span>
                      <button onClick={() => setResumeFile(null)} style={{ all: 'unset', cursor: 'pointer', color: '#6b7280', display: 'flex' }}>
                        <X style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 16px', background: '#f9fafb', border: '1.5px dashed rgba(0,0,0,0.15)', borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.3)'; }}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)')}
                      >
                        <Upload style={{ width: 22, height: 22, color: '#6b7280' }} />
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>Click to upload <span style={{ color: '#9ca3af' }}>PDF, DOC, DOCX</span></span>
                        <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => setResumeFile(e.target.files?.[0] || null)} />
                      </label>
                      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
                        You can continue without a resume. Questions will be generated from role and difficulty.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Difficulty */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 10, letterSpacing: '0.03em' }}>Difficulty</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {difficulties.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDifficulty(d.id)}
                      style={{
                        all: 'unset', cursor: 'pointer', textAlign: 'center',
                        padding: '12px 8px', borderRadius: 10,
                        background: selectedDifficulty === d.id ? `${d.color}15` : '#f9fafb',
                        border: `1px solid ${selectedDifficulty === d.id ? d.color : 'rgba(0,0,0,0.1)'}`,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: selectedDifficulty === d.id ? d.color : '#6b7280', marginBottom: 2 }}>{d.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              {/* <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 10, letterSpacing: '0.03em' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock style={{ width: 14, height: 14 }} />Duration</span>
                  <span style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>{duration} min</span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {durationMarks.map(mark => (
                    <button
                      key={mark}
                      onClick={() => setDuration(mark)}
                      style={{
                        all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
                        padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                        background: duration === mark ? `${activeType?.accent || '#3b82f6'}15` : '#f3f4f6',
                        border: `1px solid ${duration === mark ? (activeType?.accent || '#3b82f6') : 'rgba(0,0,0,0.1)'}`,
                        color: duration === mark ? (activeType?.accent || '#3b82f6') : '#6b7280',
                        transition: 'all 0.15s',
                      }}
                    >{mark}m</button>
                  ))}
                </div>
              </div> */}

              {/* Submit */}
              <button
                onClick={handleStart}
                disabled={isLoading}
                style={{
                  all: 'unset', cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px 28px', borderRadius: 12, marginTop: 4,
                  background: isLoading ? 'rgba(0,0,0,0.06)' : `linear-gradient(135deg, ${activeType?.accent || '#3b82f6'} 0%, ${activeType?.accent || '#3b82f6'}bb 100%)`,
                  color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
                  boxShadow: isLoading ? 'none' : `0 4px 24px ${activeType?.accent || '#3b82f6'}44`,
                  transition: 'all 0.2s', opacity: isLoading ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
              >
                {isLoading ? (
                  <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />Creating interview…</>
                ) : (
                  <>Start Interview <ChevronRight style={{ width: 18, height: 18 }} /></>
                )}
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </button>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}