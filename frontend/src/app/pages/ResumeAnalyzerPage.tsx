import { useState, useEffect, useRef } from 'react';
import { FileText, CheckCircle, XCircle, Lightbulb, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
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
      console.error('Resume fetch error:', error);
      setError(error.message || 'Failed to load resume');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a PDF or DOC file');
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

    console.log('=== Starting Resume Upload ===');
    console.log('File:', {
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size,
      lastModified: selectedFile.lastModified
    });

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);

      console.log('FormData created, sending request...');
      console.log('Token:', localStorage.getItem('accessToken') ? 'Present' : 'Missing');

      // Use the upload method from apiService
      const response = await apiService.upload('/resume/upload', formData);

      console.log('Upload response:', response);

      if (response.success) {
        console.log('Upload successful!', response.data);
        toast.success('Resume uploaded and analyzed successfully!');
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
        console.error('Upload failed:', response.error, response.message);
        const errorMessage = response.message || response.error || 'Failed to upload resume';
        toast.error(errorMessage);
        
        // Show debug info if available
        if (response.debug) {
          console.error('Debug info:', response.debug);
        }
      }
    } catch (error: any) {
      console.error('Resume upload error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to upload resume';
      
      toast.error(errorMessage);
      
      // Show additional debug info
      if (error.response?.data?.debug) {
        console.error('Server debug info:', error.response.data.debug);
      }
    } finally {
      setUploading(false);
      console.log('=== Upload Process Complete ===');
    }
  };

  const getApiBase = () => {
    const raw = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';
    // Strip trailing /api so we can append /api/resume/:id/...
    return raw.replace(/\/api\/?$/, '');
  };

  // Shared helper — fetches file through backend (Cloudinary never exposed)
  const fetchResumeBlob = async (endpoint: 'view' | 'download'): Promise<{ blob: Blob; filename: string } | null> => {
    if (!resumeData?._id) {
      toast.error('No resume available');
      return null;
    }
    const token = localStorage.getItem('accessToken');
    const url = `${getApiBase()}/api/resume/${resumeData._id}/${endpoint}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const blob = await res.blob();
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
      const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        toast.error('Popup blocked — please allow popups for this site', { id: toastId });
        URL.revokeObjectURL(blobUrl);
        return;
      }
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

  const score = Math.round((matched.length / resumeSkills.length) * 100);

  setMatchedKeywords(matched);
  setMissingKeywords(missing);
  setJobMatchScore(score);
};

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
                    accept=".pdf,.doc,.docx"
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
  const extractedSkills = resumeData.extractedSkills || [];
  const missingSkills = resumeData.missingSkills || [];
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
                accept=".pdf,.doc,.docx"
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

                <div>
                  <h4 className="text-lg mb-2">Extracted Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {extractedSkills.length > 0 ? (
                      extractedSkills.map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No skills extracted yet</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg mb-2">Resume Analysis</h4>
                  <p className="text-muted-foreground text-sm">
                    Your resume has been analyzed and scored based on content quality, formatting, 
                    keyword optimization, and overall impact. Check the suggestions below for improvements.
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
  <h3 className="text-xl mb-6 text-center">ATS Resume Score</h3>

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
        {resumeData.score || 0}
      </div>
    </div>

    <p className="text-muted-foreground text-sm">
      Higher score means better ATS compatibility
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
  <h3 className="text-lg mb-4">Resume Section Analysis</h3>

  <div className="space-y-3">

    <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
      <span>Summary</span>
      <CheckCircle className="text-green-500 w-5 h-5" />
    </div>

    <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
      <span>Experience</span>
      <Lightbulb className="text-yellow-500 w-5 h-5" />
    </div>

    <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
      <span>Skills</span>
      <CheckCircle className="text-green-500 w-5 h-5" />
    </div>

    <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
      <span>Projects</span>
      <XCircle className="text-red-500 w-5 h-5" />
    </div>

    <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
      <span>Education</span>
      <CheckCircle className="text-green-500 w-5 h-5" />
    </div>

  </div>
</Card>

            {/* Missing Skills */}
            <Card className='p-6'>
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-red-400" />
                <h3 className="text-lg">Missing Skills</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                These skills are commonly required for Full Stack Developer roles
              </p>
              <div className="flex flex-wrap gap-2">
                {missingSkills.map((skill, index) => (
                  <span key={index} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
