/**
 * AETHER Coding — Structure visualizers (light theme).
 *
 * Graphical memory/structure views used beside or below the primary array:
 * SeenMemoryStrip, StackVisualizer, QueueVisualizer, MatrixVisualizer,
 * LinkedListVisualizer, GraphVisualizer, RecursionVisualizer,
 * CallStackVisualizer and the VariablesDrawer (§33).
 */

import { memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CellState, VizStep } from './story.types';
import { CELL_STATE_STYLE } from './AnimatedPrimitives';

// ── SeenMemoryStrip (§14/§15) ───────────────────────────────────────────────

export const SeenMemoryStrip = memo(function SeenMemoryStrip({
  memory,
}: {
  memory: NonNullable<VizStep['memory']>;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{memory.label} memory</span>
        <span className="text-[10px] font-mono text-slate-400">{memory.entries.length} stored</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {memory.entries.map((entry, i) => {
            const isHit = entry.highlight === 'hit';
            const isStored = entry.highlight === 'stored';
            return (
              <motion.div
                key={`${entry.key}-${i}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.6, y: -8 }}
                animate={{
                  opacity: 1, scale: 1, y: 0,
                  ...(isHit ? { scale: [1, 1.18, 1] } : {}),
                }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22, duration: isHit ? 0.45 : undefined }}
                className={`min-w-11 px-2 py-1.5 rounded-lg border-2 text-center font-mono text-xs font-bold shadow-xs ${
                  isHit
                    ? 'border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-200'
                    : isStored
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700'
                }`}
                title={entry.value !== entry.key ? `${entry.key} → ${entry.value}` : entry.key}
              >
                <span className="block">{entry.key}</span>
                {entry.value !== entry.key && (
                  <span className="block text-[9px] font-semibold opacity-70">{entry.value}</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {memory.entries.length === 0 && (
          <span className="text-xs text-slate-400 italic">(empty)</span>
        )}
      </div>
    </div>
  );
});

// ── StackVisualizer (§21) ───────────────────────────────────────────────────

export const StackVisualizer = memo(function StackVisualizer({
  stack,
}: {
  stack: NonNullable<VizStep['stack']>;
}) {
  const reduce = useReducedMotion();
  const reversed = [...stack.items].reverse(); // top first
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Stack</span>
        {stack.op && (
          <motion.span
            key={stack.op + stack.items.length}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              stack.op === 'push' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {stack.op}
          </motion.span>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center pt-5">
          <span className="text-[10px] font-bold text-slate-500">TOP</span>
          <span className="text-amber-600 leading-none">▼</span>
        </div>
        <div className="flex flex-col gap-1 w-32">
          <AnimatePresence initial={false}>
            {reversed.map((item, i) => {
              const isTop = i === 0;
              const st = CELL_STATE_STYLE[item.state === 'default' && isTop ? 'active' : item.state];
              return (
                <motion.div
                  key={`${item.value}-${i}`}
                  layout={!reduce}
                  initial={reduce ? false : stack.op === 'push' && isTop
                    ? { opacity: 0, y: -22, scale: 0.85 }
                    : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className={`h-8 rounded-lg border-2 flex items-center justify-center font-mono text-xs font-bold shadow-xs ${st.ring} ${st.bg} ${st.text}`}
                >
                  {item.value}
                </motion.div>
                );
            })}
          </AnimatePresence>
          {stack.items.length === 0 && (
            <div className="h-8 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 italic">
              empty
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ── QueueVisualizer (§22) ───────────────────────────────────────────────────

export const QueueVisualizer = memo(function QueueVisualizer({
  queue,
}: {
  queue: NonNullable<VizStep['queue']>;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Queue</span>
        {queue.op && (
          <motion.span
            key={queue.op + queue.items.length}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              queue.op === 'enqueue' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {queue.op}
          </motion.span>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        <span className="text-[10px] font-bold text-slate-500 shrink-0 mr-1">FRONT</span>
        <AnimatePresence initial={false}>
          {queue.items.map((item, i) => (
            <motion.div
              key={`${item.value}-${i}`}
              layout={!reduce}
              initial={reduce ? false : queue.op === 'enqueue' && i === queue.items.length - 1
                ? { opacity: 0, x: 24, scale: 0.85 }
                : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`min-w-10 h-9 px-2 rounded-lg border-2 flex items-center justify-center font-mono text-xs font-bold shadow-xs ${
                item.state === 'active'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              {item.value}
            </motion.div>
          ))}
        </AnimatePresence>
        {queue.items.length === 0 && (
          <span className="text-[10px] text-slate-400 italic">empty</span>
        )}
        <span className="text-[10px] font-bold text-slate-500 shrink-0 ml-1">REAR</span>
      </div>
    </div>
  );
});

// ── MatrixVisualizer (§24) — grid + animated cell write 3→7 ────────────────

export const MatrixVisualizer = memo(function MatrixVisualizer({
  matrix,
}: {
  matrix: NonNullable<VizStep['matrix']>;
}) {
  const reduce = useReducedMotion();
  const { rows, active, write } = matrix;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono">{matrix.name}</span>
        <span className="text-[10px] font-mono text-slate-400">{rows.length}×{rows[0]?.length || 0}</span>
      </div>
      <table className="border-separate border-spacing-0.5 font-mono text-xs">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <td className="pr-1.5 text-[10px] text-slate-400 text-right">{r}</td>
              {row.map((cell, c) => {
                const isActive = active && active[0] === r && active[1] === c;
                const isWrite = write && write.at[0] === r && write.at[1] === c;
                const st = CELL_STATE_STYLE[isWrite ? 'updated' : isActive ? 'active' : 'default'];
                return (
                  <td key={c}>
                    <motion.div
                      layout={!reduce}
                      animate={
                        isWrite && !reduce
                          ? { backgroundColor: ['#FEF3C7', '#EEF2FF', '#EEF2FF'] }
                          : {}
                      }
                      transition={{ duration: 0.5 }}
                      className={`w-10 h-8 rounded-lg border-2 flex items-center justify-center font-bold ${st.ring} ${st.bg} ${st.text}`}
                    >
                      {isWrite ? (
                        <motion.span
                          key={`${cell}-w`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="relative"
                        >
                          <span className="opacity-50 line-through absolute inset-0 flex items-center justify-center text-[10px]">{write.from}</span>
                          <span>{cell}</span>
                        </motion.span>
                      ) : cell}
                    </motion.div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ── LinkedListVisualizer (§23) ──────────────────────────────────────────────

export const LinkedListVisualizer = memo(function LinkedListVisualizer({
  linkedList,
}: {
  linkedList: NonNullable<VizStep['linkedList']>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase block mb-2">Linked list</span>
      <div className="flex items-center gap-1.5">
        {linkedList.nodes.map((node, i) => {
          const st = CELL_STATE_STYLE[node.state];
          return (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <motion.div
                layout
                initial={false}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-mono text-sm font-bold shadow-xs ${st.ring} ${st.bg} ${st.text}`}
              >
                {node.value}
              </motion.div>
              <span className="text-slate-300 font-mono">→</span>
            </div>
          );
        })}
        <span className="text-slate-400 font-mono text-xs">null</span>
      </div>
    </div>
  );
});

// ── GraphVisualizer (§25) — adjacency cards + queue/visited sync ───────────

export const GraphVisualizer = memo(function GraphVisualizer({
  graph,
}: {
  graph: NonNullable<VizStep['graph']>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase block mb-2">Graph traversal</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {graph.nodes.map(node => {
          const st = CELL_STATE_STYLE[node.state];
          const label = node.state === 'active' ? 'current'
            : node.state === 'visited' ? 'visited'
            : node.state === 'queued' ? 'queued' : '';
          return (
            <motion.div
              layout
              key={node.id}
              className={`p-2 rounded-lg border-2 font-mono text-xs ${st.ring} ${st.bg} ${st.text}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{node.id}</span>
                {label && <span className="text-[9px] font-bold uppercase opacity-80">{label}</span>}
              </div>
              <div className="text-[10px] opacity-60 mt-0.5">→ {node.neighbors.join(', ') || '∅'}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

// ── RecursionVisualizer (§26) + CallStackVisualizer (§27) ──────────────────

export function RecursionVisualizer({ step }: { step: VizStep }) {
  const reduce = useReducedMotion();
  const frames = step.recursion?.frames;
  if (!frames || frames.length === 0) return null;
  const deepest = frames[frames.length - 1];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Call tree</span>
        <span className="text-[10px] font-mono text-slate-400">depth {frames.length}</span>
      </div>
      <div className="space-y-1.5 max-w-xs">
        {frames.map((f, i) => {
          const isTop = i === frames.length - 1;
          const st = CELL_STATE_STYLE[isTop ? (deepest.returnValue ? 'matched' : 'active') : 'visited'];
          return (
            <motion.div
              key={`${f.label}-${i}`}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              style={{ marginLeft: f.depth * 16 }}
              className={`px-3 py-1.5 rounded-lg border-2 font-mono text-xs flex items-center justify-between ${st.ring} ${st.bg} ${st.text}`}
            >
              <span className="font-bold">{f.label}()</span>
              {f.returnValue !== undefined && (
                <motion.span
                  key={f.returnValue}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-bold"
                >
                  = {f.returnValue}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function CallStackVisualizer({ step }: { step: VizStep }) {
  const reduce = useReducedMotion();
  const stack = step.callStack;
  if (!stack || stack.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Call stack</span>
        <span className="text-[10px] font-mono text-slate-400">depth {stack.length}</span>
      </div>
      <div className="space-y-1">
        {stack.map((frame, i) => {
          const isTop = i === stack.length - 1;
          return (
            <motion.div
              key={`${frame}-${i}`}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: isTop ? -8 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              style={{ marginLeft: i * 10 }}
              className={`px-2.5 py-1 rounded-lg border font-mono text-xs flex items-center justify-between ${
                isTop
                  ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>{frame}</span>
              {isTop && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">ACTIVE</span>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── VariablesDrawer (§33) — value history side drawer ──────────────────────

export function VariablesDrawer({
  open,
  onClose,
  history,
}: {
  open: boolean;
  onClose: () => void;
  history: Array<{ name: string; values: string[] }>;
}) {
  const reduce = useReducedMotion();
  if (!open) return null;
  return (
    <motion.aside
      initial={reduce ? false : { x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute right-0 top-0 bottom-0 w-72 bg-white border-l border-slate-200 shadow-xl z-10 flex flex-col"
      role="complementary"
      aria-label="Variable history"
    >
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Variable history</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs font-semibold" aria-label="Close variable history">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {history.map(({ name, values }) => (
          <div key={name} className="rounded-lg border border-slate-200 p-2.5">
            <p className="font-mono text-xs font-bold text-slate-700 mb-1">{name}</p>
            <div className="flex flex-wrap gap-1">
              {values.map((v, i) => (
                <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {i > 0 && <span className="text-slate-300 mr-0.5">→</span>}{v}
                </span>
              ))}
            </div>
            {values.length === 0 && <span className="text-[10px] text-slate-400 italic">constant</span>}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t text-[10px] text-slate-400">
        Values observed across the trace (up to the current step).
      </div>
    </motion.aside>
  );
}
