import { useMemo } from 'react';
import { ChevronDown, Target } from 'lucide-react';
import type { RoleProgressSummary } from '../../services/roleProgress';

/**
 * Role selector (spec §10).
 *
 * Switches the dashboard between the candidate's target roles. Each role shows
 * its REAL readiness from RoleProgressService — there is no placeholder and no
 * invented percentage, and a role with nothing assessed renders as "Not
 * assessed" rather than 0%.
 */

export interface RoleSelectorProps {
  roles: RoleProgressSummary[];
  selected: string | null;
  onSelect: (roleSlug: string) => void;
  loading?: boolean;
}

const ALL_ROLES = '__all__';

export function RoleSelector({ roles, selected, onSelect, loading = false }: RoleSelectorProps) {
  const current = roles.find(r => r.roleSlug === selected) ?? roles[0] ?? null;

  const bars = useMemo(
    () =>
      roles.map(role => ({
        slug: role.roleSlug,
        name: role.roleName,
        // Null readiness = nothing assessed yet. Rendered as a muted track with
        // an explicit label, never as a 0% bar.
        readiness: role.readiness,
        width: role.readiness === null ? 0 : Math.max(2, Math.min(100, role.readiness)),
        isPrimary: role.isPrimary,
      })),
    [roles],
  );

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-border bg-card" aria-label="Loading roles" />
    );
  }

  if (roles.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground">
          <Target className="h-4 w-4 text-primary" />
          Target roles
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have not chosen a target role yet. Pick one on the Career Learning page and your
          dashboard, requirements and job matching all centre on it.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground">
          <Target className="h-4 w-4 text-primary" />
          Role readiness
        </h2>

        {roles.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Select role</span>
            <select
              value={selected ?? current?.roleSlug ?? ''}
              onChange={e => onSelect(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            >
              <option value={ALL_ROLES} disabled>
                All roles
              </option>
              {roles.map(role => (
                <option key={role.roleSlug} value={role.roleSlug}>
                  {role.roleName}
                  {role.isPrimary ? ' (primary)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          </label>
        )}
      </div>

      {/* Horizontal bar chart — real values, one row per target role. */}
      <ul className="space-y-3">
        {bars.map(role => {
          const active = role.slug === (selected ?? current?.roleSlug);
          return (
            <li key={role.slug}>
              <button
                type="button"
                onClick={() => onSelect(role.slug)}
                aria-pressed={active}
                className="w-full text-left"
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={`font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {role.name}
                    {role.isPrimary && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Primary
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {role.readiness === null ? (
                      <span className="italic">Not assessed</span>
                    ) : (
                      `${role.readiness}%`
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  {role.readiness !== null && (
                    <div
                      className={`h-full rounded-full transition-all ${active ? 'bg-primary' : 'bg-primary/50'}`}
                      style={{ width: `${role.width}%` }}
                    />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
