import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Briefcase,
  Layers,
  Cpu,
  Building2,
  Globe,
  FileText,
  Upload,
  Mic,
  Sliders,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  Code2,
  Users,
  Layout,
  BarChart2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useInterviewStore } from '../stores/interviewStore';
import { resumeService } from '../services/resume';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const POPULAR_ROLES = [
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'Data Scientist',
  'ML Engineer',
  'DevOps Engineer',
  'Product Manager',
];

const EXPERIENCE_LEVELS = [
  { id: 'Fresher / Junior', label: 'Fresher / Junior', desc: '0 - 2 years (Core concepts & coding)' },
  { id: 'Mid-Level', label: 'Mid-Level', desc: '2 - 5 years (System tradeoffs & ownership)' },
  { id: 'Senior', label: 'Senior', desc: '5 - 8 years (Architecture & scale)' },
  { id: 'Staff / Principal', label: 'Staff / Principal', desc: '8+ years (Strategy & leadership)' },
];

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical', sub: 'Algorithms, engineering fundamentals & stack deep dive', icon: Cpu, accent: '#3b82f6' },
  { id: 'system-design', label: 'System Design', sub: 'Scalability, microservices, databases & trade-offs', icon: Layout, accent: '#8b5cf6' },
  { id: 'behavioral', label: 'Behavioral & Leadership', sub: 'STAR method, leadership, communication & team fit', icon: Users, accent: '#ec4899' },
  { id: 'hr', label: 'HR / Culture', sub: 'Career trajectory, motivation, values & workplace fit', icon: Briefcase, accent: '#10b981' },
  { id: 'mixed', label: 'Mixed Round', sub: 'Comprehensive blend of technical, design, and behavioral', icon: Layers, accent: '#f59e0b' },
];

const DIFFICULTIES = [
  { id: 'adaptive', label: 'Adaptive (AI-Powered)', desc: 'Next question dynamically adjusts based on your answer depth', badge: 'Recommended', color: '#8b5cf6' },
  { id: 'easy', label: 'Easy', desc: 'Fundamental definitions, foundational algorithms & principles', color: '#10b981' },
  { id: 'medium', label: 'Medium', desc: 'Standard industry interview scenarios & architecture queries', color: '#f59e0b' },
  { id: 'hard', label: 'Hard', desc: 'Deep distributed edge-cases, optimization & corner-cases', color: '#ef4444' },
];

