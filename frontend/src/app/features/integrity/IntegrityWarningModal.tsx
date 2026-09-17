import { AlertTriangle, ShieldAlert, Ban, Eye, Clipboard, Camera, Monitor, Mic, Maximize, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { IntegrityEventType } from './integrity.types';

const EVENT_MESSAGES: Record<IntegrityEventType, { title: string; description: string; icon: typeof Eye }> = {
  TAB_SWITCH: { title: 'Tab switch detected', description: 'You opened or switched to another browser tab. Return to the assessment immediately.', icon: Monitor },
  WINDOW_BLUR: { title: 'You left the assessment window', description: 'The assessment window lost focus. Every leave action is recorded by the proctoring system.', icon: Eye },
  FULLSCREEN_EXIT: { title: 'Fullscreen exited', description: 'You left fullscreen mode. Stay in fullscreen until you submit your assessment.', icon: Maximize },
  COPY_ATTEMPT: { title: 'Copy attempt blocked', description: 'Copying assessment content is disabled and was recorded.', icon: Clipboard },
  PASTE_ATTEMPT: { title: 'Paste attempt blocked', description: 'Pasting content into the assessment is disabled and was recorded.', icon: Clipboard },
  CONTEXT_MENU: { title: 'Context menu blocked', description: 'Right-click is disabled during the assessment.', icon: Ban },
  CAMERA_DISABLED: { title: 'Camera disabled', description: 'Your camera was turned off. Turn it back on immediately.', icon: Camera },
  CAMERA_PERMISSION_REVOKED: { title: 'Camera permission revoked', description: 'Camera access was revoked. Re-enable it to continue under monitoring.', icon: Camera },
  FACE_NOT_VISIBLE: { title: 'Face not visible', description: 'Your face was not visible in the camera frame for an extended period.', icon: Camera },
  MULTIPLE_FACES: { title: 'Multiple faces detected', description: 'More than one face was detected in the camera frame.', icon: Camera },
  MICROPHONE_DISABLED: { title: 'Microphone disabled', description: 'Your microphone was disabled during an active response.', icon: Mic },
  PAGE_RELOAD_ATTEMPT: { title: 'Page reload recorded', description: 'A page reload was attempted during the assessment.', icon: RefreshCw },
};

/** Visual escalation per warning number: amber → orange → red → full-red final. */
function severityFor(warningNumber: number, maximumWarnings: number) {
  const isFinal = warningNumber >= maximumWarnings - 1;
  const isThirdPlus = warningNumber >= maximumWarnings - 2;
  if (isFinal) {
    return {
      isFinal: true,
      backdrop: 'bg-red-900/80',
      container: 'border-4 border-red-600 bg-white shadow-[0_0_80px_rgba(220,38,38,0.55)]',
      banner: 'bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white',
      iconWrap: 'bg-red-100 ring-8 ring-red-200',
      iconColor: 'text-red-600 animate-pulse',
      titleColor: 'text-red-700',
      bannerTitle: 'FINAL WARNING',
      box: 'bg-red-600 text-white border-red-700',
      boxLabel: 'text-red-100',
    };
  }
  if (isThirdPlus) {
    return {
      isFinal: false,
      backdrop: 'bg-red-950/60',
      container: 'border-2 border-red-300 bg-white shadow-[0_0_40px_rgba(220,38,38,0.35)]',
      banner: 'bg-red-50 text-red-700 border-b border-red-200',
      iconWrap: 'bg-red-50',
      iconColor: 'text-red-600',
      titleColor: 'text-red-700',
      bannerTitle: 'SEVERE WARNING',
      box: 'bg-red-50 text-red-800 border-red-200',
      boxLabel: 'text-red-600',
    };
  }
  if (warningNumber === 2) {
    return {
      isFinal: false,
      backdrop: 'bg-orange-950/50',
      container: 'border-2 border-orange-300 bg-white shadow-2xl',
      banner: 'bg-orange-50 text-orange-700 border-b border-orange-200',
      iconWrap: 'bg-orange-50',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-700',
      bannerTitle: 'SECOND WARNING',
      box: 'bg-orange-50 text-orange-900 border-orange-200',
      boxLabel: 'text-orange-600',
    };
  }
  return {
    isFinal: false,
    backdrop: 'bg-slate-900/60',
    container: 'border border-border bg-white shadow-2xl',
    banner: 'bg-amber-50 text-amber-700 border-b border-amber-200',
    iconWrap: 'bg-amber-50',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-700',
    bannerTitle: 'FIRST WARNING',
    box: 'bg-amber-50 text-amber-900 border-amber-200',
    boxLabel: 'text-amber-600',
  };
}

/**
 * AETHER — professional integrity warning modal (warnings 1–4).
 * Warning 5 never shows this modal: the full-red auto-submit overlay runs instead.
 */
export function IntegrityWarningModal({ event, warningNumber, maximumWarnings, onContinue }: {
  event: IntegrityEventType;
  warningNumber: number;
  maximumWarnings: number;
  onContinue: () => void;
}) {
  // Defensive: a malformed count must never render as "Warning NaN of undefined".
  const max = Number.isFinite(maximumWarnings) && maximumWarnings > 0 ? maximumWarnings : 5;
  const number = Number.isFinite(warningNumber) && warningNumber > 0 ? Math.min(warningNumber, max) : 1;
  const severity = severityFor(number, max);
  const info = EVENT_MESSAGES[event] || {
    title: 'Policy violation recorded',
    description: 'An integrity policy violation was detected and recorded.',
    icon: AlertTriangle,
  };
  const Icon = info.icon;

  return (
    <div className={`fixed inset-0 z-[200] ${severity.backdrop} flex items-center justify-center p-4`} role="alertdialog" aria-modal="true" aria-label="Assessment integrity warning">
      <div className={`w-full max-w-md rounded-2xl overflow-hidden ${severity.container}`}>
        {/* Banner */}
        <div className={`px-6 py-4 flex items-center gap-3 ${severity.banner}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${severity.iconWrap}`}>
            {severity.isFinal
              ? <ShieldAlert className={`w-7 h-7 ${severity.iconColor}`} />
              : <Icon className={`w-6 h-6 ${severity.iconColor}`} />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.2em] uppercase">{severity.bannerTitle}</p>
            <h2 className="text-lg font-extrabold leading-tight truncate">{info.title}</h2>
          </div>
          {/* Progress dots: filled = recorded warnings, pulsing = the next one ends the exam */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0" title={`${number} of ${max} warnings`}>
            {Array.from({ length: max }, (_, i) => (
              <span key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  i < number - 1 ? 'bg-current opacity-70'
                  : i === number - 1 ? 'bg-current'
                  : severity.isFinal ? 'bg-white/40'
                  : i === number ? 'animate-pulse bg-current opacity-60'
                  : 'bg-current opacity-20'
                }`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-700 leading-relaxed">{info.description}</p>

          {/* Warning count box — huge and red on the final warning */}
          <div className={`mt-4 rounded-xl border p-5 text-center ${severity.box}`}>
            <p className={`text-4xl font-black tracking-tight ${severity.isFinal ? 'drop-shadow' : ''}`}>
              WARNING {number} <span className={severity.isFinal ? 'text-red-200' : 'opacity-50'}>/ {max}</span>
            </p>
            <p className={`text-xs font-bold mt-2 ${severity.boxLabel}`}>
              {severity.isFinal
                ? 'ONE MORE VIOLATION ENDS THIS ASSESSMENT'
                : `${max - number} more violation${max - number === 1 ? '' : 's'} until automatic submission`}
            </p>
          </div>

          {/* Rules reminder */}
          <div className="mt-4 rounded-xl bg-slate-50 border border-border p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assessment rules</p>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
              <li>Stay on this page and in fullscreen until submission.</li>
              <li>Do not switch tabs, minimize the window, or open other tools.</li>
              <li>Copying or pasting is disabled and recorded.</li>
              <li>At {max} warnings your assessment is automatically submitted.</li>
            </ul>
          </div>

          <Button onClick={onContinue} autoFocus
            className={`w-full mt-5 py-3 text-sm font-bold ${severity.isFinal ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}>
            {severity.isFinal ? 'I Understand — Return Now' : 'Continue Assessment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
