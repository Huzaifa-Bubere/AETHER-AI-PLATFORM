/**
 * AETHER Coding — Code panel, playback controls and execution summary.
 *
 * ExecutionCodePanel shows the candidate's real source with the currently
 * executing line highlighted (colored left indicator, tinted background,
 * execution arrow) and smooth movement as the line changes.
 */

import { memo, useMemo, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, Crosshair,
} from 'lucide-react';
import type { Story, VizStep } from './story.types';

// ── ExecutionCodePanel (§11) ────────────────────────────────────────────────

export const ExecutionCodePanel = memo(function ExecutionCodePanel({
  sourceCode,
  step,
  onViewInEditor,
  errorLine,
}: {
  sourceCode: string;
  step: VizStep | undefined;
  onViewInEditor: (line: number) => void;
  errorLine?: number | null;
}) {
  const reduce = useReducedMotion();
  const lines = useMemo(() => sourceCode.split('\n'), [sourceCode]);
  const activeLine = errorLine || step?.line || 0;
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the active line visible
  useEffect(() => {
    const el = containerRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeLine, reduce]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Source</span>
        {activeLine > 0 && (
          <button
            onClick={() => onViewInEditor(activeLine)}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 transition-colors"
            title="Highlight this line in the Monaco editor"
          >
            <Crosshair className="w-3 h-3" /> View in Editor
          </button>
        )}
      </div>
      <div ref={containerRef} className="overflow-auto max-h-56 font-mono text-[11.5px] leading-5">
        {lines.map((line, i) => {
          const n = i + 1;
          const isActive = n === activeLine;
          return (
            <div
              key={n}
              data-active={isActive || undefined}
              className={`relative flex ${isActive ? '' : 'hover:bg-slate-50'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="code-line-cursor"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute inset-y-0 left-0 right-0 bg-blue-50 border-l-[3px] border-blue-600"
                />
              )}
              <span className={`relative w-8 shrink-0 text-right pr-2 select-none ${isActive ? 'text-blue-700 font-bold' : 'text-slate-300'}`}>
                {n}
              </span>
              <span className={`relative whitespace-pre pr-4 ${isActive ? 'text-blue-900 font-semibold' : 'text-slate-700'}`}>
                {line || ' '}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── PlaybackControls (§28) ──────────────────────────────────────────────────

const SPEEDS = [0.5, 1, 1.5, 2] as const;

export function PlaybackControls({
  stepIndex,
  totalSteps,
  playing,
  speed,
  onSeek,
  onStep,
  onTogglePlay,
  onSpeed,
  disabled,
}: {
  stepIndex: number;
  totalSteps: number;
  playing: boolean;
  speed: number;
  onSeek: (n: number) => void;
  onStep: (delta: number) => void;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
  disabled?: boolean;
}) {
  const progress = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;
  const btn = 'p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3 shadow-xs">
      <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 font-mono whitespace-nowrap">
        Step {stepIndex + 1} / {totalSteps}
      </span>

      <div className="flex items-center gap-1">
        <button className={btn} onClick={() => onSeek(0)} disabled={disabled} aria-label="Restart" title="Restart (|◀)">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button className={btn} onClick={() => onStep(-1)} disabled={disabled || stepIndex === 0} aria-label="Previous step" title="Previous (◀)">
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-40 transition-colors"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <button className={btn} onClick={() => onStep(1)} disabled={disabled || stepIndex >= totalSteps - 1} aria-label="Next step" title="Next (▶)">
          <SkipForward className="w-4 h-4" />
        </button>
        <button className={btn} onClick={() => onSeek(totalSteps - 1)} disabled={disabled} aria-label="Jump to end" title="End (▶|)">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Speed</span>
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => onSpeed(s)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
              speed === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-pressed={speed === s}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-[140px] flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          value={stepIndex}
          onChange={e => onSeek(Number(e.target.value))}
          className="w-full accent-blue-600 cursor-pointer"
          aria-label="Timeline scrubber"
          style={{ background: `linear-gradient(to right, #2563EB ${progress}%, #E2E8F0 ${progress}%)` }}
        />
      </div>
    </div>
  );
}

// ── ExecutionSummary (§31/§32) ──────────────────────────────────────────────

export function ExecutionSummary({
  story,
  finalStep,
  complexity,
  problemTitle,
}: {
  story: Story;
  finalStep: VizStep;
  complexity?: { estimatedTime?: string; estimatedSpace?: string; evidence?: string[] } | null;
  problemTitle?: string;
}) {
  const counterLabel = story.counterLabelSingular;
  const ops = finalStep.counters[story.counterKey] ?? 0;
  const primary = finalStep.counters[story.counterKey];
  const secondaryEntries = Object.entries(finalStep.counters).filter(([k]) => k !== story.counterKey);

  const result = finalStep.output?.trim() || undefined;
  const matched = finalStep.matched;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg">✓</span>
        <div>
          <h3 className="font-bold text-slate-900">EXECUTION COMPLETE</h3>
          {problemTitle && <p className="text-xs text-slate-500">{problemTitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Approach</p>
          <p className="text-sm font-bold text-slate-800">{story.approachLabel}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Operations</p>
          <p className="text-sm font-bold text-slate-800">
            {ops} {ops === 1 ? counterLabel.toLowerCase() : `${counterLabel.toLowerCase()}s`}
            {secondaryEntries.length > 0 && (
              <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                {secondaryEntries.map(([k, v]) => `${v} ${k}`).join(' · ')}
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Result</p>
          <p className="text-sm font-bold font-mono text-slate-800 break-all">
            {matched ? `indices [${matched.join(', ')}]` : result || '—'}
          </p>
        </div>
      </div>

      {(complexity?.estimatedTime || complexity?.estimatedSpace) && (
        <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold">Estimated Complexity</p>
            <span className="text-[9px] text-blue-400 font-medium">from static AST analysis — {primary ?? 0} measured {story.counterKey}</span>
          </div>
          <div className="flex gap-6 font-mono text-sm font-bold text-blue-900">
            <span>Time <span className="text-blue-700">{complexity?.estimatedTime || '—'}</span></span>
            <span>Space <span className="text-blue-700">{complexity?.estimatedSpace || '—'}</span></span>
          </div>
          {complexity?.evidence && complexity.evidence.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {complexity.evidence.slice(0, 3).map((ev, i) => (
                <li key={i} className="text-[10px] text-blue-700/80 flex gap-1.5">
                  <span className="text-blue-300 mt-0.5">•</span>{ev}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && matched && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Program output</p>
          <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
}
