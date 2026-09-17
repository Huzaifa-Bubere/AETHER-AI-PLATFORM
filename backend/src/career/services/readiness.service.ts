/**
 * Deterministic readiness / gap / recommendation engines.
 * All formulas are pure functions of stored data. Gemini NEVER produces scores.
 *
 * ── READINESS FORMULA ────────────────────────────────────────────────────────
 * For each required skill of the role:
 *   weight(priority): ESSENTIAL=3, RECOMMENDED=2, OPTIONAL=1
 *   earned = weight × (userConfidence(slug) / 100)     (missing skill → 0)
 * Readiness% = round(100 × Σ earned / Σ weight)
 *
 * ── SKILL GAP ────────────────────────────────────────────────────────────────
 * A skill is a gap when confidence < gapThreshold (default 50).
 * Gaps are ordered by: priority weight desc, then market demand desc, then
 * trend boost desc, then name. Deterministic total ordering.
 *
 * ── RECOMMENDATION PRIORITY SCORE ────────────────────────────────────────────
 *   base        = priorityWeight × (1 - confidence/100)      0–3
 *   marketBoost = marketFrequency(0–1) × 1.5                 0–1.5
 *   trendBoost  = TRENDING_UP ? 0.75 : NEW_SIGNAL ? 0.5 : 0  0–0.75
 *   prereqReady = all prerequisites confidence ≥ 60 ? 1 : 0.4
 *   priorityScore = (base + marketBoost + trendBoost) × prereqReady
 * Higher = learn sooner. prerequisites always gate.
 */
import type { ICareerRole, IRoleSkill } from '../models/CareerRole';
import type { ISkillStat } from '../models/market';

export const PRIORITY_WEIGHT: Record<IRoleSkill['priority'], number> = {
  ESSENTIAL: 3,
  RECOMMENDED: 2,
  OPTIONAL: 1,
};

export const GAP_THRESHOLD = 50;
const PREREQ_READY_THRESHOLD = 60;

export interface SkillDemand {
  /** percentage of postings requesting the skill, 0–100 */
  frequency?: number;
  /** POPULAR | TRENDING_UP | STABLE | TRENDING_DOWN | NEW_SIGNAL */
  trend?: string;
}

export interface GapItem {
  skillSlug: string;
  name: string;
  priority: IRoleSkill['priority'];
  priorityWeight: number;
  confidence: number;
  gapSize: number; // weight × (1 - conf/100), pre-market
  demand?: SkillDemand;
  priorityScore: number;
  reasons: string[];
  hasRoadmapNode: boolean;
  nodeId?: string;
}

export interface ReadinessResult {
  readiness: number;
  skillsMatched: number;
  skillsTotal: number;
  essentialMatched: number;
  essentialTotal: number;
  gaps: GapItem[];
  matched: Array<{ skillSlug: string; name: string; confidence: number; priority: IRoleSkill['priority'] }>;
}

