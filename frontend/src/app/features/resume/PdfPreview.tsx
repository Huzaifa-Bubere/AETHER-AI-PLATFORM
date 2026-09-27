import { useEffect, useMemo, useState } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { Gauge, Loader2, RefreshCw, FileWarning } from 'lucide-react';
import ResumePdf from './pdf/ResumePdf';
import { buildResumeBlob } from './pdf/exportPdf';
import { buildResumeFilename, type ResumeDocument } from './types';
import { Card } from '../../components/ui/card';
import type { IAtsResult, IJdMatch } from '../../services/resumeBuilderService';

/**
 * AETHER Resume Builder — live preview (spec §20).
 *
 * The preview renders the SAME @react-pdf/renderer document that is downloaded,
 * so what the candidate sees is what they get. Text stays selectable; the resume
 * is never flattened into an image. A blob-URL fallback covers browsers where
 * the bundled viewer cannot mount.
 */
export default function PdfPreview({ doc, template, refreshKey }: { doc: ResumeDocument; template: string; refreshKey?: number }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const filename = useMemo(() => buildResumeFilename(doc.name, doc.title), [doc.name, doc.title]);

  // Build a generated blob so the "open in a new tab" fallback always works, and
  // so a rendering failure surfaces instead of showing a blank frame.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    const timer = window.setTimeout(async () => {
      try {
        const blob = await buildResumeBlob(doc, template);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setBuildError(null);
      } catch (err: any) {
        if (cancelled) return;
        setPreviewUrl(null);
        setBuildError(err?.message || 'PDF rendering failed');
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, template, refreshKey]);

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
        <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Live PDF preview</span>
        <span className="text-[11px] text-muted-foreground truncate">{filename}</span>
      </div>

      {buildError ? (
        <div className="p-6 space-y-2">
          <p className="text-[13px] text-foreground inline-flex items-center gap-1.5">
            <FileWarning className="w-4 h-4 text-amber-600" /> The PDF could not be generated: {buildError}
          </p>
          <p className="text-[12.5px] text-muted-foreground">Fix the highlighted content and the preview rebuilds automatically.</p>
        </div>
      ) : (
        <div className="h-[70vh] lg:h-[calc(100vh-15rem)]">
          <PDFViewer
            key={`${template}-${refreshKey ?? 0}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            showToolbar
          >
            <ResumePdf doc={doc} template={template} />
          </PDFViewer>
        </div>
      )}

      <div className="px-4 py-2 border-t border-border flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">Selectable text — not an image. The download is generated from this exact document.</p>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap">
            Open in new tab
          </a>
        )}
      </div>
    </Card>
  );
}

// ── Deterministic ATS panel (spec §27) ──────────────────────────────────────

const CORE_WEIGHTS: Array<{ key: string; label: string; weight: number }> = [
  { key: 'contact', label: 'Contact', weight: 10 },
  { key: 'sections', label: 'Sections', weight: 20 },
  { key: 'structure', label: 'Parsability', weight: 15 },
  { key: 'keywords', label: 'Keywords', weight: 20 },
  { key: 'bullets', label: 'Bullets', weight: 15 },
  { key: 'readability', label: 'Readability', weight: 10 },
  { key: 'impact', label: 'Measurable Impact', weight: 10 },
];

export function AtsPanel({ ats, jdMatch, analyzing, onRefresh }: {
  ats: IAtsResult | null; jdMatch: IJdMatch | null; analyzing: boolean; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!ats) {
    return (
      <Card className="p-5 rounded-2xl">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Computing deterministic ATS score…</>
            : <><Gauge className="w-4 h-4" /> Fill in the editor to see your real ATS score.</>}
        </div>
      </Card>
    );
  }

  const byKey = new Map(ats.categories.map(c => [c.key, c]));
  const tone = ats.totalScore >= 70 ? 'text-emerald-600' : ats.totalScore >= 55 ? 'text-amber-600' : 'text-rose-600';

  return (
    <Card className="p-5 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Resume Quality</p>
          <p className={`text-2xl font-extrabold ${tone}`}>
            {ats.totalScore}<span className="text-sm font-bold text-muted-foreground"> / 100</span>
            <span className="text-[11px] font-semibold text-muted-foreground ml-2 uppercase">{ats.grade.replace('-', ' ')}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {analyzing && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> updating…</span>}
          <button onClick={onRefresh} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Recompute
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {CORE_WEIGHTS.map(({ key, label, weight }) => {
          const cat = byKey.get(key);
          const score = cat?.score ?? 0;
          const points = Math.round((score / 100) * weight);
          return (
            <div key={key}>
              <button type="button" onClick={() => setExpanded(expanded === key ? null : key)}
                className="w-full flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">{label} <span className="text-muted-foreground/70">({weight}%)</span></span>
                <span className="font-semibold text-foreground">{points} / {weight}</span>
              </button>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-0.5">
                <div className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${score}%` }} />
              </div>
              {expanded === key && cat && (
                <ul className="mt-1.5 space-y-0.5">
                  {cat.findings.map((f, i) => <li key={i} className="text-[11px] text-muted-foreground">• {f}</li>)}
                  {cat.findings.length === 0 && <li className="text-[11px] text-emerald-700">No issues found in this category.</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {ats.bulletFindings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-[12px] font-bold text-amber-800">Bullet improvements</p>
          {ats.bulletFindings.slice(0, 3).map((b, i) => (
            <p key={i} className="text-[11.5px] text-foreground/80">
              “{b.bullet.slice(0, 70)}{b.bullet.length > 70 ? '…' : ''}” — {b.issues[0]}
            </p>
          ))}
        </div>
      )}

      {jdMatch && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-[12px] font-bold text-foreground">Target job match: {jdMatch.matchScore}%</p>
          <div className="flex flex-wrap gap-1">
            {jdMatch.matchedKeywords.slice(0, 10).map(k => (
              <span key={k} className="text-[10.5px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{k}</span>
            ))}
          </div>
          {jdMatch.missingKeywords.length > 0 && (
            <>
              <p className="text-[11px] text-muted-foreground">Not found in your resume:</p>
              <div className="flex flex-wrap gap-1">
                {jdMatch.missingKeywords.slice(0, 10).map(k => (
                  <span key={k} className="text-[10.5px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">{k}</span>
                ))}
              </div>
            </>
          )}
          <p className="text-[10.5px] text-muted-foreground">{jdMatch.honestyNote}</p>
        </div>
      )}

      <p className="text-[10.5px] text-muted-foreground">
        Every number is computed by AETHER's deterministic ATS engine from your structured content — never generated by AI. This is the same engine the Resume Analyzer uses on uploaded resumes.
      </p>
    </Card>
  );
}
