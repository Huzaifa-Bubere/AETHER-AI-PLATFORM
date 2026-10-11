import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, CheckCircle, XCircle, Lightbulb, Download, Upload, Loader2,
  ShieldCheck, Target, Briefcase, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useResumeSkillGap } from '../features/resume/useResumeSkillGap';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

/**
 * AETHER Resume Analyzer.
 *
 * Pipeline stages are independent (spec §1A): a parser result (parseStatus), a
 * DETERMINISTIC quality score computed by the ATS engine
 * (deterministicAnalysisStatus) and an OPTIONAL AI wording review (aiReviewStatus).
 * A Gemini outage must never blank the page — the deterministic analysis is the
 * primary product, and AI wording feedback is an extra.
 *
 * The JD gap is computed SERVER-SIDE (spec §1F/§1G) and is always
 * "JD requirements not evidenced on the resume" — never the reverse.
 */

interface SkillEntry { slug: string; label: string; category: string }
interface AtsCategory { key: string; label: string; weight: number; score: number; weightedPoints: number; findings: string[] }
interface Deterministic {
  totalScore: number; grade: string; categories: AtsCategory[];
  bulletFindings: Array<{ bullet: string; issues: string[]; suggestion?: string }>;
  wordCount: number; readabilityScore: number;
}
interface SkillRef { slug: string; label: string; importance: 'REQUIRED' | 'PREFERRED' }
interface JobMatch {
  score: number; requiredSkills: SkillRef[]; preferredSkills: SkillRef[];
  matchedSkills: SkillRef[]; missingSkills: SkillRef[];
  components: Array<{ key: string; label: string; weight: number; earned: number; basis: string }>;
  suggestions: string[];
}

const NO_SKILLS: string[] = [];
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const GRADE_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  'needs-improvement': 'Needs improvement',
};

