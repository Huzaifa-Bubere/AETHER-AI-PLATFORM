import { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Copy, Check, Info,
  Lightbulb, Loader2, Sparkles, BookOpen, Gauge,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { codingService } from '../services/coding.service';
import type {
  IComplexityComparison, IOptimizationExplanation, IReferenceApproach, OptimizationLevel,
} from '../types';
import toast from 'react-hot-toast';

/**
 * AETHER Coding — post-submission complexity optimization feedback (Part A).
 *
 * Warning levels (spec §4):
 *   OPTIMAL                        → GREEN  "matches the expected efficient complexity"
 *   POSSIBLY_IMPROVABLE            → AMBER  "may be optimizable"
 *   CLEAR_OPTIMIZATION_OPPORTUNITY → RED    "can be optimized"
 *   UNKNOWN                        → neutral "analysis uncertain"
 *
 * The verdict comes from the backend's deterministic complexity engine. Gemini
 * only narrates it, and correctness is never conflated with efficiency.
 */

const LEVEL_STYLES: Record<OptimizationLevel, {
  card: string; chip: string; icon: typeof AlertTriangle; label: string;
}> = {
  OPTIMAL: {
    card: 'border-emerald-200 bg-emerald-50',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: CheckCircle2,
    label: 'EFFICIENT',
  },
  POSSIBLY_IMPROVABLE: {
    card: 'border-amber-200 bg-amber-50',
    chip: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: AlertTriangle,
    label: 'POSSIBLY IMPROVABLE',
  },
  CLEAR_OPTIMIZATION_OPPORTUNITY: {
    card: 'border-rose-200 bg-rose-50',
    chip: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: AlertTriangle,
    label: 'OPTIMIZATION OPPORTUNITY',
  },
  UNKNOWN: {
    card: 'border-slate-200 bg-slate-50',
    chip: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: Info,
    label: 'ANALYSIS UNCERTAIN',
  },
};

export function OptimizationFeedback({
  optimization,
  submissionId,
  status,
  score,
  referenceApproachAvailable,
  compact = false,
}: {
  optimization: IComplexityComparison;
  submissionId?: string;
  status?: string;
  score?: number | null;
  referenceApproachAvailable?: boolean;
  compact?: boolean;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const [explanation, setExplanation] = useState<IOptimizationExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [reference, setReference] = useState<IReferenceApproach | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);

  const style = LEVEL_STYLES[optimization.level] || LEVEL_STYLES.UNKNOWN;
  const Icon = style.icon;
  const accepted = status === 'Accepted';

  const explain = async () => {
    if (!submissionId) return;
    setExplaining(true);
    try {
      const res = await codingService.explainOptimization(submissionId);
      if (res.success && res.data) setExplanation(res.data.explanation);
      else toast.error(res.message || 'Explanation unavailable');
    } catch (e: any) {
      toast.error(e?.message || 'AETHER AI unavailable');
    } finally {
      setExplaining(false);
    }
  };

  const showOptimized = async () => {
    if (!submissionId) return;
    setLoadingReference(true);
    try {
      const res = await codingService.getReferenceApproach(submissionId);
      if (res.success && res.data) setReference(res.data);
      else toast.error(res.message || 'No reference approach for this problem');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load reference approach');
    } finally {
      setLoadingReference(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Result summary row (spec §3) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accepted ? 'text-emerald-600' : 'text-rose-600'}`}>
          {accepted ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {status || 'Evaluated'}
        </span>
        {score != null && (
          <span className="text-sm text-slate-600">
            Score: <span className="font-bold text-slate-900">{score} / 100</span>
          </span>
        )}
        <span className="text-sm text-slate-600">
          Time Complexity — Estimated:{' '}
          <span className="font-mono font-semibold text-slate-900">{optimization.candidateTime}</span>
        </span>
        <span className="text-sm text-slate-600">
          Expected Efficient Solution:{' '}
          <span className="font-mono font-semibold text-slate-900">{optimization.expectedTime}</span>
        </span>
      </div>

      {/* Warning / efficiency card */}
      <div className={`rounded-lg border ${style.card} p-4 space-y-2`}>
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={`w-4 h-4 ${optimization.level === 'OPTIMAL' ? 'text-emerald-600' : optimization.level === 'UNKNOWN' ? 'text-slate-500' : 'text-amber-600'}`} />
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${style.chip}`}>{style.label}</span>
          <span className="text-[11px] text-slate-500">
            Analyzer confidence: <strong>{optimization.confidence}</strong> ({Math.round((optimization.analyzerConfidence || 0) * 100)}%)
          </span>
        </div>

        <p className="text-sm text-slate-800 leading-relaxed">{optimization.message}</p>

        {optimization.reason && (
          <p className="text-xs text-slate-600"><strong>Reason:</strong> {optimization.reason}</p>
        )}

        {!compact && optimization.evidence?.length > 0 && (
          <ul className="space-y-1 pt-1">
            {optimization.evidence.slice(0, 4).map((e, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                <span className="text-slate-400 mt-0.5">▸</span>{e}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {submissionId && (
            <Button size="sm" variant="outline" onClick={explain} disabled={explaining} className="text-xs">
              {explaining ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-500" />}
              Explain with AETHER AI
            </Button>
          )}
          {optimization.optimizationHint && (
            <Button size="sm" variant="outline" onClick={() => setHintOpen(o => !o)} className="text-xs">
              <Lightbulb className="w-3.5 h-3.5 mr-1 text-amber-500" />
              {hintOpen ? 'Hide Optimization Hint' : 'View Optimization Hint'}
              {hintOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          )}
          {submissionId && referenceApproachAvailable && (
            <Button size="sm" variant="outline" onClick={showOptimized} disabled={loadingReference} className="text-xs">
              {loadingReference ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <BookOpen className="w-3.5 h-3.5 mr-1 text-blue-600" />}
              {reference ? 'Hide Optimized Approach' : 'Show Optimized Approach'}
            </Button>
          )}
        </div>

        {hintOpen && optimization.optimizationHint && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Optimization direction</p>
            <p className="text-sm text-slate-700">{optimization.optimizationHint}</p>
            {optimization.optimizationExplanation && (
              <p className="text-xs text-slate-500 mt-2">{optimization.optimizationExplanation}</p>
            )}
          </div>
        )}
      </div>

      {/* AETHER AI explanation (spec §9) */}
      {explanation && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" /> AETHER AI — Optimization Explanation
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-500 border">
              {explanation.generatedBy === 'gemini' ? 'Gemini narration' : 'Deterministic (AI offline)'}
            </span>
          </div>
          <p className="text-sm text-slate-800">{explanation.summary}</p>
          <ExplanationRow label="Why this is slower" value={explanation.whySlower} />
          <ExplanationRow label="Where the complexity comes from" value={explanation.whereComplexityComesFrom} />
          <ExplanationRow label="Concept that can improve it" value={explanation.conceptToImprove} />
          <ExplanationRow label="How the improved approach works" value={explanation.improvedApproach} />
          <p className="text-xs text-indigo-800 bg-white rounded border border-indigo-100 p-2.5">
            <strong>Key takeaway:</strong> {explanation.keyTakeaway}
          </p>
          <p className="text-[11px] text-slate-400">
            The complexity verdict above is computed deterministically from your code's structure — AI narration cannot change it.
          </p>
        </div>
      )}

      {/* Reference optimized approach (spec §10) */}
      {reference && <ReferenceApproachPanel reference={reference} />}
    </div>
  );
}

function ExplanationRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}

function ReferenceApproachPanel({ reference }: { reference: IReferenceApproach }) {
  const languages = reference.languages?.length ? reference.languages : Object.keys(reference.code || {});
  const [lang, setLang] = useState(languages[0] || 'python');
  const code = (reference.code || {})[lang] || '';

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-blue-600" /> REFERENCE OPTIMIZED APPROACH
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>Time: <strong className="font-mono">{reference.timeComplexity}</strong></span>
          <span>Space: <strong className="font-mono">{reference.spaceComplexity}</strong></span>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-700">{reference.title}</p>
        <p className="text-sm text-slate-700 mt-1">{reference.explanation}</p>
      </div>

      {reference.optimizationHint && (
        <p className="text-xs text-slate-600">
          <strong>Approach:</strong> {reference.optimizationHint}
        </p>
      )}

      {code ? (
        <>
          <div className="flex items-center gap-1.5">
            {languages.map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                  lang === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <CodeBlock code={code} language={lang} />
        </>
      ) : (
        <p className="text-xs text-slate-500">
          Reference code is not available for this problem — the approach described above is the recommended direction.
        </p>
      )}

      <p className="text-[11px] text-slate-500">{reference.note}</p>
    </div>
  );
}

/** Syntax-plain code block with a copy button and language label (spec §33 pattern). */
export function CodeBlock({ code, language, output }: { code: string; language: string; output?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{language}</span>
        <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-3 text-xs font-mono overflow-x-auto whitespace-pre">{code}</pre>
      {output != null && (
        <div className="bg-slate-950 px-3 py-2 border-t border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Output</p>
          <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap">{output || '(no output)'}</pre>
        </div>
      )}
    </div>
  );
}
