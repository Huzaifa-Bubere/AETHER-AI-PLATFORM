import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { apiService } from '../../services/api';

/**
 * AETHER — Admin → Job providers (spec Part AZ).
 *
 * Shows the truth about every provider adapter: whether it is configured, how its
 * last run ended, and what it actually delivered. "Refresh Now" calls the
 * existing ADMIN-ONLY, rate-limited endpoint — it never triggers an external
 * fetch from the browser, and the backend refuses a second run inside its
 * cooldown.
 *
 * No credential is ever displayed: the API returns a hint that NAMES the missing
 * environment variables and nothing else.
 */

interface ProviderHealth {
  name: string;
  status: string;
  configured: boolean;
  enabled: boolean;
  hint: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  lastFetched: number;
  lastCreated: number;
  lastUpdated: number;
  lastSkipped: number;
  lastDurationMs: number | null;
  lastRunAt: string | null;
  consecutiveFailures: number;
}

interface ProvidersOverall {
  status: string;
  summary: string;
  counts: Record<string, number>;
}

interface ProvidersPayload {
  providers: ProviderHealth[];
  overall: ProvidersOverall;
  scheduler: { intervalMinutes: number; lastRunAt: string | null; running: boolean };
}

function relative(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'text-emerald-600',
  DEGRADED: 'text-orange-600',
  DISABLED: 'text-slate-500',
  NOT_CONFIGURED: 'text-slate-500',
};

export function AdminJobProvidersCard() {
  const [data, setData] = useState<ProvidersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.get<ProvidersPayload>('/jobs/providers');
      if (!response.success || !response.data) {
        // Prefer the server's own error text (e.g. "Admin access required") over a
        // generic message — a bare "Could not read provider health" hid the cause.
        throw new Error(response.error || response.message || 'Could not read provider health');
      }
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read provider health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      const response = await apiService.post<{ reports: unknown[]; providers: ProviderHealth[] }>('/jobs/refresh');
      if (!response.success) throw new Error(response.error || response.message || 'Refresh failed');
      setData(prev => (prev ? { ...prev, providers: response.data.providers } : prev));
      toast.success('Job providers refreshed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refresh job providers');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-xl">Job providers</h3>
        </div>
        {data && (
          <span className="text-xs text-muted-foreground">
            Scheduled refresh every {data.scheduler.intervalMinutes} min · last run {relative(data.scheduler.lastRunAt)}
          </span>
        )}
        {data?.overall && (
          <span className="w-full text-xs text-muted-foreground">{data.overall.summary}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Reload status
          </Button>
          <Button size="sm" onClick={() => void refreshNow()} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <ShieldAlert className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Last checked</th>
              <th className="py-2 pr-4 font-semibold">Last success</th>
              <th className="py-2 pr-4 font-semibold">Fetched</th>
              <th className="py-2 pr-4 font-semibold">New / updated</th>
              <th className="py-2 pr-4 font-semibold">Latency</th>
              <th className="py-2 font-semibold">Error</th>
            </tr>
          </thead>
          <tbody>
            {(data?.providers ?? []).map(provider => (
              <tr key={provider.name} className="border-b border-border/60 align-top">
                <td className="py-3 pr-4 font-medium">{provider.name}</td>
                <td className={`py-3 pr-4 font-semibold ${STATUS_TONE[provider.status] ?? 'text-slate-600'}`}>
                  {provider.status.replace(/_/g, ' ').toLowerCase()}
                  {!provider.configured && (
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{provider.hint}</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{relative(provider.lastRunAt)}</td>
                <td className="py-3 pr-4 text-muted-foreground">{relative(provider.lastSuccessAt)}</td>
                <td className="py-3 pr-4 tabular-nums">{provider.lastFetched}</td>
                <td className="py-3 pr-4 tabular-nums">
                  {provider.lastCreated} / {provider.lastUpdated}
                  {provider.lastSkipped > 0 && (
                    <span className="block text-[11px] text-muted-foreground">{provider.lastSkipped} skipped</span>
                  )}
                </td>
                <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                  {provider.lastDurationMs == null ? '—' : `${provider.lastDurationMs} ms`}
                </td>
                <td className="py-3 text-xs text-red-600">{provider.lastError ?? (provider.consecutiveFailures > 0 ? `${provider.consecutiveFailures} consecutive failures` : '—')}</td>
              </tr>
            ))}
            {!loading && (data?.providers?.length ?? 0) === 0 && (
              <tr><td colSpan={8} className="py-4 text-sm text-muted-foreground">No provider adapters are registered.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Refreshes run on the server against each provider's official API. Secrets stay in the backend
        environment and are never sent to the browser. Manual refreshes are rate-limited to one per minute.
      </p>
    </div>
  );
}

export default AdminJobProvidersCard;
