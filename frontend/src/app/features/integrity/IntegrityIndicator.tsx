import { ShieldCheck, ShieldAlert } from 'lucide-react';

/**
 * AETHER — Assessment Integrity indicator (top-right of protected assessments).
 * States communicated by text + color (never color alone).
 */
export function IntegrityIndicator({ warningCount, maximumWarnings, active = true }: {
  warningCount: number;
  maximumWarnings: number;
  active?: boolean;
}) {
  const level = warningCount >= maximumWarnings ? 'red' : warningCount === maximumWarnings - 1 ? 'orange' : warningCount > 0 ? 'amber' : 'green';
  const styles: Record<string, string> = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  const label = !active ? 'Integrity off'
    : warningCount >= maximumWarnings ? 'Auto-submitted'
    : warningCount === 0 ? 'Secure'
    : `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-semibold ${styles[level]}`}
      title={`Assessment integrity active — Warnings: ${warningCount} / ${maximumWarnings}`}
      aria-label={`Assessment integrity active. Warnings ${warningCount} of ${maximumWarnings}.`}>
      {level === 'green'
        ? <ShieldCheck className="w-3.5 h-3.5" />
        : <ShieldAlert className="w-3.5 h-3.5" />}
      <span>{label}</span>
      <span className="opacity-60 font-medium">{warningCount}/{maximumWarnings}</span>
    </div>
  );
}