export function ResumeAnalyzerPage() {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryingAi, setRetryingAi] = useState(false);

  // Job match (server-side)
  const [jobDescription, setJobDescription] = useState('');
  const [jobMatch, setJobMatch] = useState<JobMatch | null>(null);
  const [matching, setMatching] = useState(false);

  // Target role selection for the ROLE GAP (separate concept from job gap).
  const [roleSlug, setRoleSlug] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  const fetchResume = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get('/resume/latest');
      if (response.success) setResumeData(response.data);
      else setError(response.error || 'Failed to load resume');
    } catch (err: any) {
      setError(err.message || 'Failed to load resume');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchResume(); }, [fetchResume]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    // Some browsers leave `type` empty for DOCX; fall back to the extension.
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !['pdf', 'docx'].includes(ext || '')) {
      toast.error('Please upload a PDF or DOCX file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Please select a file first'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);
      const response = await apiService.upload<any>('/resume/upload', formData, 120000);
      if (response.success) {
        if (response.data?.parseStatus === 'FAILED') toast.error(response.data?.errorMessage || 'Could not extract text from this file.');
        else if (response.data?.aiReviewStatus === 'COMPLETED') toast.success('Resume analyzed — AI wording review ready.');
        else toast('Resume analyzed. AI wording suggestions are temporarily unavailable.');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (headerFileInputRef.current) headerFileInputRef.current.value = '';
        setJobMatch(null);
        await fetchResume();
      } else {
        toast.error(response.message || response.error || 'Failed to upload resume');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const fetchResumeBlob = async (endpoint: 'view' | 'download'): Promise<{ blob: Blob; filename: string } | null> => {
    if (!resumeData?._id) { toast.error('No resume available'); return null; }
    const blob = await apiService.getBlob(`/resume/${resumeData._id}/${endpoint}`);
    return { blob, filename: resumeData.fileName || 'resume.pdf' };
  };

  const handleDownload = async () => {
    const toastId = 'download';
    toast.loading('Preparing download…', { id: toastId });
    try {
      const result = await fetchResumeBlob('download');
      if (!result) { toast.dismiss(toastId); return; }
      const blobUrl = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = result.filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success('Download started!', { id: toastId });
    } catch {
      toast.error('Download failed', { id: toastId });
    }
  };

  const handleViewResume = async () => {
    const toastId = 'view-resume';
    toast.loading('Opening resume…', { id: toastId });
    try {
      const result = await fetchResumeBlob('view');
      if (!result) { toast.dismiss(toastId); return; }
      const blobUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = blobUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Opened in new tab', { id: toastId });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      toast.error('Failed to open resume', { id: toastId });
    }
  };

  const analyzeJobMatch = async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      toast.error('Paste the full job description (at least a requirements section).');
      return;
    }
    if (!resumeData?._id) return;
    setMatching(true);
    try {
      const res = await apiService.post<JobMatch>(`/resume/${resumeData._id}/job-match`, {
        jobDescription, targetRoleSlug: roleSlug || undefined,
      });
      if (res.success && res.data) {
        setJobMatch(res.data);
      } else {
        toast.error(res.error || res.message || 'Could not match this job description.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Could not match this job description.');
    } finally {
      setMatching(false);
    }
  };

  const retryAiReview = async () => {
    if (!resumeData?._id) return;
    setRetryingAi(true);
    try {
      const res = await apiService.post(`/resume/${resumeData._id}/ai-review`, {});
      if (res.success) { toast.success('AI wording review ready.'); setResumeData(res.data); }
      else toast.error(res.error || 'AI wording review is still unavailable.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'AI wording review is still unavailable.');
    } finally {
      setRetryingAi(false);
    }
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const gapSkills = asArray<string>(resumeData?.extractedSkills);
  const gapEnabled = !loading && !!resumeData && resumeData.parseStatus !== 'FAILED';
  // Role-gap hook for the TARGET ROLE gap (separate from the JD gap).
  const gap = useResumeSkillGap(gapSkills.length ? gapSkills : NO_SKILLS, gapEnabled);

  if (loading) {
    return (
      <div className="min-h-screen pb-20 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading resume…</p>
        </div>
      </div>
    );
  }

  if (!resumeData) {
    return (
      <div className="min-h-screen pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl gradient-text mb-2">Resume Analyzer</h1>
            <p className="text-muted-foreground">Deterministic resume quality, ATS parsability and role/JD gaps</p>
          </div>
          <Card className="p-12 text-center">
            <FileText className="w-24 h-24 text-muted-foreground mx-auto mb-6" aria-hidden="true" />
            <h2 className="text-2xl font-semibold mb-4">No Resume Uploaded Yet</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your resume to get a documented quality score, skill analysis and role/JD gap reports.
            </p>
            <div className="max-w-md mx-auto">
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                  selectedFile ? 'border-green-500 bg-green-50' : 'border-border bg-white hover:border-primary'
                }`}>
                  {selectedFile ? (
                    <div>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" aria-hidden="true" />
                      <p className="text-green-600 font-semibold mb-1">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                      <p className="text-foreground font-medium mb-1">Click to upload a resume</p>
                      <p className="text-sm text-muted-foreground">PDF or DOCX (max. 5MB)</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx" aria-label="Upload resume file" onChange={handleFileSelect} className="hidden" />
                </div>
              </label>
              {selectedFile && (
                <Button variant="default" size="lg" onClick={handleUpload} disabled={uploading} className="w-full mt-4">
                  {uploading
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading &amp; analyzing…</>
                    : <><Upload className="w-5 h-5 mr-2" aria-hidden="true" /> Upload &amp; Analyze Resume</>}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const skills = asArray<SkillEntry>(resumeData.skills);
  const skillGroups = asArray<{ category: string; skills: SkillEntry[] }>(resumeData.skillGroups);
  const deterministic: Deterministic | null = resumeData.deterministic || null;
  const suggestions = asArray<any>(resumeData.suggestions);
  const aiReviewStatus: string = resumeData.aiReviewStatus || (resumeData.analysisStatus === 'completed' ? 'COMPLETED' : 'UNAVAILABLE');
  const aiAvailable = aiReviewStatus === 'COMPLETED';
  const aiNotRequested = aiReviewStatus === 'NOT_REQUESTED';

  const experience = asArray<any>(resumeData.experience);
  const projects = asArray<any>(resumeData.projects);
  const education = asArray<any>(resumeData.education);
  const certifications = asArray<any>(resumeData.certifications);

  const sectionRows: Array<{ label: string; found: boolean; evidence: string; optional?: boolean }> = [
    { label: 'Summary', found: !!resumeData.summary, evidence: resumeData.summary ? `${String(resumeData.summary).split(/\s+/).length} words` : 'not detected' },
    { label: 'Experience', found: experience.length > 0, evidence: experience.length ? `Detected ${experience.length} entr${experience.length === 1 ? 'y' : 'ies'}` : 'not detected' },
    { label: 'Skills', found: skills.length > 0, evidence: skills.length ? `${skills.length} skill${skills.length === 1 ? '' : 's'}` : 'not detected' },
    { label: 'Projects', found: projects.length > 0, evidence: projects.length ? `Detected ${projects.length} project${projects.length === 1 ? '' : 's'}` : 'not detected' },
    { label: 'Education', found: education.length > 0, evidence: education.length ? `Detected ${education.length} entr${education.length === 1 ? 'y' : 'ies'}` : 'not detected' },
    { label: 'Certifications', found: certifications.length > 0, evidence: certifications.length ? `Detected ${certifications.length}` : 'optional', optional: true },
  ];

  const bulletFindings = deterministic?.bulletFindings ?? [];
  const atsParsability = deterministic?.categories.find(c => c.key === 'structure');

  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl gradient-text mb-2">Resume Analyzer</h1>
            <p className="text-muted-foreground">{resumeData.fileName} · uploaded {formatDate(resumeData.uploadDate)}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <label className="cursor-pointer">
              <span className="sr-only">Upload a new resume</span>
              <Button variant="outline" disabled={uploading} type="button" aria-label="Upload a new resume">
                <Upload className="mr-2 w-4 h-4" aria-hidden="true" />
                Upload New
              </Button>
              <input ref={headerFileInputRef} type="file" accept=".pdf,.docx" aria-label="Upload a new resume" onChange={handleFileSelect} className="hidden" />
            </label>
            {selectedFile && (
              <Button variant="default" onClick={handleUpload} disabled={uploading} aria-label="Analyze uploaded resume">
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : <><Upload className="mr-2 w-4 h-4" aria-hidden="true" /> Analyze Resume</>}
              </Button>
            )}
            <Button variant="outline" onClick={handleViewResume} aria-label="View original resume">
              <FileText className="mr-2 w-4 h-4" aria-hidden="true" /> View Original
            </Button>
            <Button variant="default" onClick={handleDownload} aria-label="Download resume">
              <Download className="mr-2 w-4 h-4" aria-hidden="true" /> Download
            </Button>
          </div>
        </div>

        {/* Stage status strip — independent stages (spec §1A) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StagePill label="Parse" status={resumeData.parseStatus} />
          <StagePill label="Deterministic quality" status={resumeData.deterministicAnalysisStatus} />
          <StagePill label="AI wording review" status={aiReviewStatus} />
        </div>

        {resumeData.parseStatus === 'FAILED' && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{resumeData.errorMessage || 'Text could not be extracted from this file. Re-upload a text-based PDF or DOCX.'}</span>
          </div>
        )}

        {/* Summary row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Resume Quality"
            value={deterministic ? `${deterministic.totalScore}` : '—'}
            sub={deterministic ? `${GRADE_LABEL[deterministic.grade] ?? deterministic.grade} / 100` : 'unavailable'}
          />
          <SummaryCard
            title="ATS Parsability"
            value={atsParsability ? `${atsParsability.score}` : '—'}
            sub={atsParsability ? `${atsParsability.weight}% weight` : 'unavailable'}
          />
          <SummaryCard
            title="Sections Found"
            value={`${sectionRows.filter(s => s.found).length}/${sectionRows.length}`}
            sub="standard sections detected"
          />
          <SummaryCard title="Skills Extracted" value={`${skills.length}`} sub={`${skillGroups.length} categories`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quality breakdown */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
                <h3 className="text-xl">Resume Quality Breakdown</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Computed by AETHER&apos;s deterministic ATS engine from your structured content with fixed weights. AI never assigns these numbers.
              </p>
              {!deterministic ? (
                <p className="text-sm text-muted-foreground">Deterministic analysis is unavailable because no text could be extracted from this file.</p>
              ) : (
                <div className="space-y-3">
                  {deterministic.categories.map(cat => (
                    <div key={cat.key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{cat.label} <span className="text-muted-foreground">({cat.weight}%)</span></span>
                        <span className="font-mono tabular-nums">{cat.weightedPoints} / {cat.weight}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${cat.score >= 70 ? 'bg-emerald-500' : cat.score >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(0, Math.min(100, cat.score))}%` }} />
                      </div>
                      {cat.findings.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {cat.findings.slice(0, 3).map((f, i) => <li key={i} className="text-[11.5px] text-muted-foreground">• {f}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Section analysis with evidence */}
            <Card className="p-6">
              <h3 className="text-lg mb-1">Section Analysis</h3>
              <p className="mb-4 text-xs text-muted-foreground">What the parser found, with the evidence count. A missing section is not always an error.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {sectionRows.map(row => (
                  <div key={row.label} className="flex flex-col gap-1 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{row.label}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        row.found ? 'bg-emerald-500/15 text-emerald-600' : row.optional ? 'bg-slate-500/15 text-slate-600' : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        {row.found ? 'FOUND' : row.optional ? 'OPTIONAL' : 'NOT FOUND'}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-muted-foreground">{row.evidence}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Experience + projects + bullets + impact */}
            <div className="grid sm:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg mb-3">Experience Analysis</h3>
                {experience.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No experience entries were detected.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {experience.slice(0, 5).map((exp, i) => (
                      <li key={i} className="rounded-lg bg-secondary/50 px-3 py-2">
                        <p className="font-medium">{exp.title || exp.position || 'Role'}{exp.company ? ` · ${exp.company}` : ''}</p>
                        <p className="text-xs text-muted-foreground">{asArray<string>(exp.bullets).length} bullets{exp.duration ? ` · ${exp.duration}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-6">
                <h3 className="text-lg mb-3">Project Analysis</h3>
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No project entries were detected.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {projects.slice(0, 5).map((p, i) => (
                      <li key={i} className="rounded-lg bg-secondary/50 px-3 py-2">
                        <p className="font-medium">{p.name || p.title || 'Project'}</p>
                        <p className="text-xs text-muted-foreground">
                          {asArray<string>(p.technologies).slice(0, 4).join(', ') || 'no technologies detected'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg mb-3">Bullet Quality &amp; Measurable Impact</h3>
              {bulletFindings.length === 0 ? (
                <p className="text-sm text-emerald-600">No bullet issues detected.</p>
              ) : (
                <div className="space-y-2">
                  {bulletFindings.slice(0, 6).map((b, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm text-foreground/80">“{b.bullet.slice(0, 120)}{b.bullet.length > 120 ? '…' : ''}”</p>
                      <ul className="mt-1 space-y-0.5">
                        {b.issues.map((issue, j) => <li key={j} className="text-[11.5px] text-amber-800">• {issue}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* AI improvement suggestions with explicit states (spec §1I) */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-6 h-6 text-yellow-400" aria-hidden="true" />
                <h3 className="text-xl">AI Improvement Suggestions</h3>
              </div>

              {aiAvailable ? (
                suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">The AI review returned no specific wording suggestions.</p>
                ) : (
                  <div className="space-y-4">
                    {suggestions.map((s: any, index: number) => (
                      <div key={index} className="p-4 bg-secondary rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{s.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            s.priority === 'high' ? 'bg-red-500/20 text-red-400' : s.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>{s.priority}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{s.description}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      {aiNotRequested
                        ? 'No AI wording review was requested for this resume.'
                        : 'AI wording review temporarily unavailable. Your deterministic resume analysis is still complete.'}
                    </span>
                  </div>
                  {!aiNotRequested && (
                    <Button variant="outline" size="sm" onClick={retryAiReview} disabled={retryingAi} aria-label="Retry AI review">
                      {retryingAi ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />}
                      Retry AI Review
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Extracted skills, grouped */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
                <h3 className="text-lg">Extracted Skills</h3>
              </div>
              {skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills were recognised in this resume.</p>
              ) : (
                <div className="space-y-4">
                  {skillGroups.map(group => (
                    <div key={group.category}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{group.category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.skills.map(skill => (
                          <span key={skill.slug} className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 rounded-full text-xs">{skill.label}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* TARGET ROLE GAP */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-primary" aria-hidden="true" />
                <h3 className="text-lg">Target Role Gap</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Requirements from your selected Career role that this resume does not evidence.
              </p>
              {gap.loading ? (
                <p className="text-sm text-muted-foreground">Comparing against your target roles…</p>
              ) : !gap.available ? null : !gap.hasRoles ? (
                <p className="text-sm text-muted-foreground">Choose a target role in Career Intelligence and this panel will list the requirements your resume does not yet evidence.</p>
              ) : gap.total === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle className="w-4 h-4" aria-hidden="true" /> Your resume evidences every requirement for your target role.</p>
              ) : (
                <>
                  {gap.roles.filter(r => r.missing.length > 0).map(role => (
                    <div key={role.roleSlug} className="mb-4 last:mb-0">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-sm font-semibold">{role.roleName}</p>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{role.matched}/{role.total} covered</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {role.missing.map(m => (
                          <span key={m.name} title={`${m.priority} requirement`}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${m.priority === 'ESSENTIAL' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600'}`}>
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </Card>

            {/* JOB MATCH (server-side, JD → resume) */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-primary" aria-hidden="true" />
                <h3 className="text-lg">Job Description Match</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Paste a job description. AETHER extracts the required/preferred skills and checks which the resume evidences.
              </p>
              <textarea
                rows={5}
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the job description here…"
                aria-label="Job description"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="sm" onClick={analyzeJobMatch} disabled={matching} className="mt-2 w-full" aria-label="Analyze job match">
                {matching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />}
                Analyze Job Match
              </Button>

              {jobMatch && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">{jobMatch.score}</span>
                    <span className="text-sm text-muted-foreground">/ 100 requirement match</span>
                  </div>
                  <div className="space-y-2">
                    {jobMatch.components.map(c => (
                      <div key={c.key}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className="font-mono tabular-nums">{c.earned}/{c.weight}</span>
                        </div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(c.earned / Math.max(1, c.weight)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-emerald-600 mb-1">Matched</p>
                    <div className="flex flex-wrap gap-1">
                      {jobMatch.matchedSkills.length === 0
                        ? <span className="text-xs text-muted-foreground">None yet.</span>
                        : jobMatch.matchedSkills.map(s => <span key={s.slug} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700">{s.label}</span>)}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-amber-600 mb-1">Not evidenced</p>
                    <div className="flex flex-wrap gap-1">
                      {jobMatch.missingSkills.length === 0
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="w-3 h-3" aria-hidden="true" /> Every detected requirement is evidenced.</span>
                        : jobMatch.missingSkills.map(s => (
                          <span key={s.slug} className={`rounded-full px-2 py-0.5 text-xs ${s.importance === 'REQUIRED' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600'}`}>
                            {s.label}
                          </span>
                        ))}
                    </div>
                  </div>

                  {jobMatch.suggestions.length > 0 && (
                    <ul className="space-y-1">
                      {jobMatch.suggestions.slice(0, 4).map((s, i) => <li key={i} className="text-[11px] text-muted-foreground">• {s}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function StagePill({ label, status }: { label: string; status?: string }) {
  const tone = status === 'COMPLETED'
    ? 'bg-emerald-500/15 text-emerald-700'
    : status === 'FAILED'
      ? 'bg-red-500/15 text-red-600'
      : status === 'NOT_REQUESTED'
        ? 'bg-slate-500/15 text-slate-600'
        : 'bg-amber-500/15 text-amber-700';
  const text = status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : status === 'NOT_REQUESTED' ? 'not requested' : 'unavailable';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${tone}`}>
      {label}: {text}
    </span>
  );
}

function SummaryCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}
