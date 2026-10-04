import { useEffect, useMemo, useState } from 'react';
import { fetchProfessionalProfile } from '../../services/profile';

/**
 * Resume skill-gap.
 *
 * The backend returns `missingSkills: []` unconditionally — there is nothing to
 * compare against there. A resume has no target role of its own, so the
 * comparison source is the candidate's SELECTED target role(s) from Career
 * Intelligence, which the profile endpoint already returns. No backend change is
 * needed and nothing is invented.
 *
 * A requirement counts as missing when the resume never mentions it AND the
 * candidate has no stored evidence for it (`currentLevel === null`). Skills the
 * platform already evidences are reported separately so the panel never
 * contradicts the dashboard.
 */

export interface SkillGapRole {
  roleSlug: string;
  roleName: string;
  isPrimary: boolean;
  /** requirements the resume does not mention and that have no stored evidence */
  missing: Array<{ name: string; priority: string; learningTopicSlug: string | null }>;
  /** requirements the resume already mentions */
  matched: number;
  total: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, '');

/** Loose containment so "c++" matches "cpp", "node.js" matches "node". */
function mentions(haystack: Set<string>, needle: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  if (haystack.has(n)) return true;
  for (const token of haystack) {
    if (!token) continue;
    if (token === n || token.includes(n) || n.includes(token)) return true;
  }
  return false;
}

export function useResumeSkillGap(extractedSkills: string[], enabled: boolean) {
  const [roles, setRoles] = useState<SkillGapRole[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetchProfessionalProfile()
      .then(profile => {
        if (cancelled) return;
        const targetRoles = profile?.targetRoles ?? [];
        if (targetRoles.length === 0) { setRoles([]); return; }

        const resumeTokens = new Set(extractedSkills.map(norm));
        const next: SkillGapRole[] = [];

        for (const role of targetRoles) {
          const detail = profile.roleProgress?.detail?.[role.roleSlug];
          if (!detail?.requirements?.length) continue;

          const missing: SkillGapRole['missing'] = [];
          let matched = 0;

          for (const req of detail.requirements) {
            const alreadyEvidenced = req.currentLevel !== null && req.currentLevel > 0;
            const onResume = mentions(resumeTokens, req.name) || mentions(resumeTokens, req.skillSlug);
            if (onResume || alreadyEvidenced) { matched++; continue; }
            missing.push({
              name: req.name,
              priority: req.priority,
              learningTopicSlug: req.learningTopicSlug,
            });
          }

          // Essentials first, then recommended.
          missing.sort((a, b) => {
            const rank = (p: string) => (p === 'ESSENTIAL' ? 0 : p === 'RECOMMENDED' ? 1 : 2);
            return rank(a.priority) - rank(b.priority);
          });

          next.push({
            roleSlug: role.roleSlug,
            roleName: role.roleName,
            isPrimary: !!role.isPrimary,
            missing,
            matched,
            total: detail.requirements.length,
          });
        }
        setRoles(next);
      })
      .catch(() => { if (!cancelled) setRoles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [extractedSkills, enabled]);

  const summary = useMemo(() => {
    const list = roles ?? [];
    const all = list.flatMap(r => r.missing.map(m => m.name));
    return {
      hasRoles: list.length > 0,
      roles: list,
      /** de-duplicated across roles, essentials first */
      missing: [...new Set(all)].slice(0, 24),
      total: all.length,
    };
  }, [roles]);

  return { ...summary, loading, available: roles !== null };
}