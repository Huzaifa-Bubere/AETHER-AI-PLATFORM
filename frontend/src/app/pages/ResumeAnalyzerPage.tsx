import { useState, useEffect, useRef } from 'react';

/** Stable empty array — keeps the gap hook's dependency identity constant. */
const NO_SKILLS: string[] = [];
import { FileText, CheckCircle, XCircle, Lightbulb, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useResumeSkillGap } from '../features/resume/useResumeSkillGap';
import { Card } from '../components/ui/card';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export function ResumeAnalyzerPage() {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobMatchScore, setJobMatchScore] = useState<number | null>(null);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's resume on component mount
  useEffect(() => {
    fetchResume();
  }, []);

  const fetchResume = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get('/resume/latest');
      
      if (response.success) {
        setResumeData(response.data);
      } else {
        setError(response.error || 'Failed to load resume');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load resume');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a PDF or DOCX file');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);


      // Use the upload method from apiService
      const response = await apiService.upload<any>('/resume/upload', formData, 120000);


      if (response.success) {
        if (response.data?.analysisStatus === 'completed') toast.success('Resume saved and content reviewed.');
        else toast(response.data?.errorMessage || 'Resume saved. Analysis is unavailable.');
        setSelectedFile(null);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        if (headerFileInputRef.current) {
          headerFileInputRef.current.value = '';
        }
        // Refresh resume data
        await fetchResume();
      } else {
        const errorMessage = response.message || response.error || 'Failed to upload resume';
        toast.error(errorMessage);
        
      }
    } catch (error: any) {
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to upload resume';
      
      toast.error(errorMessage);
      
    } finally {
      setUploading(false);
    }
  };

  // Shared helper — fetches file through backend (Cloudinary never exposed)
  const fetchResumeBlob = async (endpoint: 'view' | 'download'): Promise<{ blob: Blob; filename: string } | null> => {
    if (!resumeData?._id) {
      toast.error('No resume available');
      return null;
    }
    const blob = await apiService.getBlob(`/resume/${resumeData._id}/${endpoint}`);
    const filename = resumeData.fileName || 'resume.pdf';
    return { blob, filename };
  };

  const handleDownload = async () => {
    const toastId = 'download';
    toast.loading('Preparing download…', { id: toastId });
    try {
      const result = await fetchResumeBlob('download');
      if (!result) { toast.dismiss(toastId); return; }
      const blobUrl = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success('Download started!', { id: toastId });
    } catch (err: any) {
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
      // Revoke after the tab has had time to load the blob
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err: any) {
      toast.error('Failed to open resume', { id: toastId });
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const analyzeJobMatch = () => {
  if (!jobDescription) {
    toast.error('Please paste a job description');
    return;
  }

  const resumeSkills = (resumeData.extractedSkills || []).map((s: string) =>
    s.toLowerCase()
  );

  const jdWords = jobDescription.toLowerCase().split(/\W+/);

  const matched = resumeSkills.filter((skill: string) =>
    jdWords.includes(skill)
  );

  const missing = resumeSkills.filter(
    (skill: string) => !jdWords.includes(skill)
  );

  if (!resumeSkills.length) { toast.error('No skills have been extracted for comparison.'); return; }
  const score = Math.round((matched.length / resumeSkills.length) * 100);

  setMatchedKeywords(matched);
  setMissingKeywords(missing);
  setJobMatchScore(score);
};

  // Gap is computed against the candidate's selected target roles — the backend's
  // own `missingSkills` is hardcoded empty and could never populate this panel.
  // This hook MUST stay above the early returns below: it calls useState/useEffect/
  // useMemo, so running it only on the data branch made React throw
  // "Rendered more hooks than during the previous render" when loading finished.
  // The skills array needs a STABLE identity, otherwise the effect re-runs on
  // every render and the profile is refetched in a loop.
  const gapSkills = resumeData?.extractedSkills?.length ? resumeData.extractedSkills : NO_SKILLS;
  const gapEnabled = !loading && !!resumeData && resumeData.processingStatus !== 'failed';
  const gap = useResumeSkillGap(gapSkills, gapEnabled);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading resume...</p>
        </div>
      </div>
    );
  }

  // No resume uploaded state
  if (!resumeData) {
    return (
      <div className="min-h-screen py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl gradient-text mb-2">Resume Analyzer</h1>
            <p className="text-muted-foreground">AI-powered insights to improve your resume</p>
          </div>

          <Card className="p-12 text-center p-6">
            <FileText className="w-24 h-24 text-muted-foreground mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-4">No Resume Uploaded Yet</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your resume to get AI-powered insights, skill analysis, and personalized recommendations
            </p>

            <div className="max-w-md mx-auto">
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                  selectedFile ? 'border-green-500 bg-green-50' : 'border-border bg-white hover:border-primary'
                }`}>
                  {selectedFile ? (
                    <div>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-green-600 font-semibold mb-1">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground">PDF or DOC (max. 5MB)</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </label>

              {selectedFile && (
                <Button 
                  variant="default" 
                  size="lg"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full mt-4"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Uploading & Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Upload & Analyze Resume
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Resume data exists - show analysis
  const extractedSkills = gapSkills;
  const suggestions = resumeData.suggestions || [];

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl gradient-text mb-2">Resume Analyzer</h1>
            <p className="text-muted-foreground">AI-powered insights to improve your resume</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <label className="cursor-pointer">
              <Button variant="outline" disabled={uploading} type="button">
                <Upload className="mr-2 w-4 h-4" />
                {selectedFile ? (selectedFile.name.length > 20 ? selectedFile.name.substring(0, 20) + '...' : selectedFile.name) : 'Upload New'}
              </Button>
              <input
                ref={headerFileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {selectedFile && (
              <Button 
                variant="default" 
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 w-4 h-4" />
                    Analyze Resume
                  </>
                )}
              </Button>
            )}
            {resumeData && (resumeData.fileUrl || resumeData.localFilePath) && (
              <Button variant="outline" onClick={handleViewResume}>
                <FileText className="mr-2 w-4 h-4" />
                View Resume
              </Button>
            )}
            {resumeData && (resumeData.fileUrl || resumeData.localFilePath) && (
              <Button variant="default" onClick={handleDownload}>
                <Download className="mr-2 w-4 h-4" />
                Download
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Resume Preview */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-primary/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl">{resumeData.fileName}</h2>
                  <p className="text-sm text-muted-foreground">
                    Uploaded on {formatDate(resumeData.uploadDate)}
                  </p>
                </div>
              </div>

              {/* Resume Preview - Show actual uploaded resume data */}
              <div className="bg-secondary rounded-xl p-8 space-y-4 max-h-96 overflow-y-auto ">
                <div>
                  <h3 className="text-2xl mb-1">Your Resume</h3>
                  <p className="text-muted-foreground">{resumeData.fileName}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Uploaded on {formatDate(resumeData.uploadDate)}
                  </p>
                </div>

                {/* Extracted skills render once, in the analysis grid below —
                    duplicating them here made the same list appear twice. */}

                <div>
                  <h4 className="text-lg mb-2">Resume Analysis</h4>
                  <p className="text-muted-foreground text-sm">
                    {resumeData.analysisStatus === 'completed'
                      ? 'AI content feedback covers clarity, keywords and impact based on extracted text.'
                      : resumeData.errorMessage || 'Content feedback is unavailable. Your original file is saved.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={handleViewResume}
                    className="text-primary hover:underline text-sm flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    View Original Resume
                  </button>
                </div>
              </div>
            </Card>

            {/* AI Suggestions */}
            <Card className='p-6'>
              <div className="flex items-center gap-3 mb-6">
                <Lightbulb className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl">AI Improvement Suggestions</h3>
              </div>

              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="p-4 bg-secondary rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{suggestion.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            suggestion.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {suggestion.priority}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
            {/* Overall Score */}
            <Card className="border-primary/20 p-6">
  <h3 className="text-xl mb-6 text-center">AI Content Review</h3>

  <div className="flex flex-col items-center">

    <div className="relative w-32 h-32 mb-4">
      <svg className="w-32 h-32 transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="54"
          stroke="#e5e7eb"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="64"
          cy="64"
          r="54"
          stroke="#6366f1"
          strokeWidth="10"
          fill="none"
          strokeDasharray="339"
          strokeDashoffset={339 - (339 * (resumeData.score || 0)) / 100}
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
        {resumeData.score ?? 'Unavailable'}
      </div>
    </div>

    {/* Score breakdown — these three are already returned by the backend; the
        page previously only ever showed the single overall figure. */}
    {resumeData.analysisStatus === 'completed' && (
      <div className="space-y-2.5">
        {([
          ['Content quality', resumeData.contentQuality, 'bg-indigo-500'],
          ['Keywords', resumeData.keywords, 'bg-blue-500'],
          ['Impact', resumeData.impact, 'bg-emerald-500'],
        ] as const).map(([label, value, bar]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono tabular-nums">{value ?? '—'}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
            </div>
          </div>
        ))}
      </div>
    )}

    <p className="text-muted-foreground text-sm">
      Qualitative feedback on extracted content; visual formatting is not assessed.
    </p>
  </div>
</Card>

            {/* Extracted Skills */}
            <Card className='p-6'>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="text-lg">Extracted Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {extractedSkills.map((skill, index) => (
                  <span key={index} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="p-6">
  <h3 className="text-lg mb-1">Resume Section Analysis</h3>
  <p className="mb-4 text-xs text-muted-foreground">
    Which sections the parser found. A missing section is not necessarily an error —
    some formats omit them.
  </p>

  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {([
      ['Summary', !!resumeData.summary], ['Experience', !!resumeData.experience?.length],
      ['Skills', extractedSkills.length > 0], ['Projects', !!resumeData.projects?.length],
      ['Education', !!resumeData.education?.length],
      ['Certifications', !!resumeData.certifications?.length],
    ] as const).map(([label, present]) => (
      <div key={String(label)} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2.5">
        <span className="text-sm">{label}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          present ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
        }`}>
          {present ? 'Found' : 'Not found'}
        </span>
      </div>
    ))}
  </div>
</Card>

            {/* Missing Skills */}
            <Card className='p-6'>
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-red-400" />
                <h3 className="text-lg">Missing Skills</h3>
              </div>
              {gap.loading ? (
              <p className="text-sm text-muted-foreground">Comparing against your target roles…</p>
            ) : !gap.available ? null : !gap.hasRoles ? (
              <p className="text-sm text-muted-foreground">
                Choose a target role in Career Intelligence and this panel will list the
                requirements your resume does not yet evidence.
              </p>
            ) : gap.total === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4" /> Your resume evidences every requirement for
                your target role.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Requirements not evidenced by this resume or by your stored activity, for your
                  selected role{gap.roles.length > 1 ? 's' : ''}.
                </p>
                {gap.roles.filter(r => r.missing.length > 0).map(role => (
                  <div key={role.roleSlug} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-sm font-semibold">{role.roleName}</p>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {role.matched}/{role.total} covered
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {role.missing.map(m => (
                        <span
                          key={m.name}
                          title={`${m.priority} requirement`}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            m.priority === 'ESSENTIAL'
                              ? 'bg-red-500/15 text-red-600'
                              : 'bg-amber-500/15 text-amber-600'
                          }`}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
