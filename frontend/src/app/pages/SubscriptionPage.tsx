/**
 * AETHER — Pricing & Billing (spec §58-§60, §63-§65).
 *
 * Prices/features/savings come from the backend's central plan config —
 * never hardcoded here. Billing state comes from the authoritative
 * subscription record (not the success URL).
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Zap, Shield, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { apiService } from '../services/api';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useSubscriptionInit, UsageMeter } from '../components/subscription/SubscriptionUI';
import toast from 'react-hot-toast';

const INTERVALS = [
  { id: 'monthly', label: 'Monthly', months: 1 },
  { id: 'halfyear', label: '6 Months', months: 6 },
  { id: 'yearly', label: 'Yearly', months: 12 },
] as const;

type IntervalId = (typeof INTERVALS)[number]['id'];

export function SubscriptionPage() {
  useSubscriptionInit();
  const sub = useSubscriptionStore();
  const [interval, setInterval] = useState<IntervalId>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => { void sub.fetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plans = sub.planConfig?.plans ?? [];
  const savings = sub.planConfig?.savings ?? {};

  const savingsLabel = useMemo(() => {
    if (interval === 'halfyear') return savings.monthlyVsHalfyear;
    if (interval === 'yearly') return savings.monthlyVsYearly;
    return null;
  }, [interval, savings]);

  const priceFor = (plan: any): { text: string; per: string; custom?: boolean } => {
    if (plan.pricing === 'custom') return { text: 'Custom', per: 'institutional pricing', custom: true };
    const amount = plan.pricing?.[interval];
    const months = INTERVALS.find(i => i.id === interval)!.months;
    if (!amount) return { text: '—', per: '' };
    if (plan.id === 'free') return { text: '₹0', per: 'forever' };
    return { text: `₹${amount.toLocaleString('en-IN')}`, per: `/ ${interval === 'monthly' ? 'month' : months + ' months'}` };
  };

  const handleUpgrade = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const response = await apiService.post<{ url: string }>('/payment/create-checkout-session', { plan: planId, interval });
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error(response.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    setManaging(true);
    try {
      const response = await apiService.post<{ url: string }>('/payment/create-portal-session', {});
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to open billing portal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setManaging(false);
    }
  };

  /** Dev-only manual activation (backend refuses when Stripe is live). */
  const handleManualActivate = async (planId: string) => {
    setActivating(true);
    try {
      const res = await apiService.post('/subscription/activate-manual', { planId });
      if (res.success) {
        toast.success(`Plan set to ${planId}`);
        await sub.fetch();
      } else {
        toast.error(res.error || 'Manual activation unavailable');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Manual activation unavailable');
    } finally {
      setActivating(false);
    }
  };

  const isCurrent = (id: string) => sub.planId === id && sub.status !== 'CANCELED';
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div className="min-h-screen pt-16 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* ── Billing summary (§58) ── */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Current plan</p>
              <div className="flex items-center gap-2.5 mt-1">
                <h2 className="text-2xl font-black text-slate-900">
                  {sub.planId === 'pro' ? 'AETHER Pro' : sub.planId === 'campus' ? 'Campus' : 'Free'}
                </h2>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                  sub.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : sub.status === 'PAST_DUE' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : sub.status === 'CANCELED' ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  {sub.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {sub.planId !== 'free' && sub.currentPeriodEnd && (
                  sub.cancelAtPeriodEnd
                    ? <>Access ends <b>{fmtDate(sub.accessEndsAt || sub.currentPeriodEnd)}</b> (canceled — no further charges).</>
                    : <>Next renewal <b>{fmtDate(sub.currentPeriodEnd)}</b>{sub.billingInterval ? ` · billed ${sub.billingInterval}` : ''}</>
                )}
                {sub.planId === 'free' && 'Explore AETHER — upgrade anytime.'}
              </p>
            </div>
            {sub.planId !== 'free' && (
              <Button variant="outline" onClick={handleManage} disabled={managing}>
                {managing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                Manage Billing
              </Button>
            )}
          </div>

          {/* Usage meters (§65) */}
          {sub.usage && (
            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              <UsageMeter label="AI Credits" used={sub.usage.aiCredits?.used ?? 0} quota={sub.usage.aiCredits?.quota} resetNote={sub.usage.aiCredits?.quota != null ? 'Resets monthly' : undefined} onUpgrade={() => setInterval('monthly')} />
              <UsageMeter label="AI Interviews" used={sub.usage.aiInterviews?.used ?? 0} quota={sub.usage.aiInterviews?.quota} onUpgrade={() => setInterval('monthly')} />
              <UsageMeter label="Resume Versions" used={sub.usage.resumeVersions?.used ?? 0} quota={sub.usage.resumeVersions?.quota} onUpgrade={() => setInterval('monthly')} />
            </div>
          )}
        </div>

        {/* ── Interval toggle (§60) — savings only from computed config ── */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-900">Choose Your Plan</h1>
          <div className="inline-flex items-center gap-1 mt-4 bg-white border border-slate-200 rounded-xl p-1">
            {INTERVALS.map(i => (
              <button
                key={i.id}
                onClick={() => setInterval(i.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  interval === i.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {i.label}
                {i.id !== 'monthly' && (savings as any)?.[i.id === 'halfyear' ? 'monthlyVsHalfyear' : 'monthlyVsYearly'] ? (
                  <span className={`ml-1.5 ${interval === i.id ? 'text-emerald-200' : 'text-emerald-600'}`}>
                    −{(savings as any)[i.id === 'halfyear' ? 'monthlyVsHalfyear' : 'monthlyVsYearly']}%
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* ── Plan cards (§59) ── */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map(plan => {
            const p = priceFor(plan);
            const current = isCurrent(plan.id);
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white border p-7 flex flex-col ${
                  plan.highlight ? 'border-blue-600 border-2 shadow-lg' : 'border-slate-200'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold shadow">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    plan.id === 'pro' ? 'bg-blue-600 text-white' : plan.id === 'campus' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {plan.id === 'free' ? <Zap className="w-5 h-5" /> : plan.id === 'pro' ? <Crown className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">{plan.name}</h3>
                    <p className="text-[11px] text-slate-500">{plan.tagline}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mb-6">
                  <span className="text-3xl font-black text-slate-900">{p.text}</span>
                  <span className="text-xs text-slate-400">{p.per}</span>
                </div>
                <ul className="space-y-2.5 text-sm flex-1 mb-7">
                  {(plan.features || []).map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-700">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.id === 'campus' ? (
                  <a
                    href="mailto:campus@aether.app?subject=Campus%20Plan%20Access"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Contact / Request Access <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : plan.id === 'free' ? (
                  <Button variant="outline" className="w-full" onClick={() => toast('You are already on the free plan')} disabled>
                    Free
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loadingPlan === plan.id}
                  >
                    {loadingPlan === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.ctaLabel || 'Upgrade'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Downgrade-safety note (§63) */}
        <p className="text-center text-xs text-slate-400 mt-8 max-w-2xl mx-auto">
          Downgrading never deletes your data. If you move to Free with more resume versions than the
          Free plan allows, everything stays viewable — only new creation is limited until you upgrade again.
        </p>

        {/* Dev helper: manual activation when Stripe isn't configured */}
        {!sub.planConfig && (
          <div className="text-center mt-6">
            <button
              onClick={() => handleManualActivate('pro')}
              disabled={activating}
              className="text-[11px] text-slate-300 hover:text-slate-500 inline-flex items-center gap-1"
              title="Development only — available when Stripe is not configured"
            >
              <RefreshCw className={`w-3 h-3 ${activating ? 'animate-spin' : ''}`} /> Dev: activate Pro manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
