import { CheckCircle2, Camera, Loader2, Play, X } from 'lucide-react';
import type { CalibrationPhase } from './useEyeTracking';

/**
 * AETHER — pre-interview camera calibration (spec Part H).
 *
 * WHAT THIS IS FOR: "centre of the screen" is not the same place for every
 * camera, chair height and laptop angle. Three seconds of stable data records
 * THIS candidate's neutral head pose and neutral iris position, and every later
 * measurement is a delta from it. Without it the engine refuses to judge gaze at
 * all (see IntegrityRulesEngine: `NO_CALIBRATION`).
 *
 * WHAT THIS IS NOT: an identity profile. The baseline is a handful of numbers
 * held in memory for one interview, is never sent to the server as biometrics,
 * and is discarded and re-measured for every new interview.
 */
export interface CalibrationPanelProps {
  phase: CalibrationPhase;
  progress: number;
  /** True once a usable neutral baseline exists. */
  hasBaseline: boolean;
  /** True while the camera is up and producing frames. */
  cameraReady: boolean;
  onStart: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

export function CalibrationPanel({ phase, progress, hasBaseline, cameraReady, onStart, onCancel, onSkip }: CalibrationPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-slate-800">Camera Calibration</h2>
        {hasBaseline && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> Calibrated
          </span>
        )}
      </div>

      {phase === 'COLLECTING' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Keep your head still and look naturally at the centre of your screen.
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Measuring… {progress}%
            </span>
            <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-600">
            <li>Sit comfortably and keep your face inside the camera frame.</li>
            <li>Look naturally at the centre of your screen.</li>
            <li>Keep your head still for a moment while AETHER measures your neutral position.</li>
          </ol>

          {!cameraReady && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Waiting for the camera feed. Calibration needs a live picture.
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onStart}
              disabled={!cameraReady}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {hasBaseline ? 'Recalibrate' : 'Start Calibration'}
            </button>
            <button onClick={onSkip} className="text-xs font-medium text-slate-500 hover:text-slate-700">
              {hasBaseline ? 'Done' : 'Calibrate later'}
            </button>
          </div>

          {/* Stated plainly, because a candidate is entitled to know exactly what
              the camera is and is not used for. */}
          <p className="text-[11px] leading-relaxed text-slate-400">
            Calibration stores a neutral reference in memory for this interview only. AETHER does not
            create a facial or biometric identity profile, and the reference is discarded when the
            interview ends. Attention monitoring records observable events; it never infers emotion,
            honesty or personality.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Blocking notice when the camera feed stops (spec Part AA).
 *
 * A protected interview cannot proceed without the camera, so this is not a
 * dismissible toast — the candidate must re-enable the feed or end the session.
 */
export function CameraRequiredModal({ onRetry, onEnd, retrying = false }: {
  onRetry: () => void;
  onEnd: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[205] flex items-center justify-center bg-slate-900/70 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
            <Camera className="h-4 w-4 text-red-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Camera Required</h3>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-slate-600">
          Your camera feed has stopped. This interview is monitored, so it cannot continue until the
          camera is available again.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onRetry}
            disabled={retrying}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Re-enable Camera
          </button>
          <button onClick={onEnd} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            End interview
          </button>
        </div>
      </div>
    </div>
  );
}

export default CalibrationPanel;