export function InterviewSetupPage() {
  const navigate = useNavigate();
  const { createInterview, isLoading } = useInterviewStore();

  const [role, setRole] = useState('Software Engineer');
  const [customRole, setCustomRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Fresher / Junior');
  const [interviewType, setInterviewType] = useState('technical');
  const [difficultyMode, setDifficultyMode] = useState('adaptive');
  const [company, setCompany] = useState('');
  const [language, setLanguage] = useState('English');
  const [plannedQuestions, setPlannedQuestions] = useState(6);
  const [voiceModePreferred, setVoiceModePreferred] = useState(true);

  // Resume state
  const [existingResumes, setExistingResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadedResumeName, setUploadedResumeName] = useState<string>('');
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [jobDescription, setJobDescription] = useState('');

  useEffect(() => {
    fetchUserResumes();
  }, []);

  const fetchUserResumes = async () => {
    try {
      setLoadingResumes(true);
      const res = await resumeService.getResumes(1, 5);
      // PaginatedResponse<T> has no `success` flag — getPaginated throws on error,
      // which the surrounding try/catch already handles.
      if (res.data && res.data.length > 0) {
        setExistingResumes(res.data);
        const latestId = (res.data[0] as any)?._id || res.data[0]?.id;
        if (latestId) setSelectedResumeId(latestId);
      }
    } catch {
      // Non-blocking if resume service is empty
    } finally {
      setLoadingResumes(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingResume(true);
      const formData = new FormData();
      formData.append('resume', file);
      const res = await apiService.upload<any>('/resume/upload', formData);
      if (res.success && res.data) {
        const id = (res.data as any)?._id || (res.data as any)?.id;
        setSelectedResumeId(id);
        setUploadedResumeName(file.name);
        toast.success(`Resume "${file.name}" uploaded & parsed!`);
      } else {
        toast.error(res.message || 'Upload failed');
      }
    } catch (err: any) {
      toast.error('Resume upload failed. Please try again.');
    } finally {
      setUploadingResume(false);
    }
  };

  const activeRole = customRole.trim() || role;

  const handleStart = async () => {
    if (!activeRole) {
      return toast.error('Please specify your target role.');
    }

    const id = await createInterview({
      role: activeRole,
      experienceLevel,
      interviewType,
      difficultyMode,
      company: company.trim() || undefined,
      language,
      plannedQuestions,
      resumeId: selectedResumeId || undefined,
      jobDescription: jobDescription.trim() || undefined,
      settings: {
        duration: plannedQuestions * 4,
        includeVideo: true,
        includeAudio: voiceModePreferred,
      },
    });

    if (id) {
      toast.success('Interview session prepared! Launching room...');
      navigate(`/interview-room?id=${id}`);
    }
  };

  const selectedResumeObj = existingResumes.find(
    r => ((r as any)._id || r.id) === selectedResumeId
  );

  return (
    <div className="min-h-screen py-16 px-4 bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AETHER Adaptive Explainable Transformer Assessment</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
            Configure Your AI Mock Interview
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            Experience high-fidelity, interactive interview practice. The AI interviewer asks questions, probes gaps, and adapts difficulty based on your specific responses.
          </p>
        </div>

        {/* Main Configuration Card */}
        <Card className="p-6 sm:p-8 bg-slate-900/90 border-slate-800 backdrop-blur shadow-2xl rounded-2xl space-y-8">

          {/* Section 1: Target Role */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              1. Target Job Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {POPULAR_ROLES.map(r => {
                const isSelected = role === r && !customRole;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r);
                      setCustomRole('');
                    }}
                    className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left border ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-500/20'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <div className="pt-1">
              <input
                type="text"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                placeholder="Or type a custom role (e.g., Cloud Security Architect, iOS Engineer)..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Section 2: Experience & Company */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                2. Experience Level
              </label>
              <div className="space-y-2">
                {EXPERIENCE_LEVELS.map(lvl => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setExperienceLevel(lvl.id)}
                    className={`w-full p-3 rounded-xl text-left border transition-all flex items-start justify-between ${
                      experienceLevel === lvl.id
                        ? 'bg-indigo-600/15 border-indigo-500 text-white'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{lvl.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{lvl.desc}</div>
                    </div>
                    {experienceLevel === lvl.id && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Target Company (Optional)
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Google, Amazon, Stripe, Fintech Startup..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  Interview Language
                </label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                >
                  <option value="English">English (US / Global)</option>
                  <option value="English-IN">English (India / Neutral)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  Interview Length
                </label>
                <div className="flex items-center gap-3">
                  {[4, 6, 8, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPlannedQuestions(cnt)}
                      className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                        plannedQuestions === cnt
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cnt} Qs (~{cnt * 3}m)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Interview Type */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              3. Interview Round Type
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              {INTERVIEW_TYPES.map(t => {
                const Icon = t.icon;
                const isSelected = interviewType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInterviewType(t.id)}
                    className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="w-5 h-5" style={{ color: t.accent }} />
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <div className="text-sm font-bold text-slate-200 mb-1">{t.label}</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{t.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Difficulty */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              4. Intelligence & Difficulty Mode
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              {DIFFICULTIES.map(d => {
                const isSelected = difficultyMode === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficultyMode(d.id)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-200">{d.label}</span>
                      {d.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {d.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{d.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Resume Selection / Analyzer Integration */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                5. Candidate Context & Resume (Optional but Recommended)
              </span>
              {selectedResumeId && (
                <span className="text-xs text-emerald-400 font-normal flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resume Linked
                </span>
              )}
            </label>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              {loadingResumes ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  Checking for existing resumes from Resume Analyzer...
                </div>
              ) : existingResumes.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">
                    We found your parsed resume from the Resume Analyzer module. The AI interviewer can craft personalized questions referencing your actual projects and skills:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {existingResumes.map(r => {
                      const id = (r as any)._id || r.id;
                      const isChosen = selectedResumeId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedResumeId(isChosen ? '' : id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all ${
                            isChosen
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{r.filename || 'Resume.pdf'}</span>
                          {isChosen && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                  {selectedResumeObj?.analysis?.skills && (
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-1 pt-1">
                      <span className="font-semibold text-slate-400">Detected Skills:</span>
                      {selectedResumeObj.analysis.skills.slice(0, 8).map((s: string) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  No previous resume found. You can upload one now or continue without one:
                </div>
              )}

              {/* Upload alternative */}
              <div className="flex items-center gap-3 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingResume ? 'Uploading...' : 'Upload New Resume (PDF)'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={uploadingResume}
                    onChange={e => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    }}
                  />
                </label>
                {uploadedResumeName && (
                  <span className="text-xs text-emerald-400">{uploadedResumeName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 6: Interaction Preferences */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-200">Voice Interview Mode</div>
                <div className="text-xs text-slate-400">
                  Speak answers into microphone with live speech-to-text (includes full text-typing fallback)
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={voiceModePreferred}
                onChange={e => setVoiceModePreferred(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Launch Button */}
          <div className="pt-4">
            <Button
              onClick={handleStart}
              disabled={isLoading}
              className="w-full py-4 rounded-xl text-base font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Synthesizing Interview Context...</span>
                </>
              ) : (
                <>
                  <span>Begin Adaptive Interview</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-slate-500 mt-3">
              Your camera and microphone will be requested upon entering the room. Tab switches and window blurs are monitored for integrity.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
