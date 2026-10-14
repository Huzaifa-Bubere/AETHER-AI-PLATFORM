import { ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import type { IntegrityEventType, IntegritySummary } from './integrity.types';

/**
 * AETHER — Interview Integrity report tab (spec Part AE).
 *
 * PRESENTATION RULES, enforced here rather than left to each call site:
 *   1. These are OBSERVABLE EVENTS, never conclusions. The header says
 *      "observations" and the footer says so in plain language.
 *   2. Every counted observation is shown as a row, including the zeroes, so
 *      "no prolonged eye closure" is visible evidence rather than an absence.
 *   3. The timeline shows the measured DURATION of each sustained incident, so
 *      "5.1 s of sustained attention deviation" is distinguishable from a note
 *      that something happened.
 */

/** Candidate-facing labels for the events this tab reports. */
const ROW_LABELS: Array<{ key: keyof NonNullable<IntegritySummary['observed']>; label: string; types: IntegrityEventType[] }> = [
  { key: 'faceNotVisible', label: 'Face not visible', types: ['FACE_NOT_VISIBLE'] },
  { key: 'multipleFaces', label: 'Multiple faces', types: ['MULTIPLE_FACES'] },
  { key: 'attentionDeviations', label: 'Prolonged gaze / head deviation', types: ['GAZE_AWAY', 'HEAD_AWAY'] },
  { key: 'eyeClosures', label: 'Prolonged eye closure', types: ['EYES_CLOSED_LONG'] },
  { key: 'tabSwitches', label: 'Tab switches', types: ['TAB_SWITCH'] },
  { key: 'cameraInterruptions', label: 'Camera interruptions', types: ['CAMERA_DISABLED', 'CAMERA_PERMISSION_REVOKED', 'MEDIA_TRACK_ENDED'] },
];

/** Timeline copy — descriptive of the observation, never accusatory. */
const EVENT_LABELS: Partial<Record<IntegrityEventType, string>> = {
  FACE_NOT_VISIBLE: 'Face was not visible',
  MULTIPLE_FACES: 'More than one person visible',
  GAZE_AWAY: 'Prolonged attention deviation',
  HEAD_AWAY: 'Head turned away from the screen',
  EYES_CLOSED_LONG: 'Eyes remained closed',
  TAB_SWITCH: 'Left the interview tab',
  WINDOW_BLUR: 'Interview window lost focus',
  FULLSCREEN_EXIT: 'Left fullscreen',
  CAMERA_DISABLED: 'Camera was disabled',
  CAMERA_PERMISSION_REVOKED: 'Camera permission was revoked',
  MEDIA_TRACK_ENDED: 'Camera feed stopped',
  COPY_ATTEMPT: 'Copy attempt blocked',
  PASTE_ATTEMPT: 'Paste attempt blocked',
  CONTEXT_MENU: 'Context menu blocked',
  MICROPHONE_DISABLED: 'Microphone was disabled',
  PAGE_RELOAD_ATTEMPT: 'Page reload attempted',
};

function humanise(type: IntegrityEventType): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return `${(ms / 1000).toFixed(1)} s`;
}

export interface IntegrityReportSectionProps {
  summary: IntegritySummary | null;
  /** Legacy score from the AI report body, used only when no event log exists. */
  legacyScore: number;
  legacyNote: string;
  /** True when the interview was ended by reaching the warning limit. */
  terminated: boolean;
}

export function IntegrityReportSection({ summary, legacyScore, legacyNote, terminated }: IntegrityReportSectionProps) {
  const maximumWarnings = summary?.maximumWarnings ?? 5;
  const warningCount = summary?.warningCount ?? 0;
  const observationCount = summary?.observationCount ?? 0;

  // Counts come from the backend's grouped summary when present; otherwise they
  // are derived from the event rows, so the tab is never blank when events exist.
  const grouped = summary?.observed;
  const countFor = (types: IntegrityEventType[], key: keyof NonNullable<IntegritySummary['observed']>): number => {
    if (grouped) return grouped[key] ?? 0;
    return (summary?.events ?? []).filter(e => types.includes(e.type)).length;
  };

  const hasEvents = (summary?.events?.length ?? 0) > 0;
  const statusLabel = terminated
    ? 'Automatically submitted — warning limit reached'
    : hasEvents || observationCount > 0
      ? 'Completed with observations'
      : 'Completed — no observations recorded';

  const headline = terminated
    ? { color: '#DC2626', icon: ShieldAlert }
    : hasEvents
      ? { color: '#D97706', icon: ShieldAlert }
      : { color: '#16A34A', icon: ShieldCheck };
  const Headline = headline.icon;

  if (!summary) {
    // No event log at all (older session). Say exactly that instead of implying
    // a clean result that was never measured.
    return (
      <div id="report-integrity" className="scroll-mt-24 rounded-2xl bg-white border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck style={{ width: 15, height: 15, color: '#64748B' }} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Interview integrity</h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-2">{legacyNote}</p>
        <p className="text-xs text-slate-500">
          Legacy integrity score: {legacyScore}/100. Detailed event monitoring was not recorded for this session.
        </p>
        <Disclaimer />
      </div>
    );
  }

  return (
    <div id="report-integrity" className="scroll-mt-24 rounded-2xl bg-white border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Headline style={{ width: 15, height: 15, color: headline.color }} />
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: headline.color }}>Interview integrity</h3>
      </div>

      {/* Status + warning budget */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">{statusLabel}</p>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Warnings</p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5 tabular-nums">
            {warningCount} / {maximumWarnings}
            {observationCount > 0 && (
              <span className="ml-2 text-xs font-medium text-slate-500">
                · {observationCount} observation{observationCount === 1 ? '' : 's'} (not counted)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Grouped observations — zeroes included on purpose */}
      <div className="rounded-xl border border-border overflow-hidden mb-4">
        {ROW_LABELS.map((row, i) => {
          const count = countFor(row.types, row.key);
          return (
            <div key={row.key} className={`flex items-center justify-between px-4 py-2.5 text-xs ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
              <span className="text-slate-600">{row.label}</span>
              <span className={`tabular-nums font-bold ${count > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Timeline with measured durations */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Timeline</p>
      {hasEvents ? (
        <div className="rounded-xl border border-border overflow-hidden mb-4">
          {summary.events.map((event, i) => {
            const duration = formatDuration(event.durationMs ?? 0);
            return (
              <div key={i} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-400">
                  <Clock className="h-3 w-3" />
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-semibold text-slate-700">{humanise(event.type)}</span>
                {duration && <span className="text-slate-500">Duration: {duration}</span>}
                <span className="ml-auto text-slate-400">
                  {event.warningNumber >= 1 ? `Warning ${event.warningNumber}` : 'Observation'}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-emerald-700 mb-4">No integrity events were recorded during this interview.</p>
      )}

      <Disclaimer />
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="rounded-xl bg-slate-50 border border-border px-4 py-3 text-[11px] leading-relaxed text-slate-500">
      <strong className="font-semibold text-slate-600">These events represent observable assessment behaviour.</strong>{' '}
      They are not proof of misconduct. AETHER records what the camera observed — it does not infer intent,
      emotion or honesty, and no integrity observation is subtracted from your technical, communication or
      answer-quality scores.
    </p>
  );
}

export default IntegrityReportSection;
