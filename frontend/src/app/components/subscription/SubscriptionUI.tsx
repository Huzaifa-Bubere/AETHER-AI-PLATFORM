/**
 * AETHER — Shared subscription UI (spec §61-§62, §65).
 *
 * Subtle, contextual monetization UX: PRO badges, usage meters and a single
 * reusable upgrade dialog. No lock icons plastered over half the app.
 */

import { useEffect, useState } from 'react';
import { Lock, Sparkles, X, ArrowRight, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { useSubscriptionStore } from '../../stores/subscriptionStore';

// ── ProBadge ────────────────────────────────────────────────────────────────

export function ProBadge({ label = 'PRO', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9.5px] font-black tracking-wider text-indigo-700 uppercase ${className}`}>
      <Sparkles className="w-2.5 h-2.5" /> {label}
    </span>
  );
}

// ── UsageMeter (§65) ────────────────────────────────────────────────────────

export function UsageMeter({
  label, used, quota, resetNote, onUpgrade,
}: {
  label: string;
  used: number;
  quota: number | null;
  resetNote?: string;
  onUpgrade?: () => void;
}) {
  const unlimited = quota === null || quota === undefined;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, quota)) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className={`text-xs font-bold font-mono ${unlimited ? 'text-emerald-600' : nearLimit ? 'text-amber-600' : 'text-slate-600'}`}>
          {unlimited ? 'Unlimited' : `${used} / ${quota} used`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-500' : 'bg-blue-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {(resetNote || nearLimit) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {resetNote && <span className="text-[10.5px] text-slate-400">{resetNote}</span>}
          {nearLimit && onUpgrade && (
            <button onClick={onUpgrade} className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
              Upgrade for higher allowance <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── UpgradeDialog (§61) ─────────────────────────────────────────────────────

export function UpgradeDialog({
  open, onClose, featureTitle, benefits,
}: {
  open: boolean;
  onClose: () => void;
  featureTitle: string;
  benefits: string[];
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-label="Upgrade required">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5 text-white relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-[10px] font-black tracking-widest uppercase opacity-80">AETHER Pro</span>
          </div>
          <h3 className="font-bold text-lg">{featureTitle}</h3>
          <p className="text-xs text-indigo-100 mt-0.5">Upgrade to AETHER Pro to unlock:</p>
        </div>
        <div className="p-6">
          <ul className="space-y-2.5 mb-6">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-[10px] font-black">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <div className="flex gap-2.5">
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={() => { window.location.href = '/subscription'; }}
            >
              View Plans
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LockedFeatureCard (§62/§13) — for locked sections inside a page ────────

export function LockedFeatureCard({
  title, description, benefits,
}: {
  title: string;
  description: string;
  benefits: string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm">{title}</h4>
              <ProBadge />
            </div>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
            <Button
              size="sm"
              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              onClick={() => setDialogOpen(true)}
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
      <UpgradeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} featureTitle={title} benefits={benefits} />
    </>
  );
}

// ── Hook: contextual upgrade check ──────────────────────────────────────────

export function useUpgradeGate() {
  const sub = useSubscriptionStore();
  const [dialog, setDialog] = useState<{ title: string; benefits: string[] } | null>(null);

  return {
    dialog,
    close: () => setDialog(null),
    /** Returns true when allowed; otherwise opens the contextual dialog. */
    require: (feature: string, title: string, benefits: string[]): boolean => {
      if (sub.has(feature)) return true;
      setDialog({ title, benefits });
      return false;
    },
    dialogElement: dialog
      ? <UpgradeDialog open onClose={() => setDialog(null)} featureTitle={dialog.title} benefits={dialog.benefits} />
      : null,
  };
}

/** Fetch subscription state once per mount (lightweight). */
export function useSubscriptionInit() {
  const { loaded, fetch, fetchPlanConfig } = useSubscriptionStore();
  useEffect(() => {
    if (!loaded) void fetch();
    void fetchPlanConfig();
  }, [loaded, fetch, fetchPlanConfig]);
}
