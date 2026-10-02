import {
  type EvidenceSummary,
  type RequiredLevel,
  type SkillEvidenceLookup,
} from './roleProgress.service';
import { confidenceMap, getOrBuildSkillProfile } from './skillProfile.service';
import type { EvidenceKind, ISkillEvidence } from '../models/UserSkillProfile';
import { REQUIRED_LEVEL_LABELS } from '../models/CareerRole';
import { normalizeSkillName } from './skillExtraction';
import logger from '../../utils/logger';

/**
 * SkillEvidenceService (spec §19, §38, §90–§92, §101).
 *
 * Turns the stored evidence profile into the two things the rest of AETHER
 * needs: a 1–4 skill LEVEL for the role requirement matrix, and a per-source
 * breakdown so the profile can show *why* a skill is at that level instead of
 * an unexplained percentage bar.
 *
 * This is the live SkillEvidenceLookup that RoleProgressService consumes, which
 * is what guarantees the dashboard, the profile and the career pages all read
 * one implementation (spec §93).
 */

/**
 * Confidence (0–100, from the weighted evidence formula in skillProfile.service)
 * → required level 1–4. Documented and fixed, never per-skill.
 */
export const LEVEL_CONFIDENCE_BOUNDS: Array<{ min: number; level: RequiredLevel }> = [
  { min: 85, level: 4 },
  { min: 65, level: 3 },
  { min: 40, level: 2 },
  { min: 0, level: 1 },
];

/**
 * A self-declared skill can never exceed Foundation on its own. The weighted
 * formula already caps it well below level 2, but the cap is explicit so a
 * future weight change cannot silently promote "I know Docker" to Job Ready.
 */
export const SELF_DECLARED_MAX_LEVEL: RequiredLevel = 1;

export function levelFromConfidence(confidence: number, bestEvidence: EvidenceKind): RequiredLevel {
  if (bestEvidence === 'SELF_DECLARED') return Math.min(SELF_DECLARED_MAX_LEVEL, 1) as RequiredLevel;
  const bounded = Math.max(0, Math.min(100, confidence));
  for (const bound of LEVEL_CONFIDENCE_BOUNDS) {
    if (bounded >= bound.min) return bound.level;
  }
  return 1;
}

/**
 * Map the stored evidence kinds onto the eight buckets the profile UI shows
 * (spec §91). A skill can have several at once, e.g. Docker evidenced by a
 * resume mention AND a completed project.
 */
function emptySummary(): EvidenceSummary {
  return {
    resume: null,
    technical: null,
    coding: null,
    interview: null,
    learning: null,
    project: null,
    selfDeclared: null,
  };
}

function bucketFor(kind: EvidenceKind): keyof EvidenceSummary {
  switch (kind) {
    case 'RESUME_EVIDENCE':
      return 'resume';
    case 'COMPLETED_LEARNING':
      return 'learning';
    case 'PROJECT_EVIDENCE':
      return 'project';
    case 'SELF_DECLARED':
      return 'selfDeclared';
    case 'ASSESSMENT_EVIDENCE':
    default:
      // The two assessment sources are distinguished by their `source` string,
      // which the rebuild step records as 'technical-mcq', 'topic-quiz:*',
      // 'adaptive-interview:*' or 'interview'.
      return 'technical';
  }
}

function isQuizSource(source?: string): boolean {
  return typeof source === 'string' && source.startsWith('topic-quiz:');
}

function isInterviewSource(source?: string): boolean {
  return (
    typeof source === 'string' &&
    (source.startsWith('adaptive-interview:') || source === 'interview')
  );
}

function isTechnicalSource(source?: string): boolean {
  return typeof source === 'string' && source.startsWith('technical-mcq');
}

/**
 * Build the per-source summary. Each bucket keeps the BEST (highest) score seen
 * from that source rather than an average — a single 90% technical score is
 * more informative than a mean dragged down by one bad attempt.
 */
export function summariseEvidence(evidences: ISkillEvidence[]): EvidenceSummary {
  const summary = emptySummary();
  for (const ev of evidences) {
    let bucket = bucketFor(ev.kind);
    if (bucket === 'technical') {
      if (isQuizSource(ev.source)) bucket = 'learning';
      else if (isInterviewSource(ev.source)) bucket = 'interview';
      else if (isTechnicalSource(ev.source)) bucket = 'technical';
      else bucket = 'learning';
    }
    const score = typeof ev.score === 'number' ? ev.score : null;
    const existing = summary[bucket];
    if (existing && existing.score !== null && (score === null || score <= existing.score)) continue;
    summary[bucket] = { score, note: ev.source };
  }
  return summary;
}

