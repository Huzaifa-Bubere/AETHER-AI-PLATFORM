import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CircleHelp, GraduationCap } from 'lucide-react';
import type { RequirementProgress, RoleProgress } from '../../services/roleProgress';

/**
 * Role requirement matrix (spec §40, §41).
 *
 * Shows each requirement with the level the role demands, the level the
 * candidate currently has EVIDENCE for, and a link straight to the lesson that
 * closes the gap. Requirements the candidate has never been assessed on are
 * marked "Not assessed" — never as a failing 0%.
 */

const CATEGORY_LABELS: Record<string, string> = {
  PROGRAMMING_LANGUAGES: 'Programming Languages',
  FRAMEWORKS_LIBRARIES: 'Frameworks / Libraries',
  DATABASES: 'Databases',
  CS_FUNDAMENTALS: 'Computer Science Fundamentals',
  APIs: 'APIs',
  CLOUD: 'Cloud',
  DEVOPS: 'DevOps',
  TESTING: 'Testing',
  TOOLS: 'Tools',
  SYSTEM_DESIGN: 'System Design',
  DATA_AI: 'Data / AI',
  PROFESSIONAL_SKILLS: 'Professional Skills',
};

const EVIDENCE_LABELS: Array<[keyof RoleProgress['requirements'][number]['evidence'], string]> = [
  ['resume', 'Resume'],
  ['technical', 'Technical'],
  ['coding', 'Coding'],
  ['interview', 'Interview'],
  ['learning', 'Learning'],
  ['project', 'Project'],
  ['selfDeclared', 'Self-declared'],
];

const PRIORITY_STYLES: Record<string, string> = {
  ESSENTIAL: 'bg-red-50 text-red-700 border-red-200',
  RECOMMENDED: 'bg-amber-50 text-amber-700 border-amber-200',
  BONUS: 'bg-slate-50 text-slate-600 border-slate-200',
  OPTIONAL: 'bg-slate-50 text-slate-600 border-slate-200',
};

function StatusIcon({ status }: { status: RequirementProgress['status'] }) {
  if (status === 'MET') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  if (status === 'BELOW_REQUIRED') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />;
  return <CircleHelp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />;
}

function statusLabel(status: RequirementProgress['status']): string {
  if (status === 'MET') return 'Requirement met';
  if (status === 'BELOW_REQUIRED') return 'Needs improvement';
  return 'Not assessed';
}

function RequirementRow({ requirement }: { requirement: RequirementProgress }) {
  const evidenceEntries = EVIDENCE_LABELS.filter(([key]) => requirement.evidence[key] !== null);

  return (
    <li className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <StatusIcon status={requirement.status} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{requirement.name}</span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                PRIORITY_STYLES[requirement.priority] ?? PRIORITY_STYLES.BONUS
              }`}
            >
              {requirement.priority}
            </span>
          </div>

          {/* Evidence, so a level is never an unexplained number (spec §27). */}
          {evidenceEntries.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Evidence:{' '}
              {evidenceEntries.map(([key, label], i) => {
                const detail = requirement.evidence[key];
                return (
                  <span key={key}>
                    {i > 0 && ', '}
                    {label}
                    {detail?.score !== null && detail?.score !== undefined ? ` ${detail.score}%` : ''}
                  </span>
                );
              })}
            </p>
          )}

          {requirement.learningTopicSlug && requirement.status !== 'MET' && (
            <Link
              to={`/career-learning/topics/${requirement.learningTopicSlug}`}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              Learn {requirement.name}
            </Link>
          )}
        </div>
      </div>

      <div className="shrink-0 text-left sm:w-56 sm:text-right">
        <p className="text-xs text-muted-foreground">
          Required: <span className="font-medium text-foreground">{requirement.requiredLevelLabel}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Current:{' '}
          <span className="font-medium text-foreground">
            {requirement.currentLevelLabel ?? 'Not assessed'}
          </span>
        </p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{statusLabel(requirement.status)}</p>
      </div>
    </li>
  );
}

export function RoleRequirementMatrix({ progress }: { progress: RoleProgress }) {
  const byCategory = useMemo(() => {
    const map = new Map<string, RequirementProgress[]>();
    for (const requirement of progress.requirements) {
      const bucket = map.get(requirement.category);
      if (bucket) bucket.push(requirement);
      else map.set(requirement.category, [requirement]);
    }
    return [...map.entries()];
  }, [progress.requirements]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">{progress.roleName} requirements</h2>
        <p className="text-sm text-muted-foreground">
          {progress.totals.met} of {progress.totals.requirements} met · {progress.totals.belowRequired}{' '}
          need improvement · {progress.totals.notAssessed} not assessed
        </p>
      </header>

      {byCategory.map(([category, requirements]) => (
        <section key={category}>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <ul>
            {requirements.map(requirement => (
              <RequirementRow key={requirement.skillSlug} requirement={requirement} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
