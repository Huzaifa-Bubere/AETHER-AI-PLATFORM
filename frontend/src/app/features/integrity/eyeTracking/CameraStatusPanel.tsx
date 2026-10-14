import { Camera, CameraOff, Eye, EyeOff, ScanFace, ShieldCheck, Users, AlertTriangle } from 'lucide-react';
import type { EyeState, GazeDirection, TrackingState } from '../rules/integrityRules';

/**
 * AETHER — compact Assessment Integrity card (spec Part Z).
 *
 * Deliberately NOT a telemetry dump: no raw x/y, no landmark ids, no confidence
 * decimals in production. It answers four questions a candidate can act on —
 * is my face visible, are my eyes open, where is my attention, is my camera on —
 * and states every one of them IN WORDS as well as in colour.
 */

type Tone = 'green' | 'amber' | 'orange' | 'red';

const TONE_CLASSES: Record<Tone, string> = {
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
};

const DOT_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

function Row({ label, value, tone, Icon }: { label: string; value: string; tone: Tone; Icon: typeof Eye }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2 text-slate-500">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      <span className={`flex items-center gap-1.5 font-semibold ${TONE_CLASSES[tone]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}

export interface CameraStatusPanelProps {
  cameraActive: boolean;
  facePresent: boolean;
  faceCount: number;
  eyeState: EyeState;
  trackingState: TrackingState;
  gaze: GazeDirection;
  warningCount: number;
  maximumWarnings: number;
  /** Set when MediaPipe itself failed — monitoring is degraded, not judging. */
  trackingError?: string | null;
}

export function CameraStatusPanel({
  cameraActive,
  facePresent,
  faceCount,
  eyeState,
  trackingState,
  gaze,
  warningCount,
  maximumWarnings,
  trackingError,
}: CameraStatusPanelProps) {
  const faceValue = !facePresent
    ? trackingState === 'CAMERA_LOST' ? 'Camera stopped' : 'Not visible'
    : faceCount > 1 ? `Multiple people (${faceCount})` : 'Detected';
  const faceTone: Tone = !facePresent ? (trackingState === 'CAMERA_LOST' ? 'red' : 'orange') : faceCount > 1 ? 'red' : 'green';

  const eyeValue =
    eyeState === 'EYES_OPEN' ? 'Open'
    : eyeState === 'EYES_CLOSED' ? 'Closed'
    : eyeState === 'BLINKING' ? 'Blinking'
    : eyeState === 'ONE_EYE_CLOSED' ? 'One eye unclear'
    : 'Not measurable';
  const eyeTone: Tone = eyeState === 'EYES_OPEN' ? 'green' : eyeState === 'EYES_CLOSED' ? 'red' : eyeState === 'BLINKING' ? 'green' : eyeState === 'ONE_EYE_CLOSED' ? 'amber' : 'amber';

  const attentionValue =
    trackingState === 'HEAD_AWAY' ? 'Head turned away'
    : trackingState === 'GAZE_AWAY' ? 'Looking away'
    : trackingState === 'TRACKING_UNCERTAIN' ? 'Not measurable'
    : gaze === 'CENTER' ? 'Centered'
    : 'Centered';
  const attentionTone: Tone =
    trackingState === 'HEAD_AWAY' || trackingState === 'GAZE_AWAY' ? 'orange'
    : trackingState === 'TRACKING_UNCERTAIN' ? 'amber'
    : 'green';

  const warningTone: Tone =
    warningCount >= maximumWarnings ? 'red'
    : warningCount === maximumWarnings - 1 ? 'orange'
    : warningCount > 0 ? 'amber'
    : 'green';

  return (
    <div className="rounded-2xl bg-white border border-border p-4 space-y-2.5">
      <div className="flex items-center gap-2 pb-1">
        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assessment Integrity</span>
      </div>

      <Row label="Camera" value={cameraActive ? 'Active' : 'Off'} tone={cameraActive ? 'green' : 'red'} Icon={cameraActive ? Camera : CameraOff} />
      <Row label="Face" value={faceValue} tone={faceTone} Icon={faceCount > 1 ? Users : ScanFace} />
      <Row label="Eyes" value={eyeValue} tone={eyeTone} Icon={eyeState === 'EYES_CLOSED' ? EyeOff : Eye} />
      <Row label="Attention" value={attentionValue} tone={attentionTone} Icon={Eye} />
      <Row label="Warnings" value={`${warningCount} / ${maximumWarnings}`} tone={warningTone} Icon={ShieldCheck} />

      {/* Degraded monitoring is disclosed rather than silently ignored: a
          candidate should never wonder why a signal stopped updating. */}
      {trackingError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{trackingError}</span>
        </div>
      )}
    </div>
  );
}

export default CameraStatusPanel;
