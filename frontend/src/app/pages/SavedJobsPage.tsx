import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  fetchSavedJobs,
  unsaveJob,
  updateSavedJobStatus,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type SavedJobItem,
} from '../services/jobs';
import toast from 'react-hot-toast';

/**
 * Saved jobs / application tracker (spec §67, §68).
 *
 * AETHER tracks the candidate's own status for each saved job. It never claims
 * to have submitted an application on the candidate's behalf — the Apply action
 * opens the original posting and the candidate updates the status themselves.
 */

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  SAVED: 'bg-slate-100 text-slate-700',
  APPLIED: 'bg-blue-100 text-blue-700',
  SCREENING: 'bg-violet-100 text-violet-700',
  INTERVIEW: 'bg-amber-100 text-amber-700',
  OFFER: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

export function SavedJobsPage() {
  const [items, setItems] = useState<SavedJobItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSavedJobs();
      setItems(data.items);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved jobs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (item: SavedJobItem, status: ApplicationStatus) => {
    try {
      await updateSavedJobStatus(item.id, status);
      await load();
    } catch {
      toast.error('Could not update status');
    }
  };

  const remove = async (item: SavedJobItem) => {
    if (!item.job) return;
    try {
      await unsaveJob(item.job.id);
      await load();
      toast.success('Removed from tracker');
    } catch {
      toast.error('Could not remove job');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Saved Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Track where you are with each role. AETHER does not submit applications for you.
        </p>
      </header>

      {/* Pipeline counts — only statuses that actually exist are non-zero */}
      <section className="flex flex-wrap gap-2">
        {APPLICATION_STATUSES.filter(s => s !== 'WITHDRAWN' || (counts[s] ?? 0) > 0).map(status => (
          <div key={status} className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">{counts[status] ?? 0}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{status}</p>
          </div>
        ))}
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">No saved jobs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save roles from{' '}
            <Link to="/jobs" className="text-primary hover:underline">
              Jobs
            </Link>{' '}
            to track your applications here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {item.job ? (
                      <Link to={`/jobs/${item.job.id}`} className="hover:underline">
                        {item.job.title}
                      </Link>
                    ) : (
                      'Posting no longer available'
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.job?.company}
                    {item.job?.location && ` · ${item.job.location}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saved {new Date(item.savedAt).toLocaleDateString('en-GB')}
                    {item.appliedAt && ` · Applied ${new Date(item.appliedAt).toLocaleDateString('en-GB')}`}
                    {item.job && !item.job.active && ' · posting no longer active'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[item.status]}`}>
                  {item.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Status
                  <select
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                    value={item.status}
                    onChange={e => void setStatus(item, e.target.value as ApplicationStatus)}
                  >
                    {APPLICATION_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                {item.job && (
                  <>
                    <Button variant="outline" size="sm" asChild={false}>
                      <a href={item.job.sourceUrl} target="_blank" rel="noreferrer noopener">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Original posting
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void remove(item)}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}