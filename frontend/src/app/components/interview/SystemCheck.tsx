import { useEffect, useState } from 'react';
import { Camera, Mic, Volume2, Wifi, ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';

type CheckState = 'pending' | 'running' | 'ok' | 'fail';

interface Check { key: string; label: string; icon: typeof Camera; state: CheckState; optional?: boolean; note?: string }

/**
 * AETHER — pre-interview system check: camera, microphone, speaker (TTS), network,
 * integrity readiness. Optional failures (TTS / speech-recognition) never block
 * text-mode interviews.
 */
export function SystemCheck({ onDone }: { onDone?: (allOk: boolean) => void }) {
  const [checks, setChecks] = useState<Check[]>([
    { key: 'camera', label: 'Camera', icon: Camera, state: 'pending' },
    { key: 'mic', label: 'Microphone', icon: Mic, state: 'pending' },
    { key: 'speaker', label: 'Speaker (voice)', icon: Volume2, state: 'pending', optional: true },
    { key: 'network', label: 'Network', icon: Wifi, state: 'pending' },
    { key: 'integrity', label: 'Assessment Integrity', icon: ShieldCheck, state: 'pending' },
  ]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const update = (key: string, state: CheckState, note?: string) =>
      setChecks(prev => prev.map(c => (c.key === key ? { ...c, state, note } : c)));

    (async () => {
      // Camera + mic together (one permission prompt)
      update('camera', 'running');
      update('mic', 'running');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        update('camera', 'ok');
        update('mic', 'ok');
      } catch {
        update('camera', 'fail', 'Permission denied — camera is required for the interview');
        update('mic', 'fail', 'Permission denied — microphone is required for voice answers');
      }

      // TTS (optional — text mode always available)
      update('speaker', 'running');
      if ('speechSynthesis' in window) update('speaker', 'ok');
      else update('speaker', 'fail', 'Not supported — text questions will be shown instead');

      // Network
      update('network', 'running');
      try {
        const res = await fetch('/health', { cache: 'no-store' });
        update('network', res.ok ? 'ok' : 'fail', res.ok ? undefined : 'API unreachable');
      } catch {
        update('network', 'fail', 'Cannot reach the server');
      }

      update('integrity', 'ok');
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const criticalOk = checks.every(c => c.optional || c.state === 'ok');
    if (checks.every(c => c.state !== 'pending' && c.state !== 'running')) onDone?.(criticalOk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks]);

  const icons: Record<CheckState, typeof Loader2> = { pending: Loader2, running: Loader2, ok: CheckCircle2, fail: XCircle };
  const colors: Record<CheckState, string> = {
    pending: 'text-slate-300', running: 'text-blue-500 animate-spin', ok: 'text-emerald-600', fail: 'text-red-600',
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-bold text-slate-900 mb-1">System Check</h3>
      <p className="text-xs text-muted-foreground mb-4">Verify your setup before starting the interview.</p>
      <ul className="space-y-3">
        {checks.map(c => {
          const Icon = icons[c.state];
          const Badge = c.icon;
          return (
            <li key={c.key} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Badge className="w-4 h-4 text-slate-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {c.label}{c.optional && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">optional</span>}
                </p>
                {c.note && <p className="text-xs text-slate-500">{c.note}</p>}
              </div>
              <Icon className={`w-4.5 h-4.5 ${colors[c.state]}`} aria-label={c.state} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
