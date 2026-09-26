/**
 * AETHER Coding — AlgorithmCanvas (§34/§35).
 *
 * Dispatches a VizStep to the right visual layout for the identified mode.
 * Pure presentational component: everything comes from the resolved step.
 */

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Story, VizStep } from './story.types';
import {
  AnimatedArrayCell, AnimatedPointer, AnimatedExpression, OperationCounter,
  StepExplanation, WindowOverlay,
} from './AnimatedPrimitives';
import {
  SeenMemoryStrip, StackVisualizer, QueueVisualizer, MatrixVisualizer,
  LinkedListVisualizer, GraphVisualizer, RecursionVisualizer, CallStackVisualizer,
} from './StructureVisualizers';

const CELL_W = 48; // matches w-12

interface CanvasProps {
  story: Story;
  step: VizStep;
}

export const AlgorithmCanvas = memo(function AlgorithmCanvas({ story, step }: CanvasProps) {
  const mode = story.mode;

  const hasArray = step.cells.length > 0;
  const showWindow = step.window && (mode === 'sliding-window');

  // Secondary structure components
  const memory = step.memory;
  const stack = step.stack;
  const queue = step.queue;
  const matrix = step.matrix;
  const linkedList = step.linkedList;
  const graph = step.graph;

  const isRecursionStory = mode === 'recursion';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* ── Title / objective band ── */}
      <div className="text-center space-y-0.5">
        <h2 className="text-xl font-black tracking-tight text-slate-900">{story.problemTitle || 'Algorithm Walkthrough'}</h2>
        <p className="text-xs text-slate-500">{story.problemObjective || 'Watch your submitted algorithm execute step by step.'}</p>
      </div>

      {/* ── Primary array row ── */}
      {hasArray && (
        <div className="flex justify-center">
          <div className="relative inline-block pt-9 pb-9 px-1">
            {/* top pointers */}
            <div className="absolute inset-x-0 top-0 h-9 pointer-events-none">
              {step.pointers.filter(p => p.side === 'top').map(p => (
                <AnimatedPointer key={p.label} pointer={p} cellWidth={CELL_W} />
              ))}
            </div>
            {/* bottom pointers */}
            <div className="absolute inset-x-0 bottom-0 h-9 pointer-events-none">
              {step.pointers.filter(p => p.side === 'bottom').map(p => (
                <AnimatedPointer key={p.label} pointer={p} cellWidth={CELL_W} />
              ))}
            </div>
            {/* interval fade for discarded halves */}
            <div className="flex gap-1.5 items-end">
              {step.cells.map((cell, idx) => {
                const outside = step.interval && (idx < step.interval.start || idx > step.interval.end);
                return (
                  <div key={idx} className="relative">
                    {step.window && showWindow && idx === step.window.start && (
                      <WindowOverlay start={step.window.start} end={step.window.end} cellWidth={CELL_W} />
                    )}
                    <AnimatedArrayCell
                      value={cell.value}
                      index={idx}
                      state={cell.state}
                      dimmed={!!outside || (step.interval && mode === 'binary-search' ? outside : false)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Linked list replaces the array row when present ── */}
      {!hasArray && linkedList && <LinkedListVisualizer linkedList={linkedList} />}

      {/* ── Central expression ── */}
      <AnimatedExpression expression={step.expression ?? null} />

      {/* ── Counter + explanation ── */}
      <div className="space-y-2.5">
        <OperationCounter
          value={step.counters[step.counterKey] ?? 0}
          label={`${(step.counters[step.counterKey] ?? 0) === 1 ? story.counterLabelSingular : story.counterLabelSingular + 'S'} • ${story.approachLabel}`}
          secondary={Object.entries(step.counters)
            .filter(([k]) => k !== step.counterKey)
            .map(([label, value]) => ({ label, value }))}
        />
        <StepExplanation text={step.explanation} approach={story.mantra} />
      </div>

      {/* ── MATCH FOUND / banner ── */}
      {step.title && (
        <div className="flex justify-center">
          <MatchTitleBanner step={step} />
        </div>
      )}

      {/* ── Memory strip (hash-map / seen) ── */}
      {memory && <SeenMemoryStrip memory={memory} />}

      {/* ── Structures grid ── */}
      {(stack || queue || graph || matrix || linkedList && hasArray) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {stack && <StackVisualizer stack={stack} />}
          {queue && <QueueVisualizer queue={queue} />}
          {graph && <GraphVisualizer graph={graph} />}
          {matrix && <MatrixVisualizer matrix={matrix} />}
          {linkedList && hasArray && <LinkedListVisualizer linkedList={linkedList} />}
        </div>
      )}

      {/* ── Recursion / call stack ── */}
      {isRecursionStory && step.recursion && <RecursionVisualizer step={step} />}
      {!isRecursionStory && step.callStack && step.callStack.length > 1 && <CallStackVisualizer step={step} />}

      {/* ── Runtime error block (§41) ── */}
      {step.error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            VISUALIZATION STOPPED — Runtime Error
          </p>
          <pre className="font-mono text-xs mt-1 whitespace-pre-wrap">{step.error.message}</pre>
          <p className="text-xs text-rose-600 mt-2">
            State is shown at the last valid step; use Previous to move backward through earlier events.
          </p>
        </div>
      )}
    </div>
  );
});

function MatchTitleBanner({ step }: { step: VizStep }) {
  const reduce = useReducedMotion();
  const tone = step.title === 'MATCH FOUND' || step.title === 'EXECUTION COMPLETE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
    : step.title === 'VISUALIZATION STOPPED'
      ? 'bg-rose-50 text-rose-700 border-rose-300'
      : 'bg-blue-50 text-blue-700 border-blue-300';
  return (
    <motion.div
      key={step.title + step.n}
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`px-4 py-1.5 rounded-full border text-sm font-bold shadow-xs inline-flex items-center gap-2 ${tone}`}
    >
      {step.title === 'MATCH FOUND' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      {step.title}
      {step.matched && (
        <span className="font-mono text-xs font-bold opacity-80">
          Indices: {step.matched.join(', ')}
        </span>
      )}
    </motion.div>
  );
}

// Re-export so host pages can style cells consistently if needed.
export { CELL_STATE_STYLE } from './AnimatedPrimitives';
