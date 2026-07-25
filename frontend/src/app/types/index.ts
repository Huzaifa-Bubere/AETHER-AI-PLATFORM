// Core Types for Smart Interview AI Platform

export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  preferences: UserPreferences;
  subscription: Subscription;
  auth?: UserAuth;
  createdAt: string;
  updatedAt: string;
}

export interface UserAuth {
  role: 'user' | 'admin';
  isVerified: boolean;
  lastLogin?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  location?: string;
}

export interface UserPreferences {
  role: string;
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
  industries: string[];
  interviewTypes: InterviewType[];
}

export interface Subscription {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled';
  expiresAt?: string;
}

export interface Resume {
  id: string;
  userId: string;
  filename: string;
  fileUrl: string;
  analysis: ResumeAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeAnalysis {
  skills: string[];
  experience: number;
  education: Education[];
  certifications: string[];
  summary: string;
  matchScore?: number;
}

export interface Education {
  degree: string;
  institution: string;
  year: number;
  gpa?: number;
}

export interface Interview {
  id: string;
  userId: string;
  resumeId: string;
  type: InterviewType;
  status: InterviewStatus;
  settings: InterviewSettings;
  questions: Question[];
  responses: Response[];
  analysis?: InterviewAnalysis;
  feedback?: InterviewFeedback;
  createdAt: string;
  completedAt?: string;
}

export type InterviewType = 'behavioral' | 'technical' | 'coding' | 'system-design';
export type InterviewStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface InterviewSettings {
  role: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: number; // in minutes
  includeVideo: boolean;
  includeAudio: boolean;
  includeCoding: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: 'behavioral' | 'technical' | 'coding';
  difficulty: string;
  expectedDuration: number;
  followUpQuestions?: string[];
}

export interface Response {
  questionId: string;
  answer: string;
  audioUrl?: string;
  videoUrl?: string;
  codeSubmission?: CodeSubmission;
  duration: number;
  timestamp: string;
}

export interface CodeSubmission {
  language: string;
  code: string;
  testResults?: TestResult[];
}

export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface InterviewAnalysis {
  videoMetrics: VideoMetrics;
  audioMetrics: AudioMetrics;
  contentMetrics: ContentMetrics;
  overallScore: number;
}

export interface VideoMetrics {
  eyeContactPercentage: number;
  emotionAnalysis: EmotionData[];
  postureScore: number;
  gestureAnalysis: GestureData[];
  confidenceLevel: number;
}

export interface EmotionData {
  timestamp: number;
  emotions: {
    happy: number;
    confident: number;
    nervous: number;
    focused: number;
  };
}

export interface GestureData {
  timestamp: number;
  gestures: string[];
  appropriateness: number;
}

export interface AudioMetrics {
  speechRate: number; // words per minute
  pauseAnalysis: PauseData[];
  fillerWords: FillerWordData[];
  toneAnalysis: ToneData[];
  clarityScore: number;
}

export interface PauseData {
  timestamp: number;
  duration: number;
  type: 'natural' | 'hesitation' | 'thinking';
}

export interface FillerWordData {
  word: string;
  count: number;
  timestamps: number[];
}

export interface ToneData {
  timestamp: number;
  tone: 'confident' | 'uncertain' | 'enthusiastic' | 'monotone';
  intensity: number;
}

export interface ContentMetrics {
  relevanceScore: number;
  technicalAccuracy: number;
  communicationClarity: number;
  structureScore: number;
  keywordMatches: string[];
}

export interface InterviewFeedback {
  overallRating: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  detailedFeedback: string;
  skillAssessment: SkillAssessment[];
  nextSteps: string[];
}

export interface SkillAssessment {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  feedback: string;
}

export interface AIAvatar {
  id: string;
  name: string;
  personality: 'professional' | 'friendly' | 'challenging';
  appearance: AvatarAppearance;
  voiceSettings: VoiceSettings;
}

export interface AvatarAppearance {
  gender: 'male' | 'female' | 'neutral';
  age: 'young' | 'middle' | 'senior';
  ethnicity: string;
  attire: 'business' | 'casual' | 'tech';
}

export interface VoiceSettings {
  pitch: number;
  speed: number;
  accent: string;
  tone: string;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  constraints: MediaStreamConstraints;
}

export interface InterviewSession {
  id: string;
  interviewId: string;
  status: 'connecting' | 'active' | 'paused' | 'ended';
  startTime: string;
  endTime?: string;
  currentQuestionIndex: number;
  isRecording: boolean;
  mediaStream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

export interface DashboardStats {
  totalInterviews: number;
  averageScore: number;
  improvementRate: number;
  skillProgress: SkillProgress[];
  recentInterviews: Interview[];
  upcomingInterviews: Interview[];
}

export interface SkillProgress {
  skill: string;
  currentLevel: number;
  previousLevel: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalInterviews: number;
  averageSessionDuration: number;
  popularRoles: RoleStats[];
  userGrowth: GrowthData[];
  systemHealth: SystemHealth;
}

export interface RoleStats {
  role: string;
  count: number;
  averageScore: number;
}

export interface GrowthData {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export interface SystemHealth {
  apiResponseTime: number;
  aiProcessingTime: number;
  errorRate: number;
  uptime: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  debug?: any;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

export interface OnboardingForm {
  role: string;
  experienceLevel: string;
  industries: string[];
  interviewTypes: InterviewType[];
  resume?: File;
}

export interface InterviewSetupForm {
  type: InterviewType;
  resumeId?: string;
  settings: {
    role: string;
    difficulty: string;
    duration: number;
    includeVideo?: boolean;
    includeAudio?: boolean;
    includeCoding?: boolean;
    domain?: string;
  };
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}