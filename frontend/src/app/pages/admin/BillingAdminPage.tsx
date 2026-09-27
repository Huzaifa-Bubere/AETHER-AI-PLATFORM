/**
 * AETHER — Admin billing dashboard (spec §66-§69).
 *
 * All figures come from /api/admin/billing (real Subscription/Payment/
 * UsageLedger aggregation). Revenue is actual paid invoices — never
 * activeUsers × price. MRR is labeled "Calculated MRR" with its formula.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  IndianRupee, RefreshCw, Download, Users, TrendingUp, AlertTriangle,
  CreditCard, Zap, Loader2,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { Button } from '../../components/ui/button';

const CHART_COLORS = ['#2563EB', '#4F46E5', '#10B981', '#F59E0B', '#DC2626', '#64748B'];

interface BillingData {
  calculationVersion: string;
  generatedAt: string;
  currency: string;
  summary: {
    totalUsers: number;
    activePaidSubscriptions: number;
    cancelAtPeriodEnd: number;
    canceledTotal: number;
    pastDue: number;
    conversionPct: number;
    calculatedMrr: number;
    proMrr: number;
    mrrNote: string;
    failedPayments: number;
    refundedTotal: number;
    creditsThisMonth: number;
  };
  planDistribution: Array<{ planId: string; total: number; active: number; canceled: number; trialing: number; pastDue: number }>;
  revenueByMonth: Array<{ month: string; total: number; payments: number }>;
  creditsByMonth: Array<{ month: string; credits: number }>;
  topConsumers: Array<{ name: string; email: string; total: number; operations: number }>;
  recentPayments: Array<{ id: string; amount: number; currency: string; plan: string; status: string; method: string; at: string; user: { email: string; name: string } | null }>;
  source: string[];
}

const money = (v: number) => v.toLocaleString('en-IN');
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 },
  labelStyle: { fontWeight: 700, color: '#0F172A' },
} as const;

function StatCard({ icon: Icon, label, value, sub, tone = 'text-blue-600' }: { icon: any; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className={`w-4 h-4 ${tone}`} />
      </div>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const tone = plan === 'pro' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : plan === 'campus' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-bold uppercase ${tone}`}>{plan}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    TRIALING: 'bg-blue-50 text-blue-700 border-blue-200',
    PAST_DUE: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELED: 'bg-slate-100 text-slate-600 border-slate-200',
    EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
    INCOMPLETE: 'bg-rose-50 text-rose-600 border-rose-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    refunded: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-bold ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{status.replace('_', ' ')}</span>;
}

export function BillingAdminPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.get<any>('/admin/billing');
      if (res.success) setData(res.data);
      else setError(res.error || 'Failed to load billing data');
    } catch {
      setError('Unable to load billing data.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubs = async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '12' });
      if (filterPlan) qs.set('planId', filterPlan);
      if (filterStatus) qs.set('status', filterStatus);
      const res = await apiService.get<any>(`/admin/billing/subscriptions?${qs}`) as { success: boolean; data?: any[]; pagination?: { page: number; pages: number }; error?: string };
      if (res.success) { setSubs(res.data || []); setPages(res.pagination?.pages || 1); }
    } catch { /* table keeps previous rows */ }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { void loadSubs(); }, [page, filterPlan, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const pieData = useMemo(
    () => (data?.planDistribution || []).filter(p => p.total > 0).map(p => ({ name: p.planId, value: p.total })),
    [data],
  );

  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    // Auth comes from the axios interceptor — window.location.href would drop
    // the Bearer token and 401 silently, so download via getBlob instead.
    setExporting(true);
    try {
      const blob = await apiService.getBlob('/admin/billing/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subscriptions.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // getBlob throws on non-2xx — surface it instead of failing silently.
      setError('Export failed — you may not have admin access.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen pt-16 bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Loading billing data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center max-w-md">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold mb-4">{error}</p>
          <Button onClick={load} variant="outline">Retry</Button>
        </div>
      </div>
    );
  }

  const s = data!.summary;
  const cur = data!.currency === 'INR' ? '₹' : data!.currency + ' ';

  return (
    <div className="min-h-screen pt-16 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-slate-900">Billing & Subscriptions</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated from real payment + subscription records · calculation v{data!.calculationVersion} · {new Date(data!.generatedAt).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
              <Download className="w-3.5 h-3.5 mr-1" /> {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <button onClick={load} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stat cards (§66) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={IndianRupee}
            label="Calculated MRR"
            value={`${cur}${money(s.calculatedMrr)}`}
            sub={`Pro-only ${cur}${money(s.proMrr)} · formula: monthly-normalized active subs (campus custom pricing excluded)`}
          />
          <StatCard
            icon={Users}
            label="Active paid subs"
            value={String(s.activePaidSubscriptions)}
            sub={`${s.conversionPct}% of ${money(s.totalUsers)} registered users`}
            tone="text-indigo-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Cancellations"
            value={String(s.canceledTotal)}
            sub={`${s.cancelAtPeriodEnd} access until period end · ${s.pastDue} past due`}
            tone="text-amber-600"
          />
          <StatCard
            icon={Zap}
            label="AI credits this month"
            value={money(s.creditsThisMonth)}
            sub={`${s.failedPayments} failed payments · ${cur}${money(s.refundedTotal)} refunded`}
            tone="text-violet-600"
          />
        </div>

        {/* MRR formula note (§68) */}
        <div className="rounded-xl bg-blue-50/60 border border-blue-200 px-4 py-2.5 mb-5 text-[11px] text-blue-800">
          <b>Calculated MRR</b> — {s.mrrNote} Revenue below is actual paid invoices only.
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4 mb-5">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Revenue by month</h3>
            <p className="text-[11px] text-slate-400 mb-3">Actual completed payments · {cur}</p>
            {data!.revenueByMonth.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-slate-400">
                No completed payments recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data!.revenueByMonth} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, _n, p: any) => [`${cur}${money(v)} · ${p.payload.payments} payment(s)`, 'Revenue']} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-1">AI credits consumed</h3>
            <p className="text-[11px] text-slate-400 mb-3">From the usage ledger (per-operation rows)</p>
            {data!.creditsByMonth.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-slate-400">No AI usage recorded yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data!.creditsByMonth} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [`${money(v)} credits`, 'AI usage']} />
                  <Line type="monotone" dataKey="credits" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: '#8B5CF6' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Plan distribution</h3>
            <p className="text-[11px] text-slate-400 mb-3">All subscription documents by plan</p>
            {pieData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-slate-400">No subscriptions yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend formatter={(v: any) => <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 space-y-1">
              {data!.planDistribution.map(p => (
                <div key={p.planId} className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700 capitalize">{p.planId}</span>
                  <span>{p.active} active · {p.canceled} canceled{p.trialing ? ` · ${p.trialing} trialing` : ''}{p.pastDue ? ` · ${p.pastDue} past due` : ''}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Top AI consumers this month</h3>
            <p className="text-[11px] text-slate-400 mb-3">From the usage ledger — audit view</p>
            {data!.topConsumers.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-slate-400">No AI usage this month yet.</div>
            ) : (
              <div className="space-y-1.5">
                {data!.topConsumers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[10.5px] text-slate-400 truncate">{c.email}</p>
                    </div>
                    <span className="text-xs font-black text-violet-600 shrink-0">{money(c.total)} cr · {c.operations} ops</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent payments (real ledger) */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 text-sm">Recent payments</h3>
          </div>
          {data!.recentPayments.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No payment events recorded yet. Revenue appears here after real Stripe checkout completions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3">User</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Method</th><th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentPayments.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="py-2 pr-3 text-slate-700">{p.user?.name || p.user?.email || '—'}</td>
                      <td className="py-2 pr-3"><PlanBadge plan={p.plan} /></td>
                      <td className="py-2 pr-3 font-mono font-bold text-slate-800">{cur}{money(p.amount)}</td>
                      <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                      <td className="py-2 pr-3 text-slate-500">{p.method}</td>
                      <td className="py-2 text-slate-500">{fmtDate(p.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Subscriptions table with filters */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Subscriptions</h3>
            <div className="flex items-center gap-2">
              <select value={filterPlan} onChange={e => { setPage(1); setFilterPlan(e.target.value); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" aria-label="Filter by plan">
                <option value="">All plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="campus">Campus</option>
              </select>
              <select value={filterStatus} onChange={e => { setPage(1); setFilterStatus(e.target.value); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" aria-label="Filter by status">
                <option value="">All statuses</option>
                {['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">User</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Interval</th><th className="py-2 pr-3">Renews / Ends</th><th className="py-2">Since</th>
                </tr>
              </thead>
              <tbody>
                {subs.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">No subscriptions match this filter.</td></tr>
                )}
                {subs.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/60">
                    <td className="py-2 pr-3 text-slate-700">{row.user?.name || row.user?.email || '—'}</td>
                    <td className="py-2 pr-3"><PlanBadge plan={row.planId} /></td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={row.status} />
                      {row.cancelAtPeriodEnd && <span className="ml-1.5 text-[10px] text-amber-600 font-semibold">ends {fmtDate(row.accessEndsAt || row.currentPeriodEnd)}</span>}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{row.billingInterval || '—'}</td>
                    <td className="py-2 pr-3 text-slate-500">{fmtDate(row.currentPeriodEnd)}</td>
                    <td className="py-2 text-slate-500">{fmtDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10.5px] text-slate-400 mt-4">
          Sources: {data!.source.join(', ')}. This dashboard never estimates revenue from user counts —
          every rupee shown is an actual completed payment event.
        </p>
      </div>
    </div>
  );
}
