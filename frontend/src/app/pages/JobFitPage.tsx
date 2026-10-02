import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ExternalLink, GraduationCap, Info, Loader2, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { analyzeJobFit, fetchJob, type FitAnalysis, type JobDetail } from '../services/jobs';
import { fetchRoleGoals, fetchResumeVersionsForFit } from '../services/roleProgress';
import toast from 'react-hot-toast';

/**
 * Job Fit (spec §49–§56).
 *
 * This page produces an AETHER JOB REQUIREMENT MATCH. It is explicitly NOT a
 * hiring probability — AETHER cannot know whether an employer will hire anyone,
 * so no wording here claims a chance of being hired (spec §50).
 *
 * Every component of the score is shown with its basis, so the number is fully
 * traceable rather than an opaque figure (spec §56).
 */
export function JobFitPage() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get('jobId') ?? '';

  const [jd, setJd] = useState('');
  const [roleSlug, setRoleSlug] = useState('');
  const [resumeVersionId, setResumeVersionId] = useState('');
  const [roles, setRoles] = useState<Array<{ roleSlug: string; roleName: string }>>([]);
  const [resumes, setResumes] = useState<Array<{ id: string; name: string; targetRoleSlug?: string }>>([]);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoleGoals().then(g => setRoles(g.map(x => ({ roleSlug: x.roleSlug, roleName: x.roleName })))).catch(() => undefined);
    fetchResumeVersionsForFit()
      .then(setResumes)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    fetchJob(jobId).then(setJob).catch(() => setJob(null));
  }, [jobId]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeJobFit({
        jobId: jobId || undefined,
        jobDescription: jobId ? undefined : jd,
        roleSlug: roleSlug || undefined,
        resumeVersionId: resumeVersionId || undefined,
      });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyse this job description.');
    } finally {
      setLoading(false);
    }
  };

  const evaluable = analysis?.components.filter(c => c.earned !== null) ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Job Fit</h1>
        <p className="text-sm text-muted-foreground">
          Paste a job description or pick a posting from{' '}
          <Link to="/jobs" className="text-primary hover:underline">
            Jobs
          </Link>
          . The result is an AETHER job requirement match.
        </p>
      </header>

      {/* Input */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        {job ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="font-medium text-foreground">{job.title}</p>
            <p className="text-sm text-muted-foreground">{job.company}</p>
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View original posting
            </a>
            <button
              type="button"
              className="mt-2 block text-xs text-muted-foreground hover:underline"
              onClick={() => { setParams({}); setAnalysis(null); }}
            >
              Use a pasted description instead
            </button>
          </div>
        ) : (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Job description</span>
            <textarea
              className="min-h-[180px] w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
            />
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Target role
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={roleSlug}
              onChange={e => setRoleSlug(e.target.value)}
            >
              <option value="">None</option>
              {roles.map(r => (
                <option key={r.roleSlug} value={r.roleSlug}>
                  {r.roleName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Resume version
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={resumeVersionId}
              onChange={e => setResumeVersionId(e.target.value)}
            >
              <option value="">My default resume</option>
              {resumes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Button onClick={run} disabled={loading || (!jobId && jd.trim().length < 40)}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {loading ? 'Analysing…' : 'Analyze fit'}
        </Button>
        {!jobId && jd.trim().length > 0 && jd.trim().length < 40 && (
          <p className="text-xs text-muted-foreground">Paste at least a full requirements section.</p>
        )}
      </section>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Result */}
      {analysis && (
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">AETHER Job Requirement Match</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-foreground">
                {analysis.score ?? '—'}
              </span>
              <span className="text-lg text-muted-foreground">/ 100</span>
            </div>
            {analysis.label && <p className="mt-1 font-medium text-primary">{analysis.label}</p>}
            <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This measures how well your evidence aligns with this job description. It is not a
                prediction of whether an employer will hire you.
              </span>
            </p>
          </section>

          {/* Traceable score breakdown */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">How this score was calculated</h2>
            <ul className="mt-3 space-y-3">
              {evaluable.map(component => (
                <li key={component.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{component.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round((component.earned as number) * 10) / 10} / {component.weight}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${((component.earned as number) / component.weight) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{component.basis}</p>
                </li>
              ))}
            </ul>
            {analysis.components.some(c => c.earned === null) && (
              <p className="mt-3 text-xs text-muted-foreground">
                Components with no available data are excluded from the total rather than counted as
                zero, so an incomplete profile is not punished for unrelated gaps.
              </p>
            )}
          </section>

          {/* Requirements */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
                Matched / evidenced
              </h2>
              {analysis.matchedRequirements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing in this JD is evidenced yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {analysis.requirements
                    .filter(r => r.evidenceStatus === 'EVIDENCED')
                    .map(r => (
                      <li key={r.label} className="text-sm text-foreground">
                        <span className="text-emerald-600">✓</span> {r.label}
                        {r.currentLevelLabel && (
                          <span className="ml-1 text-xs text-muted-foreground">({r.currentLevelLabel})</span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
                Not yet evidenced
              </h2>
              {analysis.missingRequirements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Every extracted requirement has evidence.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {analysis.requirements
                      .filter(r => r.evidenceStatus === 'NOT_EVIDENCED')
                      .map(r => (
                        <li key={r.label} className="text-sm text-foreground">
                          <span className="text-amber-600">○</span> {r.label}
                          <span className="ml-1 text-xs text-muted-foreground">({r.importance.toLowerCase()})</span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    This means nothing on your profile evidences these yet — not that you lack them.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Next actions */}
          {analysis.nextActions.length > 0 && (
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Next actions</h2>
              <ul className="mt-3 space-y-2">
                {analysis.nextActions.map(action => (
                  <li key={action.title} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.reason}</p>
                    </div>
                    {action.learningTopicSlug && (
                      <Link
                        to={`/career-learning/topics/${action.learningTopicSlug}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        <GraduationCap className="h-4 w-4" />
                        Learn
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recommended resume */}
          {analysis.recommendedResumeReason && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Recommended resume</h2>
              <p className="mt-2 text-sm text-foreground">{analysis.recommendedResumeReason}</p>
              <Link to="/resume-builder" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                Open Resume Builder
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}