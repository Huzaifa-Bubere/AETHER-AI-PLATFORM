import { Link } from 'react-router-dom';
import { Bookmark, ExternalLink, MapPin } from 'lucide-react';
import type { JobSummary, Salary } from '../../services/jobs';
import { Button } from '../ui/button';

/**
 * Job card (spec §65).
 *
 * Renders exactly what the provider supplied. Where a value is absent the card
 * says "Not listed" / "Not specified" — it never fills the gap with a plausible
 * number (spec §61). Apply opens the original verified source rather than
 * pretending AETHER submitted anything (spec §66).
 */

const WORK_MODE_LABELS: Record<string, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
  UNSPECIFIED: 'Not specified',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
  TEMPORARY: 'Temporary',
  UNSPECIFIED: 'Not specified',
};

const EXPERIENCE_LABELS: Record<string, string> = {
  INTERN: 'Intern',
  ENTRY: 'Entry level',
  MID: 'Mid level',
  SENIOR: 'Senior',
  LEAD: 'Lead',
  UNSPECIFIED: 'Not specified',
};

/** Format a salary only when the posting actually stated one. */
export function formatSalary(salary?: Salary | null): string {
  if (!salary) return 'Salary not listed';
  if (salary.raw?.trim()) return salary.raw;
  if (typeof salary.min === 'number' && typeof salary.max === 'number') {
    const suffix = salary.period === 'MONTH' ? '/month' : salary.period === 'HOUR' ? '/hour' : '';
    return `${salary.min} – ${salary.max} ${salary.currency ?? ''}${suffix}`.trim();
  }
  if (typeof salary.min === 'number') return `From ${salary.min} ${salary.currency ?? ''}`.trim();
  if (typeof salary.max === 'number') return `Up to ${salary.max} ${salary.currency ?? ''}`.trim();
  return 'Salary not listed';
}

function relativeDate(iso: string | null): string {
  if (!iso) return 'Date not listed';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function JobCard({
  job,
  saved,
  onSave,
  onAnalyze,
}: {
  job: JobSummary;
  saved: boolean;
  onSave: (job: JobSummary) => void;
  onAnalyze: (job: JobSummary) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">
            <Link to={`/jobs/${job.id}`} className="hover:underline">
              {job.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{job.company}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {job.location ?? 'Location not listed'}
            </span>
            <span>{WORK_MODE_LABELS[job.workMode] ?? 'Not specified'}</span>
            <span>{JOB_TYPE_LABELS[job.jobType] ?? 'Not specified'}</span>
            <span>{EXPERIENCE_LABELS[job.experienceLevel] ?? 'Not specified'}</span>
          </p>
        </div>
        {job.companyLogo && (
          <img src={job.companyLogo} alt="" className="h-10 w-10 shrink-0 rounded object-contain" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">{formatSalary(job.salary)}</span>
        {job.skills.slice(0, 5).map(skill => (
          <span key={skill} className="rounded bg-primary/5 px-2 py-1 text-primary">
            {skill}
          </span>
        ))}
        {job.skills.length > 5 && <span className="text-muted-foreground">+{job.skills.length - 5} more</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {relativeDate(job.datePosted)} · via {job.source}
          {(job.availableFromNProviders ?? 1) > 1 && (
            <span className="ml-1 text-muted-foreground">
              · also listed by {(job.availableFromNProviders ?? 1) - 1} other source(s)
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Two DIFFERENT numbers, deliberately worded differently (spec §B4):
              - relevance  → search ranking ("why is this at the top?")
              - fit        → AETHER Job Requirement Match ("how well do my
                             evidences align with this one JD?")
            They are never both labelled "match".
          */}
          {job.recommendation?.recommendationScore != null && (
            <span
              className="rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
              title={job.recommendation.reasonSummary}
            >
              {job.recommendation.recommendationScore} relevance
              {job.recommendation.recommendationLabel
                ? ` · ${job.recommendation.recommendationLabel}`
                : ''}
            </span>
          )}
          {job.fit?.score != null ? (
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              {job.fit.score}/100 requirement match
            </span>
          ) : (
            <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Not analyzed</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => onSave(job)}>
            <Bookmark className={`mr-1 h-4 w-4 ${saved ? 'fill-primary text-primary' : ''}`} />
            {saved ? 'Saved' : 'Save'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAnalyze(job)}>
            Analyze fit
          </Button>
          {/* Apply opens the ORIGINAL source — AETHER does not submit applications. */}
          <Button variant="outline" size="sm" asChild={false}>
            <a href={job.sourceUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="mr-1 h-4 w-4" />
              View &amp; apply
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

export { WORK_MODE_LABELS, JOB_TYPE_LABELS, EXPERIENCE_LABELS, relativeDate };