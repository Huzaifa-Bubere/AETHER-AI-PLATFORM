/**
 * AETHER — Resume ⇄ Job Description match (spec §1F, §1G).
 *
 * Direction matters: the JOB DESCRIPTION states the requirements and the RESUME
 * is checked for evidence of them. The previous client-side logic did the
 * reverse (it reported resume skills that were absent from the JD), which is
 * meaningless — a resume is allowed to contain skills the posting never asked
 * for.
 *
 * This reuses the SAME deterministic JD parser as Job Fit
 * (`parseJobRequirements`) and the SAME canonical skill dictionary
 * (`extractSkills`), so AETHER has one JD understanding, not two.
 */

import { parseJobRequirements } from '../jobs/services/jobFit.service';
import { extractSkills, normalizeSkillName } from '../career/services/skillExtraction';
import { normalizeSkillEntries } from './resumeSkills';

export interface SkillRef { slug: string; label: string; importance: 'REQUIRED' | 'PREFERRED' }

export interface ResumeJobMatchComponent {
  key: string;
  label: string;
  weight: number;
  earned: number;
  basis: string;
}

export interface ResumeJobMatchResult {
  score: number;
  requiredSkills: SkillRef[];
  preferredSkills: SkillRef[];
  matchedSkills: SkillRef[];
  missingSkills: SkillRef[];
  components: ResumeJobMatchComponent[];
  suggestions: string[];
}

/** Documented weights (total 100). */
export const RESUME_JD_WEIGHTS = { REQUIRED: 70, PREFERRED: 30 } as const;

function humanize(slug: string): string {
  const known = normalizeSkillName(slug)?.name;
  if (known) return known;
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map(part => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
}

/**
 * Compare a stored, parsed resume against a job description.
 * `resumeText` should be the extracted raw text; `resumeSkills` the canonical
 * skill entries already derived from the resume.
 */
export async function matchResumeToJobDescription(input: {
  jobDescription: string;
  resumeText: string;
  resumeSkills: Array<{ slug: string; label: string }>;
  roleSlug?: string | null;
}): Promise<ResumeJobMatchResult> {
  const jd = String(input.jobDescription || '').trim();
  const parsed = await parseJobRequirements(jd, input.roleSlug ?? null);

  // Resume evidence = canonical parsed skills + any dictionary skill present in
  // the resume text. Never inferred beyond what the document actually says.
  //
  // The resume and JD sides use two different skill dictionaries, so we compare
  // on a LOOSE key (separators stripped) so "node.js" and "nodejs" still match.
  const loose = (slug: string) => String(slug || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
  const evidenceSlugs = new Set<string>(input.resumeSkills.map(s => loose(s.slug)));
  const evidenceLabels = new Map<string, string>(input.resumeSkills.map(s => [loose(s.slug), s.label]));
  const labelled = extractSkills(input.resumeText || '');
  for (const slug of labelled.skills) {
    const key = loose(slug);
    evidenceSlugs.add(key);
    if (!evidenceLabels.has(key)) evidenceLabels.set(key, humanize(slug));
  }

  const allSkills: SkillRef[] = parsed.requirements
    .filter(r => !!r.skillSlug)
    .map(r => ({ slug: r.skillSlug as string, label: humanize(r.skillSlug as string), importance: r.importance }));

  // Deduplicate (a skill may appear in prose and in a requirement bullet).
  const dedupe = new Map<string, SkillRef>();
  for (const skill of allSkills) {
    const existing = dedupe.get(skill.slug);
    if (!existing || (existing.importance === 'PREFERRED' && skill.importance === 'REQUIRED')) {
      dedupe.set(skill.slug, skill);
    }
  }
  const requirements = [...dedupe.values()];

  const requiredSkills = requirements.filter(r => r.importance === 'REQUIRED');
  const preferredSkills = requirements.filter(r => r.importance === 'PREFERRED');
  const isEvidenced = (r: SkillRef) => evidenceSlugs.has(loose(r.slug));
  const matchedSkills = requirements.filter(isEvidenced);
  const missingSkills = requirements.filter(r => !isEvidenced(r));

  const coverage = (list: SkillRef[]) => (list.length === 0 ? null : list.filter(isEvidenced).length / list.length);
  const requiredCoverage = coverage(requiredSkills);
  const preferredCoverage = coverage(preferredSkills);

  const components: ResumeJobMatchComponent[] = [];
  // When a dimension has no requirements, its weight is redistributed to the
  // other instead of being silently counted as zero (spec §56).
  const requiredWeight = requiredCoverage === null ? 0 : preferredCoverage === null ? 100 : RESUME_JD_WEIGHTS.REQUIRED;
  const preferredWeight = preferredCoverage === null ? 0 : requiredCoverage === null ? 100 : RESUME_JD_WEIGHTS.PREFERRED;

  if (requiredCoverage !== null && requiredWeight > 0) {
    components.push({
      key: 'required', label: 'Required skill coverage', weight: requiredWeight,
      earned: Math.round(requiredCoverage * requiredWeight),
      basis: `${requiredSkills.filter(isEvidenced).length} of ${requiredSkills.length} required skills evidenced on the resume.`,
    });
  }
  if (preferredCoverage !== null && preferredWeight > 0) {
    components.push({
      key: 'preferred', label: 'Preferred skill coverage', weight: preferredWeight,
      earned: Math.round(preferredCoverage * preferredWeight),
      basis: `${preferredSkills.filter(isEvidenced).length} of ${preferredSkills.length} preferred skills evidenced on the resume.`,
    });
  }

  if (requirements.length === 0) {
    return {
      score: 0, requiredSkills, preferredSkills, matchedSkills, missingSkills,
      components: [{
        key: 'required', label: 'Required skill coverage', weight: 100, earned: 0,
        basis: 'No recognisable skills were detected in this job description. No score can be computed.',
      }],
      suggestions: ['Paste the full requirements section — the description contained no recognisable skills.'],
    };
  }

  const score = Math.max(0, Math.min(100, components.reduce((sum, c) => sum + c.earned, 0)));

  const suggestions = missingSkills
    .filter(s => s.importance === 'REQUIRED')
    .slice(0, 6)
    .map(s => `Not evidenced: ${s.label}. Add a real project or experience bullet describing ${s.label} — only if you genuinely have it.`);

  if (suggestions.length === 0 && missingSkills.length > 0) {
    suggestions.push('All required skills are evidenced. Preferred skills you could strengthen: ' +
      missingSkills.slice(0, 6).map(s => s.label).join(', ') + '.');
  }
  if (missingSkills.length === 0) {
    suggestions.push('This resume evidences every skill detected in the job description.');
  }

  return { score, requiredSkills, preferredSkills, matchedSkills, missingSkills, components, suggestions };
}

/** Resume-side evidence helper used by the route. */
export function resumeSkillRefs(raw: unknown): Array<{ slug: string; label: string }> {
  return normalizeSkillEntries(raw).map(e => ({ slug: e.slug, label: e.label }));
}
