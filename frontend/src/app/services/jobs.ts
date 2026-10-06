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

/**
 * Friendly labels for the experience filter (spec §32).
 * The VALUE stays the stable enum — only the label is friendlier, so "fresher"
 * and "1-3 years" are the same filter to the backend.
 */
export const EXPERIENCE_FILTER_OPTIONS: Array<{ value: ExperienceLevel | ''; label: string }> = [
  { value: '', label: 'Any experience' },
  { value: 'INTERN', label: 'Internship' },
  { value: 'ENTRY', label: 'Fresher / Entry level' },
  { value: 'MID', label: '1–3 years' },
  { value: 'SENIOR', label: '3–5 years' },
  { value: 'LEAD', label: 'Senior / Lead' },
];

/**
 * Advisory location suggestions (spec §54).
 * These are SUGGESTIONS for the datalist, not a whitelist — any location the
 * provider returns is still searchable.
 */
export const INDIA_LOCATION_SUGGESTIONS = [
  'Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Bengaluru', 'Bangalore', 'Hyderabad',
  'Chennai', 'Delhi NCR', 'Gurugram', 'Gurgaon', 'Noida', 'Kolkata', 'Ahmedabad',
  'Coimbatore', 'Indore', 'Remote', 'India',
];

export interface JobFitBadge {
  score: number | null;
  label: string | null;
}

/**
 * Search relevance (spec §B4).
 *
 * This is NOT the job requirement match. `JobFitBadge.score` is AETHER's
 * JOB REQUIREMENT MATCH against one job description; `JobRecommendation` is the
 * ranking score used to decide which postings appear first. The two must never
 * be shown under the same label.
 */
export interface JobRecommendation {
  recommendationScore: number | null;
  recommendationLabel: string | null;
  reasonSummary: string;
  components: Array<{ key: string; label: string; weight: number; earned: number | null; basis: string }>;
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
  /** Search relevance. Distinct from `fit`, which is the requirement match. */
  recommendation: JobRecommendation | null;
  /** How many providers listed this vacancy (cross-provider grouping). */
  availableFromNProviders?: number;
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
// ── Search preferences, saved searches, alerts, "new since last visit" ──────
// (spec §D, §E, §F, §G)

export interface JobSearchPreference {
  roleSlug: string;
  keywords: string[];
  locations: string[];
  workModes: WorkMode[];
  jobTypes: JobType[];
  experienceLevels: ExperienceLevel[];
  remoteOnly: boolean;
  datePostedWindow: number | null;
  lastViewedAt: string | null;
}

export async function fetchJobPreferences(): Promise<JobSearchPreference[]> {
  return unwrap(await apiService.get<JobSearchPreference[]>('/jobs/preferences'));
}

/**
 * Save the browsing preference for ONE role. This never touches career goals —
 * changing a search filter must not change the candidate's primary role.
 */
export async function saveJobPreference(
  roleSlug: string,
  patch: Partial<Omit<JobSearchPreference, 'roleSlug' | 'lastViewedAt'>>,
): Promise<JobSearchPreference> {
  return unwrap(
    await apiService.put<JobSearchPreference>(`/jobs/preferences/${encodeURIComponent(roleSlug)}`, patch),
  );
}

export interface SavedJobSearch {
  id: string;
  name: string;
  roleSlug: string | null;
  query: string | null;
  locations: string[];
  workModes: WorkMode[];
  jobTypes: JobType[];
  experienceLevels: ExperienceLevel[];
  postedWithinDays: number | null;
  lastRunAt: string | null;
  createdAt: string;
}

export async function fetchSavedSearches(): Promise<SavedJobSearch[]> {
  return unwrap(await apiService.get<SavedJobSearch[]>('/jobs/saved-searches'));
}

export async function createSavedSearch(
  input: Omit<SavedJobSearch, 'id' | 'lastRunAt' | 'createdAt'>,
): Promise<SavedJobSearch> {
  return unwrap(await apiService.post<SavedJobSearch>('/jobs/saved-searches', input));
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await apiService.delete(`/jobs/saved-searches/${id}`);
}

/** Run a saved search and get back the query string to navigate to. */
export async function runSavedSearch(id: string): Promise<string> {
  const data = unwrap(await apiService.post<{ queryString: string }>(`/jobs/saved-searches/${id}/run`));
  return data.queryString;
}

export interface JobAlertItem {
  id: string;
  type: 'NEW_JOB_MATCH';
  jobId: string;
  title: string;
  company: string;
  roleSlug: string | null;
  recommendationScore: number;
  recommendationLabel: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface JobAlertsResponse {
  items: JobAlertItem[];
  unreadCount: number;
  /** Relevance a posting must clear before it raises an alert. */
  threshold: number;
  /** Always 'in-app': AETHER sends no email and claims no delivery. */
  delivery: string;
}

export async function fetchJobAlerts(unreadOnly = false): Promise<JobAlertsResponse> {
  return unwrap(await apiService.get<JobAlertsResponse>(`/jobs/alerts${unreadOnly ? '?unread=true' : ''}`));
}

export async function markJobAlertRead(id: string): Promise<void> {
  await apiService.patch(`/jobs/alerts/${id}/read`);
}

/**
 * Record this visit and get back how many jobs were new since the previous one.
 *
 * `newJobs` is null on a candidate's FIRST visit: there is no honest baseline,
 * so the UI must show nothing rather than an invented badge.
 */
export async function recordJobVisit(roleSlug?: string | null): Promise<{
  roleSlug: string;
  previousViewedAt: string | null;
  newJobs: number | null;
}> {
  return unwrap(await apiService.post('/jobs/seen', { roleSlug: roleSlug ?? null }));
}

export interface JobSummaryResponse {
  counts: Record<string, number>;
  saved: number;
  applied: number;
  screening: number;
  interviews: number;
  offers: number;
  newJobs: number | null;
  bestCurrentMatch: { score: number; label: string | null; roleSlug: string | null; computedAt: string } | null;
  recentJobFits: Array<{
    id: string;
    jobId: string | null;
    jobTitle: string | null;
    company: string | null;
    roleSlug: string | null;
    score: number | null;
    label: string | null;
    computedAt: string;
  }>;
}

export async function fetchJobSummary(): Promise<JobSummaryResponse> {
  return unwrap(await apiService.get<JobSummaryResponse>('/jobs/summary'));
}
