import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, Database, Layers, BarChart3, Upload, CheckCircle, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [resumeUploaded, setResumeUploaded] = useState(false);

  const roles = [
    { id: 'frontend', name: 'Frontend Developer', icon: Code },
    { id: 'backend', name: 'Backend Developer', icon: Database },
    { id: 'fullstack', name: 'Full Stack Developer', icon: Layers },
    { id: 'datascience', name: 'Data Scientist', icon: BarChart3 }
  ];

  const levels = [
    { id: 'entry', name: 'Entry Level', years: '0-2 years' },
    { id: 'mid', name: 'Mid Level', years: '2-5 years' },
    { id: 'senior', name: 'Senior Level', years: '5-10 years' },
    { id: 'lead', name: 'Lead/Principal', years: '10+ years' }
  ];

  const interviewTypes = [
    { id: 'hr', name: 'HR Round', description: 'Behavioral questions and culture fit' },
    { id: 'technical', name: 'Technical Round', description: 'System design and architecture' },
    { id: 'behavioral', name: 'Behavioral Round', description: 'Past experiences and scenarios' },
    { id: 'coding', name: 'Coding Round', description: 'Live coding and algorithms' }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeUploaded(true);
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      navigate('/dashboard');
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedRole !== '';
    if (step === 2) return selectedLevel !== '';
    if (step === 3) return resumeUploaded;
    if (step === 4) return selectedType !== '';
    return false;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gray-50">
      <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
      
      <div className="w-full max-w-4xl relative z-10">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s <= step ? 'bg-primary text-white' : 'bg-white border-2 border-border text-muted-foreground'
                }`}>
                  {s < step ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                {s < 4 && (
                  <div className={`h-1 w-16 sm:w-32 mx-2 ${
                    s < step ? 'bg-primary' : 'bg-border'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground font-medium">
            <span>Role</span>
            <span>Experience</span>
            <span>Resume</span>
            <span>Interview Type</span>
          </div>
        </div>

        <Card className="p-8">
          {/* Step 1: Select Role */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Select Your Role</h2>
                <p className="text-muted-foreground">Choose the role you're interviewing for</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={`p-6 rounded-xl border-2 transition-all text-left hover-lift ${
                      selectedRole === role.id
                        ? 'border-primary bg-blue-50'
                        : 'border-border bg-white hover:border-primary/50'
                    }`}
                  >
                    <role.icon className="w-10 h-10 text-primary mb-3" />
                    <h3 className="text-xl font-semibold">{role.name}</h3>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Experience Level */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Experience Level</h2>
                <p className="text-muted-foreground">How many years of experience do you have?</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {levels.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setSelectedLevel(level.id)}
                    className={`p-6 rounded-xl border-2 transition-all text-left hover-lift ${
                      selectedLevel === level.id
                        ? 'border-primary bg-blue-50'
                        : 'border-border bg-white hover:border-primary/50'
                    }`}
                  >
                    <h3 className="text-xl font-semibold mb-1">{level.name}</h3>
                    <p className="text-muted-foreground">{level.years}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Upload Resume */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Upload Your Resume</h2>
                <p className="text-muted-foreground">We'll analyze your skills and generate personalized questions</p>
              </div>

              <div className="max-w-md mx-auto">
                <label className="block">
                  <div className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    resumeUploaded ? 'border-green-500 bg-green-50' : 'border-border bg-white hover:border-primary'
                  }`}>
                    {resumeUploaded ? (
                      <div>
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <p className="text-green-600 font-semibold mb-2">Resume uploaded successfully!</p>
                        <p className="text-sm text-muted-foreground">resume.pdf</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-foreground font-medium mb-2">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">PDF or DOC (max. 5MB)</p>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                    />
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Select Interview Type */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Interview Type</h2>
                <p className="text-muted-foreground">What type of interview would you like to practice?</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {interviewTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-6 rounded-xl border-2 transition-all text-left hover-lift ${
                      selectedType === type.id
                        ? 'border-primary bg-blue-50'
                        : 'border-border bg-white hover:border-primary/50'
                    }`}
                  >
                    <h3 className="text-xl font-semibold mb-2">{type.name}</h3>
                    <p className="text-muted-foreground text-sm">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {step === 4 ? 'Complete Setup' : 'Next'}
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
