import { useState } from 'react';
import {
  Copy, Check, Terminal, Lightbulb, AlertTriangle, Info, ClipboardList,
  ListOrdered, Table2, Columns2, AlertCircle, Wrench, GraduationCap, Target, Sparkles,
} from 'lucide-react';
import type {
  TopicBlock, TopicExample, TopicCommonMistake, TopicInterviewTip, TopicPractice,
} from '../../services/learningTopics';

/**
 * AETHER Career Learning — deterministic lesson renderer (spec §30–§36, §38).
 *
 * The database stores structured blocks; this file knows how to draw each block
 * type. Nothing here is AI-generated: with Gemini offline the lesson is still
 * complete and readable (spec §56).
 */

export function CodeBlock({
  code, language, output, caption, compact = false,
}: { code: string; language?: string; output?: string; caption?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the code is still selectable */
    }
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-secondary/40">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/70 border-b border-border">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {caption && <p className="px-3 pt-2 text-[11px] text-muted-foreground">{caption}</p>}
      <pre className={`px-3 py-2.5 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-foreground ${compact ? 'max-h-52' : ''}`}>
        <code>{code}</code>
      </pre>
      {output && (
        <div className="border-t border-border bg-card px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 inline-flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Output
          </p>
          <pre className="text-[12px] font-mono text-emerald-700 whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}

function BlockCallout({ kind, content }: { kind: 'tip' | 'warning' | 'note'; content: string }) {
  const styles = {
    tip: { wrap: 'bg-emerald-50 border-emerald-200', icon: Lightbulb, color: 'text-emerald-700', label: 'Tip' },
    warning: { wrap: 'bg-amber-50 border-amber-200', icon: AlertTriangle, color: 'text-amber-700', label: 'Watch out' },
    note: { wrap: 'bg-blue-50 border-blue-200', icon: Info, color: 'text-blue-700', label: 'Note' },
  }[kind];
  const Icon = styles.icon;
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${styles.wrap}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 inline-flex items-center gap-1.5 ${styles.color}`}>
        <Icon className="w-3.5 h-3.5" /> {styles.label}
      </p>
      <p className="text-[13.5px] text-foreground leading-relaxed">{content}</p>
    </div>
  );
}

export function LessonBlock({ block }: { block: TopicBlock }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="text-lg font-bold text-foreground pt-2 scroll-mt-24">{block.content}</h3>;
    case 'paragraph':
      return <p className="text-[14.5px] text-foreground/90 leading-relaxed">{block.content}</p>;
    case 'list':
      return (
        <ul className="space-y-1.5 pl-1">
          {(block.items || []).map((item, i) => (
            <li key={i} className="text-[14px] text-foreground/90 flex items-start gap-2">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'steps':
      return (
        <ol className="space-y-2">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-[14px] text-foreground/90 leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'code':
      return <CodeBlock code={String(block.code || '')} language={block.language} output={block.output} caption={block.caption} />;
    case 'tip':
      return <BlockCallout kind="tip" content={String(block.content || '')} />;
    case 'warning':
      return <BlockCallout kind="warning" content={String(block.content || '')} />;
    case 'note':
      return <BlockCallout kind="note" content={String(block.content || '')} />;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/70">
              <tr>
                {(block.columns || []).map((c, i) => (
                  <th key={i} className="text-left px-3 py-2 font-bold text-foreground whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows || []).map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground/90 align-top">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'compare':
      return (
        <div className="grid sm:grid-cols-2 gap-3">
          {[{ title: block.leftTitle, items: block.leftItems }, { title: block.rightTitle, items: block.rightItems }]
            .map((side, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5">{side.title}</p>
                <ul className="space-y-1">
                  {(side.items || []).map((item, j) => (
                    <li key={j} className="text-[13px] text-foreground/90 flex items-start gap-1.5">
                      <Columns2 className="w-3 h-3 mt-1 shrink-0 text-muted-foreground" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      );
    default:
      return block.content ? <p className="text-[14px] text-foreground/90">{block.content}</p> : null;
  }
}

export function LessonSections({ sections }: { sections: TopicBlock[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const blocks = sections || [];

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" /> Lesson content
        </h2>
        <span className="text-[11px] text-muted-foreground">{blocks.length} blocks · step {Math.min(activeIndex + 1, blocks.length)}/{blocks.length}</span>
      </div>
      {blocks.map((block, i) => (
        <div key={i} id={`block-${i}`} onClick={() => setActiveIndex(i)} className="scroll-mt-24">
          <LessonBlock block={block} />
        </div>
      ))}
    </div>
  );
}

export function LessonExamples({ examples }: { examples: TopicExample[] }) {
  if (!examples?.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" /> Worked examples
        <span className="text-[11px] font-normal text-muted-foreground">({examples.length})</span>
      </h2>
      <div className="grid gap-3">
        {examples.map((ex, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Example {i + 1} — {ex.kind}
              </span>
              <span className="text-sm font-bold text-foreground">{ex.title}</span>
            </div>
            {ex.explanation && <p className="text-[13.5px] text-muted-foreground leading-relaxed">{ex.explanation}</p>}
            <CodeBlock code={ex.code} language={ex.language} output={ex.output} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LessonCommonMistakes({ mistakes }: { mistakes: TopicCommonMistake[] }) {
  if (!mistakes?.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-rose-600" /> Common mistakes
      </h2>
      {mistakes.map((m, i) => (
        <div key={i} className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2.5">
          <p className="text-sm font-bold text-foreground">{m.title}</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1">Wrong</p>
              <CodeBlock code={m.wrong} language={m.wrongLanguage || 'text'} compact />
            </div>
            {m.fix && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1 inline-flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Fix
                </p>
                <CodeBlock code={m.fix} language={m.fixLanguage || m.wrongLanguage || 'text'} compact />
              </div>
            )}
          </div>
          <p className="text-[13px] text-foreground/90 leading-relaxed"><strong className="text-foreground">Why: </strong>{m.why}</p>
        </div>
      ))}
    </div>
  );
}

export function LessonInterviewTips({ tips }: { tips: TopicInterviewTip[] }) {
  if (!tips?.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-primary" /> Interview relevance
      </h2>
      {tips.map((t, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[13.5px] font-semibold text-foreground mb-1.5">“{t.question}”</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{t.answer}</p>
          {t.difficulty && (
            <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {t.difficulty}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const PRACTICE_STYLE = {
  EASY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  CHALLENGE: 'bg-rose-50 text-rose-700 border-rose-200',
} as const;

export function LessonPractice({ practice }: { practice: TopicPractice[] }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  if (!practice?.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" /> Practice
      </h2>
      {practice.map((p, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRACTICE_STYLE[p.level]}`}>
            {p.level}
          </span>
          <p className="text-[14px] text-foreground leading-relaxed">{p.prompt}</p>
          {p.hint && (
            <div>
              <button
                type="button"
                onClick={() => setRevealed(r => ({ ...r, [i]: !r[i] }))}
                className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                <ListOrdered className="w-3 h-3" /> {revealed[i] ? 'Hide hint' : 'Show hint'}
              </button>
              {revealed[i] && <p className="mt-1 text-[12.5px] text-muted-foreground">{p.hint}</p>}
            </div>
          )}
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <Table2 className="w-3 h-3" /> Practice is self-graded guidance — the quiz below is graded server-side.
      </p>
    </div>
  );
}
