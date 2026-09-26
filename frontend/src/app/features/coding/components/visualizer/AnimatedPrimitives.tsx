/**
 * AETHER Coding — Animated primitives (light theme).
 *
 * Reusable motion components shared by every visualization mode. Colors follow
 * the AETHER professional light palette; only ACTIVE elements receive strong
 * accents — default cells stay neutral white cards.
 */

import { memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CellState, Verdict, VizExpression, VizPointer } from './story.types';

export const REDUCED_MOTION_SUPPORTED = true;

// ── Cell state → style ──────────────────────────────────────────────────────

export const CELL_STATE_STYLE: Record<CellState, { ring: string; bg: string; text: string; label?: string }> = {
  default:   { ring: 'border-slate-200',        bg: 'bg-white',                 text: 'text-slate-800' },
  active:    { ring: 'border-blue-600',         bg: 'bg-blue-600',              text: 'text-white' },
  comparing: { ring: 'border-amber-500',        bg: 'bg-amber-400',             text: 'text-slate-900' },
  matched:   { ring: 'border-emerald-600',      bg: 'bg-emerald-600',           text: 'text-white' },
  visited:   { ring: 'border-slate-300',        bg: 'bg-slate-100',             text: 'text-slate-500' },
  discarded: { ring: 'border-slate-200',        bg: 'bg-slate-100/60',          text: 'text-slate-400' },
  updated:   { ring: 'border-indigo-500',       bg: 'bg-indigo-50',             text: 'text-indigo-700' },
  queued:    { ring: 'border-amber-300',        bg: 'bg-amber-50',              text: 'text-amber-700' },
};

// ── AnimatedArrayCell ───────────────────────────────────────────────────────

interface CellProps {
  value: string;
  index: number;
  state: CellState;
  showIndex?: boolean;
  dimmed?: boolean;
}

export const AnimatedArrayCell = memo(function AnimatedArrayCell({
  value, index, state, showIndex = true, dimmed = false,
}: CellProps) {
  const reduce = useReducedMotion();
  const style = CELL_STATE_STYLE[state];
  const isActive = state === 'active' || state === 'comparing' || state === 'matched' || state === 'updated';

  return (
    <div className="flex flex-col items-center shrink-0" aria-label={`index ${index}: ${value}${state !== 'default' ? `, ${state}` : ''}`}>
      <motion.div
        layout={!reduce}
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{
          scale: isActive ? 1.06 : 1,
          opacity: dimmed ? 0.45 : 1,
        }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-mono text-sm font-bold shadow-xs transition-colors duration-300 ${style.ring} ${style.bg} ${style.text} ${state === 'matched' ? 'ring-4 ring-emerald-200' : ''} ${state === 'comparing' ? 'ring-4 ring-amber-100' : ''} ${state === 'active' ? 'ring-4 ring-blue-100' : ''}`}
      >
        {value}
      </motion.div>
      {showIndex && (
        <span className={`text-[10px] font-mono mt-1 ${state === 'default' ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>
          {index}
        </span>
      )}
    </div>
  );
});

// ── AnimatedPointer ─────────────────────────────────────────────────────────

const POINTER_TONE: Record<VizPointer['tone'], { text: string; arrow: string; chip: string }> = {
  primary: { text: 'text-blue-700',    arrow: 'text-blue-600',    chip: 'bg-blue-600' },
  indigo:  { text: 'text-indigo-700',  arrow: 'text-indigo-600',  chip: 'bg-indigo-600' },
  success: { text: 'text-emerald-700', arrow: 'text-emerald-600', chip: 'bg-emerald-600' },
  warning: { text: 'text-amber-700',   arrow: 'text-amber-600',   chip: 'bg-amber-500' },
  rose:    { text: 'text-rose-700',    arrow: 'text-rose-600',    chip: 'bg-rose-600' },
};

interface PointerProps {
  pointer: VizPointer;
  cellWidth: number;
}

/** A labelled pointer that slides between cells with a spring.
 *  Positioned inside an `inset-x-0` strip above/below the cell row; the row
 *  starts at the strip's left edge, so x = index * (cellWidth + gap).
 */
export function AnimatedPointer({ pointer, cellWidth }: PointerProps) {
  const reduce = useReducedMotion();
  const tone = POINTER_TONE[pointer.tone];
  const isBottom = pointer.side === 'bottom';

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: isBottom ? 6 : -6 }}
      animate={{ opacity: 1, y: 0, x: pointer.index * (cellWidth + 6) }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={`absolute flex flex-col items-center ${isBottom ? 'bottom-0 translate-y-full' : 'top-0 -translate-y-full'}`}
      style={{ left: 0 }}
    >
      <span className={`text-[10px] font-bold font-mono ${tone.text} px-1.5 py-0.5 rounded-md bg-white border shadow-xs`}>
        {pointer.label}
      </span>
      <span className={`text-xs leading-none ${tone.arrow} ${isBottom ? 'rotate-180' : ''}`}>▲</span>
    </motion.div>
  );
}

// ── AnimatedExpression ──────────────────────────────────────────────────────

const VERDICT_STYLE: Record<Verdict, string> = {
  true: 'text-emerald-600',
  false: 'text-rose-500',
  match: 'text-emerald-600',
  mismatch: 'text-amber-600',
  neutral: 'text-slate-400',
};

