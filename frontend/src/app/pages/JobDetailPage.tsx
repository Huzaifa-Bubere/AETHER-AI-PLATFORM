import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { formatSalary, relativeDate, WORK_MODE_LABELS, JOB_TYPE_LABELS, EXPERIENCE_LABELS } from '../components/jobs/JobCard';
import { fetchJob, saveJob, type JobDetail } from '../services/jobs';
import toast from 'react-hot-toast';

/**
 * Job detail (spec §69).
 *
 * Shows the full posting, the skills extracted from it, the source it came
 * from and its freshness. Apply always opens the original verified source.
 */
export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      setJob(await fetchJob(jobId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    if (!job) return;
    try {
      await saveJob(job.id);
      toast.success(job.savedStatus ? 'Tracker updated' : 'Saved');
      await load();
    } catch {
      toast.error('Could not save this job');
    }
  };

  if (loading && !job) {
    return <div className="mx-auto max-w-4xl px-4 py-8"><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-destructive">{error}</p>
        <Link to="/jobs" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Back to Jobs
        </Link>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        All jobs
      </Link>

      <header className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
            <p className="text-muted-foreground">{job.company}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{job.location ?? 'Location not listed'}</span>
              <span>{WORK_MODE_LABELS[job.workMode]}</span>
              <span>{JOB_TYPE_LABELS[job.jobType]}</span>
              <span>{EXPERIENCE_LABELS[job.experienceLevel]}</span>
              <span>{relativeDate(job.datePosted)}</span>
            </p>
          </div>
          {job.companyLogo && <img src={job.companyLogo} alt="" className="h-12 w-12 rounded object-contain" />}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-3 py-1.5 text-sm text-muted-foreground">{formatSalary(job.salary)}</span>
          {job.fit?.score != null && (
            <span className="rounded bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              {job.fit.score}/100 · {job.fit.label}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={onSave} variant={job.savedStatus ? 'outline' : 'default'}>
            <Bookmark className={`mr-2 h-4 w-4 ${job.savedStatus ? 'fill-primary' : ''}`} />
            {job.savedStatus ? `Saved · ${job.savedStatus}` : 'Save job'}
          </Button>
          <Button variant="outline" asChild={false}>
            <Link to={`/job-fit?jobId=${job.id}`}>Analyze fit</Link>
          </Button>
          {/* Apply opens the ORIGINAL source; AETHER does not submit applications. */}
          <Button asChild={false}>
            <a href={job.sourceUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="mr-2 h-4 w-4" />
              Apply on {job.source}
            </a>
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Source: {job.source} · fetched {new Date(job.fetchedAt).toLocaleString()}
          {!job.active && ' · no longer active'}
        </p>
      </header>

      {job.skills.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Skills in this posting</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.skills.map(skill => (
              <span key={skill} className="rounded bg-primary/5 px-2 py-1 text-sm text-primary">
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {job.requirements.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Requirements</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {job.requirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Description</h2>
        {job.description ? (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{job.description}</p>
        ) : (
          <p className="mt-2 text-sm italic text-muted-foreground">This provider did not supply a description.</p>
        )}
      </section>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}