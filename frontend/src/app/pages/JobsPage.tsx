import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { JobCard } from '../components/jobs/JobCard';
import {
  fetchJobs,
  saveJob,
  unsaveJob,
  type JobListResponse,
  type JobSummary,
  type WorkMode,
  type JobType,
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
  const [data, setData] = useState<JobListResponse | null>(null);
  const [roles, setRoles] = useState<Array<{ roleSlug: string; roleName: string; isPrimary: boolean }>>([]);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [jobType, setJobType] = useState<JobType | ''>('');
  const [postedWithinDays, setPostedWithinDays] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRoleGoals()
      .then(goals => setRoles(goals.map(g => ({ roleSlug: g.roleSlug, roleName: g.roleName, isPrimary: g.isPrimary }))))
      .catch(() => setRoles([]));
  }, []);

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
        postedWithinDays: postedWithinDays ? Number(postedWithinDays) : undefined,
        page,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load jobs.');
    } finally {
      setLoading(false);
    }
  }, [role, q, location, workMode, jobType, postedWithinDays, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSave = async (job: JobSummary) => {
    try {
      if (savedIds.has(job.id)) {
        await unsaveJob(job.id);
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
        toast.success('Removed from saved jobs');
      } else {
        await saveJob(job.id);
        setSavedIds(prev => new Set(prev).add(job.id));
        toast.success('Saved');
      }
    } catch {
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

      {/* Filters */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Search
            <input
              className={`${inputClass} w-full`}
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
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
            <input
              className={`${inputClass} w-full`}
              value={location}
              onChange={e => { setLocation(e.target.value); setPage(1); }}
              placeholder="City or country"
            />
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