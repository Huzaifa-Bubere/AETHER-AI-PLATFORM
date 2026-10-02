import { apiService } from './api';

/**
 * AETHER Jobs + Job Fit client (spec §49–§70).
 *
 * Types mirror the backend contract. Optional provider fields stay nullable
 * here too, so the UI is forced to render "Salary not listed" rather than
 * inventing a range (spec §61).
 */

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string | null;
  raw: string | null;
  period: 'YEAR' | 'MONTH' | 'HOUR' | null;
}

export type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNSPECIFIED';
export type JobType = 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP' | 'CONTRACT' | 'TEMPORARY' | 'UNSPECIFIED';
export type ExperienceLevel = 'INTERN' | 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'UNSPECIFIED';

export interface JobFitBadge {
  score: number | null;
  label: string | null;
}

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  companyLogo: string | null;
  location: string | null;
  workMode: WorkMode;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  salary: Salary;
  skills: string[];
  roleIds: string[];
  source: string;
  sourceUrl: string;
  datePosted: string | null;
  fetchedAt: string;
  fit: JobFitBadge | null;
}

export interface JobListResponse {
  jobs: JobSummary[];
  page: number;
  pages: number;
  total: number;
  freshness: { lastFetchedAt: string | null; lastFetchedRelative: string | null; totalActive: number };
  providers: Array<{ name: string; configured: boolean; hint: string }>;
  /** True when no live provider is configured — the UI must say so plainly. */
  noProviderConfigured: boolean;
}

export interface JobDetail extends JobSummary {
  description: string;
  requirements: string[];
  active: boolean;
  savedStatus: string | null;
}

export interface JobsQuery {
  role?: string;
  q?: string;
  location?: string;
  workMode?: WorkMode;
  jobType?: JobType;
  experience?: ExperienceLevel;
  postedWithinDays?: number;
  page?: number;
}

function unwrap<T>(response: { success: boolean; data?: T; message?: string; error?: string }): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || response.error || 'Request failed');
  }
  return response.data;
}

export async function fetchJobs(query: JobsQuery = {}): Promise<JobListResponse> {
  return unwrap(await apiService.get<JobListResponse>('/jobs', query));
}

export async function fetchJob(id: string): Promise<JobDetail> {
  return unwrap(await apiService.get<JobDetail>(`/jobs/${id}`));
}

export async function saveJob(id: string, status = 'SAVED'): Promise<unknown> {
  return unwrap(await apiService.post(`/jobs/${id}/save`, { status }));
}

export async function unsaveJob(id: string): Promise<void> {
  await apiService.delete(`/jobs/${id}/save`);
}

export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface SavedJobItem {
  id: string;
  status: ApplicationStatus;
  savedAt: string;
  appliedAt: string | null;
  notes: string;
  resumeVersionId: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    source: string;
    sourceUrl: string;
    workMode: WorkMode;
    active: boolean;
  } | null;
}

export async function fetchSavedJobs(): Promise<{ items: SavedJobItem[]; counts: Record<string, number> }> {
  return unwrap(await apiService.get<{ items: SavedJobItem[]; counts: Record<string, number> }>('/jobs/saved'));
}

export async function updateSavedJobStatus(id: string, status: ApplicationStatus): Promise<SavedJobItem> {
  return unwrap(await apiService.patch<SavedJobItem>(`/jobs/saved/${id}`, { status }));
}

// ── Job fit (spec §49–§56) ───────────────────────────────────────────────────

export interface FitRequirement {
  skillSlug: string | null;
  label: string;
  importance: 'REQUIRED' | 'PREFERRED';
  evidenceStatus: 'EVIDENCED' | 'NOT_EVIDENCED';
  currentLevel: number | null;
  currentLevelLabel: string | null;
  learningTopicSlug: string | null;
}

export interface FitComponent {
  key: string;
  label: string;
  weight: number;
  /** Null means the component could not be evaluated — excluded from the total. */
  earned: number | null;
  basis: string;
  sampleSize: number;
}

export interface FitAnalysis {
  _id: string;
  jobDescriptionText: string;
  roleSlug: string | null;
  score: number | null;
  label: string | null;
  components: FitComponent[];
  requirements: FitRequirement[];
  matchedRequirements: string[];
  missingRequirements: string[];
  nextActions: Array<{ title: string; reason: string; learningTopicSlug: string | null }>;
  recommendedResumeVersionId: string | null;
  recommendedResumeReason: string | null;
  calculationVersion: string;
}

export async function analyzeJobFit(input: {
  jobDescription?: string;
  jobId?: string;
  roleSlug?: string;
  resumeVersionId?: string;
}): Promise<FitAnalysis> {
  return unwrap(await apiService.post<FitAnalysis>('/jobs/fit/analyze', input));
}