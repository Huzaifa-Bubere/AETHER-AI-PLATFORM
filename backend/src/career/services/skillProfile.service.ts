/**
 * User skill profile service — unified skill evidence with deterministic confidence.
 *
 * Evidence sources (existing AETHER modules):
 *  - Resume analysis skills            → RESUME_EVIDENCE
 *  - Aptitude/Technical MCQ categories → ASSESSMENT_EVIDENCE
 *  - Coding submissions (problem tags) → PROJECT_EVIDENCE
 *  - Interview topic scores            → ASSESSMENT_EVIDENCE
 *  - Completed roadmap nodes           → COMPLETED_LEARNING
 *  - Learning quiz scores              → ASSESSMENT_EVIDENCE
 *
 * Confidence formula (documented, deterministic):
 *   kindScore = score ?? kindDefault   (SELF_DECLARED has no score → 60)
 *   confidence = max over evidences of round(kindWeight × kindScore)
 * The strongest evidence dominates; multiple weak evidences never exceed one strong one.
 */
import { UserSkillProfile, EVIDENCE_WEIGHTS, type ISkillEvidence, type EvidenceKind } from '../models/UserSkillProfile';
import Resume from '../../models/Resume';
import AptitudeAttempt from '../../models/AptitudeAttempt';
import Interview from '../../models/Interview';
import { RoadmapProgress } from '../models/RoadmapProgress';
import { normalizeSkillName } from './skillExtraction';
import logger from '../../utils/logger';

const KIND_DEFAULT_SCORE: Record<EvidenceKind, number> = {
  ASSESSMENT_EVIDENCE: 70,
  PROJECT_EVIDENCE: 70,
  COMPLETED_LEARNING: 75,
  RESUME_EVIDENCE: 65,
  SELF_DECLARED: 60,
};

type RawEvidence = { skillSlug: string; kind: EvidenceKind; score?: number; source?: string; at?: Date };

function pushEvidence(map: Map<string, RawEvidence[]>, e: RawEvidence) {
  if (!e.skillSlug) return;
  const list = map.get(e.skillSlug) || [];
  list.push(e);
  map.set(e.skillSlug, list);
}

function computeConfidence(evidences: RawEvidence[]): { confidence: number; bestEvidence: EvidenceKind } {
  let best = 0;
  let bestKind: EvidenceKind = 'SELF_DECLARED';
  // Evidence-kind strength ordering for tie-breaking.
  const kindOrder: EvidenceKind[] = ['ASSESSMENT_EVIDENCE', 'PROJECT_EVIDENCE', 'COMPLETED_LEARNING', 'RESUME_EVIDENCE', 'SELF_DECLARED'];
  for (const ev of evidences) {
    const base = ev.score ?? KIND_DEFAULT_SCORE[ev.kind];
    const c = Math.round((EVIDENCE_WEIGHTS[ev.kind] ?? 0.3) * Math.max(0, Math.min(100, base)));
    if (c > best || (c === best && kindOrder.indexOf(ev.kind) < kindOrder.indexOf(bestKind))) {
      best = c;
      bestKind = ev.kind;
    }
  }
  return { confidence: best, bestEvidence: bestKind };
}

