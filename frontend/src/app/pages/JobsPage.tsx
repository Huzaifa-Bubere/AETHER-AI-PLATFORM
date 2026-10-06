import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { JobCard } from '../components/jobs/JobCard';
import {
  fetchJobs,
  saveJob,
  unsaveJob,
  fetchSavedJobs,
  recordJobVisit,
  EXPERIENCE_FILTER_OPTIONS,
  INDIA_LOCATION_SUGGESTIONS,
  type JobListResponse,
  type JobSummary,
  type WorkMode,
  type JobType,
  type ExperienceLevel,
} from '../services/jobs';
import { fetchRoleGoals } from '../services/roleProgress';
import toast from 'react-hot-toast';

/**
 * AETHER Jobs (spec §57, §64).
 *
 * Lists real postings from configured providers, filtered to the candidate's
 * target roles. Filters are server-side; the page never filters client-side and
 * reorders results itself.
 */
export function JobsPage() {
  const navigate = useNavigate();
  // Filters live in the URL so refresh, back/forward and shared links all work.
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<JobListResponse | null>(null);
  const [roles, setRoles] = useState<Array<{ roleSlug: string; roleName: string; isPrimary: boolean }>>([]);
  const [role, setRole] = useState(() => searchParams.get('role') ?? '');
  const [qInput, setQInput] = useState(() => searchParams.get('q') ?? '');
  // `q` is the DEBOUNCED value that actually triggers a request.
  const [q, setQ] = useState(qInput);
  const [location, setLocation] = useState(() => searchParams.get('location') ?? '');
  const [workMode, setWorkMode] = useState<WorkMode | ''>(() => (searchParams.get('workMode') as WorkMode) ?? '');
  const [jobType, setJobType] = useState<JobType | ''>(() => (searchParams.get('jobType') as JobType) ?? '');
  const [experience, setExperience] = useState<ExperienceLevel | ''>(
    () => (searchParams.get('experience') as ExperienceLevel) ?? '',
  );
  const [postedWithinDays, setPostedWithinDays] = useState(() => searchParams.get('postedWithinDays') ?? '');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Real count of jobs newer than the candidate's previous visit. Null means
  // there is no honest baseline yet, so NO badge is shown (spec §F1).
  const [newJobs, setNewJobs] = useState<number | null>(null);

  // Track whether the role filter came from the user/URL so the primary-role
  // default never fights an explicit choice.
  const roleFromUrl = useRef(searchParams.get('role') != null);

  useEffect(() => {
    fetchRoleGoals()
      .then(goals => setRoles(goals.map(g => ({ roleSlug: g.roleSlug, roleName: g.roleName, isPrimary: g.isPrimary }))))
      .catch(() => setRoles([]));
  }, []);

  // Keyword input is debounced so a request is not fired on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(t);
  }, [qInput]);

  // PART 5: when /jobs opens without an explicit role in the URL, prefer the
  // candidate's PRIMARY role. This is only a search view preference -- it never
  // writes to the stored primaryRole.
  useEffect(() => {
    if (roleFromUrl.current || role) return;
    const primary = roles.find(r => r.isPrimary);
    if (primary) setRole(primary.roleSlug);
  }, [roles, role]);

  // Mirror filter state into the URL (replace, so history is not spammed).
  useEffect(() => {
    const next: Record<string, string> = {};
    if (role) next.role = role;
    if (q) next.q = q;
    if (location) next.location = location;
    if (workMode) next.workMode = workMode;
    if (jobType) next.jobType = jobType;
    if (experience) next.experience = experience;
    if (postedWithinDays) next.postedWithinDays = postedWithinDays;
    if (page > 1) next.page = String(page);
    setSearchParams(next, { replace: true });
  }, [role, q, location, workMode, jobType, experience, postedWithinDays, page, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJobs({
        role: role || undefined,
        q: q || undefined,
        location: location || undefined,
        workMode: workMode || undefined,
        jobType: jobType || undefined,
        experience: experience || undefined,
        postedWithinDays: postedWithinDays ? Number(postedWithinDays) : undefined,
        page,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load jobs.');
    } finally {
      setLoading(false);
    }
  }, [role, q, location, workMode, jobType, experience, postedWithinDays, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Saved state comes from the SERVER, not local component state, so a job
  // saved in a previous session still shows as saved after refresh (spec §11).
  const loadSaved = useCallback(async () => {
    try {
      const saved = await fetchSavedJobs();
      setSavedIds(new Set(saved.items.map(i => i.job?.id).filter((id): id is string => Boolean(id))));
    } catch {
      // Leave the set untouched; the list is still usable without it.
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  // Record the visit and learn how much is new. The backend reads the previous
  // timestamp before writing the new one, so the count is never measured against
  // a stamp this request just moved (spec §F2).
  useEffect(() => {
    recordJobVisit(role || null)
      .then(result => setNewJobs(result.newJobs))
      .catch(() => setNewJobs(null));
  }, [role]);

  const toggleSave = async (job: JobSummary) => {
    const wasSaved = savedIds.has(job.id);
    // Optimistic, then reconciled against the server so a failed write is undone.
    setSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(job.id); else next.add(job.id);
      return next;
    });
    try {
      if (wasSaved) {
        await unsaveJob(job.id);
        toast.success('Removed from saved jobs');
      } else {
        await saveJob(job.id);
        toast.success('Saved');
      }
      void loadSaved();
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(job.id); else next.delete(job.id);
        return next;
      });
      toast.error('Could not update saved jobs');
    }
  };

  const inputClass = 'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          {data?.freshness.lastFetchedRelative
            ? `Updated ${data.freshness.lastFetchedRelative} · ${data.freshness.totalActive} active postings`
            : 'Current job postings from configured providers.'}
        </p>
      </header>

      {/* Real "new since last visit" count. Rendered only when the count is real. */}
      {newJobs != null && newJobs > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {newJobs} new job{newJobs === 1 ? '' : 's'} matching this search since your last visit.
        </div>
      )}

      {/* Filters */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Search
            <input
              className={`${inputClass} w-full`}
              value={qInput}
              onChange={e => { setQInput(e.target.value); setPage(1); }}
              placeholder="Job title, skill or company"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Target role
            <select
              className={`${inputClass} w-full`}
              value={role}
              onChange={e => { setRole(e.target.value); setPage(1); }}
            >
              <option value="">All my roles</option>
              {roles.map(r => (
                <option key={r.roleSlug} value={r.roleSlug}>
                  {r.roleName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Location
            {/*
              Advisory suggestions only. The input stays a free-text field, so
              any location a provider returns is still searchable — the list is
              never treated as a whitelist (spec §54).
            */}
            <input
              className={`${inputClass} w-full`}
              value={location}
              onChange={e => { setLocation(e.target.value); setPage(1); }}
              placeholder="City or country"
              list="aether-location-suggestions"
            />
            <datalist id="aether-location-suggestions">
              {INDIA_LOCATION_SUGGESTIONS.map(city => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Work mode
            <select
              className={`${inputClass} w-full`}
              value={workMode}
              onChange={e => { setWorkMode(e.target.value as WorkMode | ''); setPage(1); }}
            >
              <option value="">Any</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Job type
            <select
              className={`${inputClass} w-full`}
              value={jobType}
              onChange={e => { setJobType(e.target.value as JobType | ''); setPage(1); }}
            >
              <option value="">Any</option>
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Experience
            <select
              className={`${inputClass} w-full`}
              value={experience}
              onChange={e => { setExperience(e.target.value as ExperienceLevel | ''); setPage(1); }}
            >
              {EXPERIENCE_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Date posted
            <select
              className={`${inputClass} w-full`}
              value={postedWithinDays}
              onChange={e => { setPostedWithinDays(e.target.value); setPage(1); }}
            >
              <option value="">Any time</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* No provider configured — say so plainly rather than inventing listings */}
      {data?.noProviderConfigured && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">No live job provider is configured.</p>
          <p className="mt-1">
            {data.providers.map(p => `${p.name}: ${p.hint}`).join(' · ')} — AETHER will not show
            invented postings in the meantime.
          </p>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : data && data.jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No jobs matched these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.noProviderConfigured
              ? 'Configure a job provider to start receiving current postings.'
              : 'Try widening your filters or clearing the search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              saved={savedIds.has(job.id)}
              onSave={toggleSave}
              onAnalyze={() => navigate(`/job-fit?jobId=${job.id}`)}
            />
          ))}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}