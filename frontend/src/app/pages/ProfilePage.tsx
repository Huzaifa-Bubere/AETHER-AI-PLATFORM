import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  Github,
  GraduationCap,
  Linkedin,
  MapPin,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { fetchProfessionalProfile, type ProfessionalProfile } from '../services/profile';
import { AetherStreakCalendar } from '../components/activity/AetherStreakCalendar';
import { RoleRequirementMatrix } from '../components/roles/RoleRequirementMatrix';

/**
 * AETHER professional profile (spec §24–§28).
 *
 * A professional profile in the LinkedINFORMATION HIERARCHY, not a LinkedIn
 * clone — AETHER branding, no feed, no posts, no connections. Every section is
 * driven by real data from ProfileService, which reads the same services as the
 * dashboard, so readiness and skill levels match on both pages (spec §93).
 *
 * Sections with nothing to show render an honest prompt rather than placeholder
 * copy, and profile completeness is a deterministic field count — never
 * inferred or generated.
 */

function Section({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground">
          <span className="text-primary" aria-hidden>
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ text, cta, href }: { text: string; cta?: string; href?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
      {text}
      {cta && href && (
        <Link to={href} className="mt-1 block font-medium text-primary hover:underline">
          {cta}
        </Link>
      )}
    </div>
  );
}