export interface SkillLevelDetail {
  skillSlug: string;
  level: RequiredLevel;
  levelLabel: string;
  confidence: number;
  bestEvidence: EvidenceKind;
  evidence: EvidenceSummary;
}

/**
 * Resolve the full level detail for one skill, or null when the candidate has
 * no evidence for it at all (which the matrix reports as NOT_ASSESSED).
 */
export async function getSkillLevel(
  userId: string,
  skillSlug: string,
): Promise<SkillLevelDetail | null> {
  const slug = normalizeSkillName(skillSlug)?.canonical ?? String(skillSlug).toLowerCase().trim();
  const profile = await getOrBuildSkillProfile(userId);
  const entry = profile?.skills?.find(s => s.skillSlug === slug);
  if (!entry) return null;

  const level = levelFromConfidence(entry.confidence, entry.bestEvidence);
  return {
    skillSlug: slug,
    level,
    levelLabel: REQUIRED_LEVEL_LABELS[level],
    confidence: entry.confidence,
    bestEvidence: entry.bestEvidence,
    evidence: summariseEvidence(entry.evidences ?? []),
  };
}

export interface SkillProfileSnapshot {
  userId: string;
  skills: SkillLevelDetail[];
  calculatedFrom: string;
  totalEvidenced: number;
}

/**
 * Every evidenced skill for a user, with levels and per-source breakdowns.
 * Feeds the profile skills section (spec §27) and the job-fit explanation.
 */
export async function getSkillProfileSnapshot(
  userId: string,
  options: { rebuild?: boolean } = {},
): Promise<SkillProfileSnapshot> {
  if (options.rebuild) {
    const { rebuildSkillProfile } = await import('./skillProfile.service');
    await rebuildSkillProfile(userId);
  }
  const profile = await getOrBuildSkillProfile(userId);
  const skills = (profile?.skills ?? [])
    .filter(s => (s.evidences?.length ?? 0) > 0)
    .map(s => {
      const level = levelFromConfidence(s.confidence, s.bestEvidence);
      return {
        skillSlug: s.skillSlug,
        level,
        levelLabel: REQUIRED_LEVEL_LABELS[level],
        confidence: s.confidence,
        bestEvidence: s.bestEvidence,
        evidence: summariseEvidence(s.evidences ?? []),
      };
    })
    .sort((a, b) => b.level - a.level || b.confidence - a.confidence);

  return {
    userId,
    skills,
    calculatedFrom: 'user_skill_profile',
    totalEvidenced: skills.length,
  };
}

/**
 * The live lookup RoleProgressService calls for every role requirement.
 *
 * The whole profile is fetched ONCE and served from memory, so computing
 * progress for a role with 20 requirements does not issue 20 round trips.
 * A lookup failure degrades to "no evidence" rather than failing the request.
 */
export function createSkillEvidenceLookup(userId: string): SkillEvidenceLookup {
  let cache: Map<string, SkillLevelDetail> | null = null;
  let inFlight: Promise<Map<string, SkillLevelDetail>> | null = null;

  const load = async (): Promise<Map<string, SkillLevelDetail>> => {
    const snapshot = await getSkillProfileSnapshot(userId);
    return new Map(snapshot.skills.map(s => [s.skillSlug, s]));
  };

  return {
    async levelFor(skillSlug: string) {
      try {
        if (!cache) {
          inFlight = inFlight ?? load();
          cache = await inFlight;
        }
        const slug = normalizeSkillName(skillSlug)?.canonical ?? String(skillSlug).toLowerCase().trim();
        const detail = cache.get(slug);
        if (!detail) return null;
        return { level: detail.level, evidence: detail.evidence as EvidenceSummary };
      } catch (error) {
        logger.warn('[skillEvidence] lookup failed', { skillSlug, err: (error as Error).message });
        return null;
      }
    },
  };
}

/** Convenience map of skillSlug → confidence, used by readiness ordering. */
export async function skillConfidenceMap(userId: string): Promise<Map<string, number>> {
  const map = await confidenceMap(userId);
  return new Map([...map.entries()].map(([slug, v]) => [slug, v.confidence]));
}