interface ExpressionProps {
  expression: VizExpression | null;
}

/**
 * The large central calculation: operand → operator → operand → result,
 * each entering with a small staged fade/slide. No raw JSON anywhere.
 */
export function AnimatedExpression({ expression }: ExpressionProps) {
  const reduce = useReducedMotion();

  if (!expression) {
    // Compact placeholder keeps layout stable without a large empty gap.
    return <div className="h-2" aria-hidden />;
  }

  const enter = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15, delay } }
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, delay } };

  const hasResult = expression.result !== undefined;
  const showVerdict = expression.verdict && expression.verdict !== 'neutral';

  return (
    <div className="min-h-14 flex items-center justify-center gap-3 font-mono select-none" role="math" aria-label={expressionToString(expression)}>
      <motion.span key={`l-${expression.left}`} {...enter(0)}
        className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
        {expression.left}
      </motion.span>
      <motion.span key={`o-${expression.op}`} {...enter(0.12)}
        className="text-2xl md:text-3xl text-slate-400 font-medium">
        {expression.op}
      </motion.span>
      {expression.right !== undefined && (
        <motion.span key={`r-${expression.right}`} {...enter(0.22)}
          className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
          {expression.right}
        </motion.span>
      )}
      <AnimatePresence mode="wait">
        {hasResult && (
          <motion.span
            key={`res-${expression.left}-${expression.op}-${expression.right}-${expression.result}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.34 }}
            className={`text-3xl md:text-4xl font-black tracking-tight ${
              expression.verdict === 'match' ? 'text-emerald-600'
              : expression.verdict === 'mismatch' ? 'text-amber-600'
              : expression.verdict === 'false' ? 'text-rose-500'
              : expression.verdict === 'true' ? 'text-emerald-600'
              : 'text-blue-700'
            }`}
          >
            {expression.result}
          </motion.span>
        )}
      </AnimatePresence>
      {showVerdict && (
        <motion.span
          key={`v-${expression.verdictText}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.48 }}
          className={`ml-2 px-3 py-1 rounded-lg text-xs font-bold border tracking-wide whitespace-nowrap ${verdictChipStyle(expression.verdict!)}`}
        >
          {expression.verdictText}
        </motion.span>
      )}
    </div>
  );
}

export function expressionToString(e: VizExpression): string {
  let s = e.left;
  if (e.op) s += ` ${e.op}`;
  if (e.right !== undefined) s += ` ${e.right}`;
  if (e.result !== undefined) s += ` = ${e.result}`;
  if (e.verdictText) s += ` — ${e.verdictText}`;
  return s;
}

function verdictChipStyle(verdict: Verdict): string {
  switch (verdict) {
    case 'match': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'true': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'false': return 'bg-rose-50 text-rose-600 border-rose-200';
    case 'mismatch': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-50 text-slate-500 border-slate-200';
  }
}

// ── OperationCounter ────────────────────────────────────────────────────────

interface CounterProps {
  value: number;
  label: string;
  secondary?: Array<{ label: string; value: number }>;
}

/** Live contextual metric, e.g. "14 COMPARISONS • BRUTE FORCE". */
export function OperationCounter({ value, label, secondary }: CounterProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <div className="flex items-baseline gap-1.5 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-xs">
        <motion.span
          key={value}
          initial={reduce ? false : { scale: 1.25, color: '#2563EB' }}
          animate={{ scale: 1, color: '#0F172A' }}
          transition={{ duration: 0.3 }}
          className="font-mono text-sm font-black"
        >
          {value}
        </motion.span>
        <span className="text-xs font-bold tracking-wide text-slate-500">{label}</span>
      </div>
      {(secondary || []).filter(s => s.value > 0).map(s => (
        <div key={s.label} className="flex items-baseline gap-1 text-xs text-slate-400 font-mono">
          <span className="font-bold text-slate-600">{s.value}</span> {s.label}
        </div>
      ))}
    </div>
  );
}

// ── StepExplanation ─────────────────────────────────────────────────────────

export function StepExplanation({ text, approach }: { text: string; approach: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="text-sm text-slate-500 text-center max-w-xl mx-auto"
      >
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">{approach}</span>
        {text}
      </motion.p>
    </AnimatePresence>
  );
}

// ── Sliding window overlay ──────────────────────────────────────────────────

/**
 * Sliding-window span. Rendered INSIDE the start cell's relative wrapper, so
 * it only animates width — the parent already sits at the correct offset.
 */
export function WindowOverlay({ end, start, cellWidth }: { start: number; end: number; cellWidth: number }) {
  const reduce = useReducedMotion();
  const width = (end - start + 1) * (cellWidth + 6) - 6;
  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1, width }}
      transition={{ type: 'spring', stiffness: 200, damping: 26 }}
      className="absolute -inset-y-2 left-0 rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50/40 pointer-events-none"
    />
  );
}

// ── MATCH FOUND banner ──────────────────────────────────────────────────────

export function MatchBanner({ title, tone, detail }: { title: string; tone: 'success' | 'error'; detail?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        role="status"
        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border shadow-xs ${
          tone === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
            : 'bg-rose-50 text-rose-700 border-rose-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${tone === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        {title}
        {detail && <span className="font-mono text-xs font-semibold opacity-80">{detail}</span>}
      </motion.div>
    </AnimatePresence>
  );
}