function formatMonth(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function ProfilePage() {
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchProfessionalProfile());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !profile) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-destructive">
            <AlertCircle className="h-5 w-5" />
            We could not load your profile
          </h1>
          <p className="mt-2 text-sm text-destructive">{error}</p>
          <Button className="mt-4" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const { user, completeness, targetRoles, roleProgress, skills, streak, heatmap, activity, resumes } = profile;
  const primaryDetail = roleProgress.primaryRole ? roleProgress.detail[roleProgress.primaryRole] : null;
  const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '');

  const links = [
    { href: user.links.github, label: 'GitHub', icon: <Github className="h-4 w-4" /> },
    { href: user.links.linkedin, label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
    { href: user.links.portfolio, label: 'Portfolio', icon: <ExternalLink className="h-4 w-4" /> },
  ].filter(l => Boolean(l.href));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
      {error && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing the last successful load — {error}
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className="h-32 bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-400"
          style={user.coverImage ? { backgroundImage: `url(${user.coverImage})`, backgroundSize: 'cover' } : undefined}
        />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-24 w-24 rounded-full border-4 border-card bg-card object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-primary/10 text-2xl font-bold text-primary">
                  {initials || 'A'}
                </div>
              )}
              <div className="pb-1">
                <h1 className="text-2xl font-bold text-foreground">{user.fullName || 'Your profile'}</h1>
                <p className="text-sm text-muted-foreground">
                  {user.headline || 'Add a professional headline in Settings'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild={false}>
              <Link to="/settings">
                <Pencil className="mr-2 h-4 w-4" />
                Edit profile
              </Link>
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {user.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" aria-hidden />
                {user.location}
              </span>
            )}
            {links.map(l => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {l.icon}
                {l.label}
              </a>
            ))}
            {user.openToWork && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Open to work
                {user.openToWorkRoles.length > 0 && ` · ${user.openToWorkRoles.join(', ')}`}
              </span>
            )}
          </div>

          {/* Deterministic completeness — counts filled fields, names the rest */}
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Profile completeness</span>
              <span className="tabular-nums font-semibold text-foreground">{completeness.score}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary" style={{ width: `${completeness.score}%` }} />
            </div>
            {completeness.missing.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Missing: {completeness.missing.join(', ')}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <Section title="About" icon={<Briefcase className="h-4 w-4" />}>
        {user.about ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{user.about}</p>
        ) : (
          <EmptyHint
            text="No professional summary yet. A short paragraph about what you build and are looking for helps recruiters and job matching."
            cta="Add it in Settings"
            href="/settings"
          />
        )}
      </Section>

      {/* ── Target roles + progress ───────────────────────────────────────── */}
      <Section title="Target roles & progress" icon={<Briefcase className="h-4 w-4" />}>
        {targetRoles.length === 0 ? (
          <EmptyHint text="You are not targeting a role yet." cta="Choose a target role" href="/career-learning" />
        ) : (
          <div className="space-y-4">
            {targetRoles.map(role => {
              const detail = roleProgress.detail[role.roleSlug];
              const isOpen = expandedRole === role.roleSlug;
              return (
                <div key={role.roleSlug} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {role.roleName}
                        {role.isPrimary && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                            Primary
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {role.met} met · {role.belowRequired} need improvement · {role.notAssessed} not assessed
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold tabular-nums text-foreground">
                        {role.readiness === null ? <span className="text-sm italic text-muted-foreground">Not assessed</span> : `${role.readiness}%`}
                      </span>
                      {detail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRole(isOpen ? null : role.roleSlug)}
                        >
                          {isOpen ? 'Hide requirements' : 'View requirements'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isOpen && detail && (
                    <div className="mt-4 border-t border-border pt-4">
                      <RoleRequirementMatrix progress={detail} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Skills ───────────────────────────────────────────────────────── */}
      <Section title="Skills" icon={<CheckCircle2 className="h-4 w-4" />}>
        {skills.skills.length === 0 ? (
          <EmptyHint
            text="No evidenced skills yet. Complete assessments, coding problems, interviews or lessons and your evidenced skills appear here."
            cta="Take a technical assessment"
            href="/technical"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {skills.skills.map(skill => {
              const evidence = Object.entries(skill.evidence).filter(([, v]) => v !== null);
              return (
                <li key={skill.skillSlug} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{skill.skillSlug}</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {skill.levelLabel}
                    </span>
                  </div>
                  {evidence.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Evidence: {evidence.map(([key]) => key).join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-muted-foreground">No source recorded</p>
                  )}
                  {skill.bestEvidence === 'SELF_DECLARED' && (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">Self-declared</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* ── Experience ───────────────────────────────────────────────────── */}
      <Section title="Experience" icon={<Briefcase className="h-4 w-4" />}>
        {user.experience.length === 0 ? (
          <EmptyHint text="No work experience added yet." cta="Add experience in Settings" href="/settings" />
        ) : (
          <ul className="space-y-4">
            {user.experience.map((exp, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-4">
                <p className="font-medium text-foreground">{exp.title}</p>
                <p className="text-sm text-muted-foreground">
                  {exp.company}
                  {exp.location && ` · ${exp.location}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMonth(exp.startDate)} – {exp.current ? 'Present' : formatMonth(exp.endDate)}
                </p>
                {exp.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground">{exp.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Education ────────────────────────────────────────────────────── */}
      <Section title="Education" icon={<GraduationCap className="h-4 w-4" />}>
        {user.education.length === 0 ? (
          <EmptyHint text="No education added yet." cta="Add education in Settings" href="/settings" />
        ) : (
          <ul className="space-y-3">
            {user.education.map((edu, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-4">
                <p className="font-medium text-foreground">{edu.degree}</p>
                <p className="text-sm text-muted-foreground">{edu.institution}</p>
                <p className="text-xs text-muted-foreground">
                  {edu.startYear ?? '—'} – {edu.endYear ?? '—'}
                  {edu.grade && ` · ${edu.grade}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Projects ─────────────────────────────────────────────────────── */}
      <Section title="Projects" icon={<BookOpen className="h-4 w-4" />}>
        {user.projects.length === 0 ? (
          <EmptyHint
            text="No projects listed. Projects are strong evidence for job matching."
            cta="Add a project in Settings"
            href="/settings"
          />
        ) : (
          <ul className="space-y-4">
            {user.projects.map((project, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-4">
                <p className="font-medium text-foreground">
                  {project.link ? (
                    <a href={project.link} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                      {project.name}
                    </a>
                  ) : (
                    project.name
                  )}
                </p>
                {project.description && <p className="text-sm text-foreground">{project.description}</p>}
                {project.technologies && project.technologies.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {project.technologies.map(tech => (
                      <span key={tech} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tech}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Certifications ───────────────────────────────────────────────── */}
      <Section title="Certifications" icon={<Award className="h-4 w-4" />}>
        {user.certifications.length === 0 ? (
          <EmptyHint text="No certifications listed yet." cta="Add certifications in Settings" href="/settings" />
        ) : (
          <ul className="space-y-2">
            {user.certifications.map((cert, i) => (
              <li key={i}>
                <p className="font-medium text-foreground">{cert.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cert.issuer}
                  {cert.issuedOn && ` · ${formatMonth(cert.issuedOn)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Resumes ──────────────────────────────────────────────────────── */}
      <Section title="Resumes" icon={<FileText className="h-4 w-4" />}>
        {resumes.length === 0 ? (
          <EmptyHint text="No saved resume versions yet." cta="Build a resume" href="/resume-builder" />
        ) : (
          <ul className="space-y-2">
            {resumes.map(resume => (
              <li key={resume.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-foreground">
                    {resume.name}
                    {resume.isDefault && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(resume.updatedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <span className="tabular-nums font-semibold text-foreground">
                  {resume.atsScore === null ? 'Not scored' : `${resume.atsScore}/100`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Streak ───────────────────────────────────────────────────────── */}
      <AetherStreakCalendar
        days={heatmap?.days ?? []}
        summary={
          streak
            ? {
                timezone: streak.timezone,
                currentStreak: streak.currentStreak,
                longestStreak: streak.longestStreak,
                activeDays: streak.activeDays,
              }
            : null
        }
        loading={loading}
      />

      {/* ── Recent activity ──────────────────────────────────────────────── */}
      <Section title="Recent activity" icon={<RefreshCw className="h-4 w-4" />}>
        {activity.days.length === 0 ? (
          <p className="text-sm text-muted-foreground">No qualifying activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {activity.days.map(day => (
              <div key={day.date}>
                <p className="text-xs font-semibold text-muted-foreground">{day.label}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {day.entries.map((entry, i) => (
                    <li key={i} className="text-sm text-foreground">
                      <span className="text-muted-foreground">{entry.verb}</span>
                      {entry.entityLabel && <span className="font-medium">: {entry.entityLabel}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      {primaryDetail && primaryDetail.nextActions.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Next steps</h2>
          <ul className="mt-2 space-y-2">
            {primaryDetail.nextActions.map(action => (
              <li key={action.skillSlug} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{action.name}</p>
                  <p className="text-sm text-muted-foreground">{action.reason}</p>
                </div>
                <Link
                  to={action.learningTopicSlug ? `/career-learning/topics/${action.learningTopicSlug}` : '/career-learning'}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Learn
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}