export function computeReadiness(
  role: ICareerRole,
  confidence: Map<string, number>,
  demand?: Map<string, SkillDemand>,
): ReadinessResult {
  let totalWeight = 0;
  let earnedWeight = 0;
  let skillsMatched = 0;
  let essentialMatched = 0;
  let essentialTotal = 0;
  const gaps: GapItem[] = [];
  const matched: ReadinessResult['matched'] = [];

  // Map skillSlug → first roadmap node containing it (for CTA + prereq checks).
  const nodeBySlug = new Map<string, { nodeId: string }>();
  for (const node of role.roadmapNodes || []) {
    for (const slug of node.skillSlugs || []) {
      if (!nodeBySlug.has(slug)) nodeBySlug.set(slug, { nodeId: node.id });
    }
  }
  const nodeById = new Map((role.roadmapNodes || []).map(n => [n.id, n]));

  for (const rs of role.skills || []) {
    const weight = PRIORITY_WEIGHT[rs.priority] ?? 1;
    totalWeight += weight;
    const conf = confidence.get(rs.skillSlug) ?? 0;
    earnedWeight += weight * (Math.max(0, Math.min(100, conf)) / 100);
    if (conf >= GAP_THRESHOLD) {
      skillsMatched++;
      if (rs.priority === 'ESSENTIAL') essentialMatched++;
      matched.push({ skillSlug: rs.skillSlug, name: rs.name, confidence: conf, priority: rs.priority });
    } else {
      if (rs.priority === 'ESSENTIAL') essentialTotal++;
      const dem = demand?.get(rs.skillSlug);
      const base = weight * (1 - conf / 100);
      const marketBoost = ((dem?.frequency ?? 0) / 100) * 1.5;
      const trendBoost = dem?.trend === 'TRENDING_UP' ? 0.75 : dem?.trend === 'NEW_SIGNAL' ? 0.5 : 0;
      // Prerequisite readiness: all prerequisite nodes' skills confident enough.
      const node = nodeBySlug.get(rs.skillSlug);
      const nodeDef = node ? nodeById.get(node.nodeId) : undefined;
      const prereqSlugs = (nodeDef?.prerequisites || [])
        .flatMap(pid => nodeById.get(pid)?.skillSlugs || []);
      const prereqReady = prereqSlugs.length === 0 || prereqSlugs.every(s => (confidence.get(s) ?? 0) >= PREREQ_READY_THRESHOLD);
      const priorityScore = (base + marketBoost + trendBoost) * (prereqReady ? 1 : 0.4);

      const reasons: string[] = [
        `Part of the ${role.name} roadmap (${rs.priority.toLowerCase()} skill).`,
        conf > 0 ? `Your current evidence is weak (confidence ${conf}/100).` : 'Your profile has no verified evidence for this skill.',
      ];
      if (dem?.frequency != null) reasons.push(`Requested in ${Math.round(dem.frequency)}% of the analyzed market snapshot postings.`);
      if (dem?.trend === 'TRENDING_UP') reasons.push('Demand is increasing in the latest snapshot.');
      if (prereqReady) reasons.push('You have already completed its prerequisites.');

      gaps.push({
        skillSlug: rs.skillSlug,
        name: rs.name,
        priority: rs.priority,
        priorityWeight: weight,
        confidence: conf,
        gapSize: Math.round(base * 100) / 100,
        demand: dem,
        priorityScore: Math.round(priorityScore * 100) / 100,
        reasons,
        hasRoadmapNode: !!node,
        nodeId: node?.nodeId,
      });
    }
  }

  gaps.sort((a, b) =>
    b.priorityScore - a.priorityScore ||
    b.priorityWeight - a.priorityWeight ||
    (b.demand?.frequency ?? 0) - (a.demand?.frequency ?? 0) ||
    a.name.localeCompare(b.name));

  return {
    readiness: totalWeight ? Math.round((earnedWeight / totalWeight) * 100) : 0,
    skillsMatched,
    skillsTotal: (role.skills || []).length,
    essentialMatched,
    essentialTotal,
    gaps,
    matched: matched.sort((a, b) => b.confidence - a.confidence),
  };
}

/** Weekly learning plan that strictly follows prerequisite order. */
export interface WeeklyPlanItem {
  week: number;
  nodeIds: string[];
  title: string;
  estimatedHours: number;
}

export function buildWeeklyPlan(
  role: ICareerRole,
  confidence: Map<string, number>,
  hoursPerWeek: number,
  targetWeeks?: number,
): WeeklyPlanItem[] {
  const nodes = role.roadmapNodes || [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const completed = new Set(
    nodes.filter(n => (n.skillSlugs || []).every(s => (confidence.get(s) ?? 0) >= GAP_THRESHOLD)).map(n => n.id),
  );
  // Topological order (prerequisites first), skipping already-learned nodes.
  const ordered: typeof nodes = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || visiting.has(id)) return;
    const n = byId.get(id);
    if (!n) return;
    visiting.add(id);
    for (const p of n.prerequisites || []) visit(p);
    visiting.delete(id);
    visited.add(id);
    ordered.push(n);
  };
  for (const n of nodes) visit(n.id);

  const remaining = ordered.filter(n => !completed.has(n.id));
  const plan: WeeklyPlanItem[] = [];
  let week = 1;
  let buffer: string[] = [];
  let hours = 0;
  const maxWeeks = targetWeeks ?? Math.ceil(remaining.reduce((s, n) => s + (n.estimatedHours || 4), 0) / Math.max(1, hoursPerWeek));
  for (const node of remaining) {
    const h = node.estimatedHours || 4;
    if (hours + h > hoursPerWeek && buffer.length) {
      plan.push({ week, nodeIds: buffer, title: buffer.map(id => byId.get(id)?.title || id).join(' + '), estimatedHours: hours });
      week++;
      if (week > maxWeeks) break;
      buffer = [];
      hours = 0;
    }
    buffer.push(node.id);
    hours += h;
  }
  if (buffer.length) plan.push({ week, nodeIds: buffer, title: buffer.map(id => byId.get(id)?.title || id).join(' + '), estimatedHours: hours });
  return plan;
}