/** Rebuild the user's whole skill profile from all evidence sources. Idempotent. */
export async function rebuildSkillProfile(userId: string): Promise<void> {
  const raw = new Map<string, RawEvidence[]>();

  // 1. Resume skills → RESUME_EVIDENCE
  try {
    const resume = await Resume.getLatestByUser(new (require('mongoose').Types.ObjectId)(userId));
    const skills: string[] = resume?.analysis?.skills || [];
    for (const s of skills) {
      const norm = normalizeSkillName(s);
      pushEvidence(raw, { skillSlug: norm?.canonical || s.toLowerCase().trim(), kind: 'RESUME_EVIDENCE', source: 'resume', at: resume?.metadata?.lastAnalyzedAt });
    }
  } catch (err) { logger.warn('skillProfile.resume.failed', { err: (err as Error).message }); }

  // 2. Technical MCQ / Aptitude categories → ASSESSMENT_EVIDENCE
  try {
    const attempts = await AptitudeAttempt.find({ user: userId, status: 'completed' })
      .sort({ submittedAt: -1 })
      .limit(10)
      .select('categoryPerformance aiAnalysis.categoryPerformance');
    for (const a of attempts) {
      const cats = [...(a.get('categoryPerformance') || []), ...(a.get('aiAnalysis.categoryPerformance') || [])] as Array<{ category: string; accuracy: number }>;
      for (const c of cats) {
        if (!c?.category || typeof c.accuracy !== 'number') continue;
        const norm = normalizeSkillName(c.category);
        pushEvidence(raw, {
          skillSlug: norm?.canonical || c.category.toLowerCase().trim(),
          kind: 'ASSESSMENT_EVIDENCE',
          score: Math.round(c.accuracy),
          source: 'technical-mcq',
          at: (a as any).submittedAt,
        });
      }
    }
  } catch (err) { logger.warn('skillProfile.aptitude.failed', { err: (err as Error).message }); }

  // 3. Coding submissions (problem tags) → PROJECT_EVIDENCE
  try {
    // Lazy import avoids a hard dependency cycle with the coding module.
    const { CodingSubmission } = require('../../coding/models/CodingSubmission');
    const submissions = await CodingSubmission.find({ userId, status: 'accepted' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('problemId', 'tags')
      .select('problemId');
    for (const sub of submissions) {
      const tags: string[] = (sub as any)?.problemId?.tags || [];
      for (const tag of tags) {
        const norm = normalizeSkillName(tag);
        pushEvidence(raw, { skillSlug: norm?.canonical || tag.toLowerCase().trim(), kind: 'PROJECT_EVIDENCE', score: 75, source: 'coding', at: (sub as any).createdAt });
      }
    }
  } catch (err) { logger.warn('skillProfile.coding.failed', { err: (err as Error).message }); }

  // 4. Interview topic scores → ASSESSMENT_EVIDENCE
  try {
    const interviews = await Interview.find({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('finalAssessment.topicScores analysis.topics');
    for (const iv of interviews) {
      const topics = (iv.get('finalAssessment.topicScores') || iv.get('analysis.topics') || []) as Array<{ topic?: string; topicName?: string; score?: number }>;
      for (const t of topics) {
        const name = t?.topic || t?.topicName;
        if (!name || typeof t.score !== 'number') continue;
        const norm = normalizeSkillName(name);
        pushEvidence(raw, { skillSlug: norm?.canonical || name.toLowerCase().trim(), kind: 'ASSESSMENT_EVIDENCE', score: Math.round(t.score), source: 'interview', at: (iv as any).createdAt });
      }
    }
  } catch (err) { logger.warn('skillProfile.interview.failed', { err: (err as Error).message }); }

  // 5. Completed roadmap nodes → COMPLETED_LEARNING (their node skillSlugs)
  try {
    const progresses = await RoadmapProgress.find({ userId });
    for (const prog of progresses) {
      const completedNodeIds = new Set(prog.nodes.filter(n => n.state === 'COMPLETED').map(n => n.nodeId));
      if (!completedNodeIds.size) continue;
      // Look up node skill slugs from the role definition.
      const { CareerRole } = require('../models/CareerRole');
      const role = await CareerRole.findOne({ slug: prog.roleSlug }).select('roadmapNodes');
      for (const node of role?.roadmapNodes || []) {
        if (!completedNodeIds.has(node.id)) continue;
        for (const slug of node.skillSlugs || []) {
          const quizScores = prog.nodes.find(n => n.nodeId === node.id)?.quizScores || [];
          const bestQuiz = quizScores.length ? Math.max(...quizScores) : undefined;
          pushEvidence(raw, { skillSlug: slug, kind: 'COMPLETED_LEARNING', score: bestQuiz ?? undefined, source: `roadmap:${prog.roleSlug}`, at: prog.updatedAt });
        }
      }
    }
  } catch (err) { logger.warn('skillProfile.roadmap.failed', { err: (err as Error).message }); }

  // Write profile.
  const skills = [...raw.entries()].map(([skillSlug, evidences]) => {
    const { confidence, bestEvidence } = computeConfidence(evidences);
    const typed: ISkillEvidence[] = evidences.map(ev => ({ kind: ev.kind, score: ev.score, source: ev.source, at: ev.at || new Date() }));
    return { skillSlug, confidence, bestEvidence, evidences: typed, updatedAt: new Date() };
  });

  await UserSkillProfile.updateOne(
    { userId: new (require('mongoose').Types.ObjectId)(userId) },
    { $set: { skills, updatedAt: new Date() } },
    { upsert: true },
  );
  logger.info('skillProfile.rebuilt', { userId, skills: skills.length });
}

/** Get the profile, rebuilding first if it has never been built. */
export async function getOrBuildSkillProfile(userId: string) {
  let profile = await UserSkillProfile.findByUser(userId);
  if (!profile) {
    await rebuildSkillProfile(userId);
    profile = await UserSkillProfile.findByUser(userId);
  }
  return profile;
}

/** Merge self-declared skills (lowest evidence tier). */
export async function declareSkills(userId: string, names: string[]): Promise<void> {
  const profile = await getOrBuildSkillProfile(userId);
  const byslug = new Map(profile.skills.map(s => [s.skillSlug, s]));
  for (const name of names) {
    const norm = normalizeSkillName(name);
    const slug = norm?.canonical || name.toLowerCase().trim();
    const displayName = norm?.name || name.trim();
    const existing = byslug.get(slug);
    const evidence: ISkillEvidence = { kind: 'SELF_DECLARED', source: 'self', at: new Date() };
    if (existing) {
      if (!existing.evidences.some(e => e.kind === 'SELF_DECLARED')) existing.evidences.push(evidence);
      const recomputed = computeConfidence(existing.evidences.map(e => ({ skillSlug: slug, kind: e.kind, score: e.score, source: e.source })));
      existing.confidence = recomputed.confidence;
      if (recomputed.confidence > 0) existing.bestEvidence = recomputed.bestEvidence;
      existing.updatedAt = new Date();
    } else {
      const entry = {
        skillSlug: slug,
        confidence: KIND_DEFAULT_SCORE.SELF_DECLARED,
        bestEvidence: 'SELF_DECLARED' as EvidenceKind,
        evidences: [evidence],
        updatedAt: new Date(),
        // Keep display name for UI via dictionary lookup at read time.
        ...(displayName ? {} : {}),
      };
      byslug.set(slug, entry as any);
      profile.skills.push(entry as any);
    }
  }
  await profile.save();
}

/** Confidence lookup map for gap/readiness calculations. */
export async function confidenceMap(userId: string): Promise<Map<string, { confidence: number; bestEvidence: EvidenceKind }>> {
  const profile = await getOrBuildSkillProfile(userId);
  const map = new Map<string, { confidence: number; bestEvidence: EvidenceKind }>();
  for (const s of profile?.skills || []) map.set(s.skillSlug, { confidence: s.confidence, bestEvidence: s.bestEvidence });
  return map;
}
