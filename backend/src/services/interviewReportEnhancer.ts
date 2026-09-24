import type { IAdaptiveInterview } from '../models/AdaptiveInterview';

/**
 * AETHER Interview — report enricher.
 * Builds the cross-question trail (parent → child with evidence) and
 * learning recommendations linked to Career Learning topics (spec §42–43).
 */

export interface IFollowUpTrailItem {
  questionId: string;
  parentQuestionId: string | null;
  questionText: string;
  topic: string;
  depth: string;
  triggerText: string;
  reason: string;
  decidedBy: 'heuristic' | 'ai' | 'none';
}

/** Parent→child follow-up chain with stored evidence. */
export function followUpTrail(session: IAdaptiveInterview): IFollowUpTrailItem[] {
  const byId = new Map(session.questions.map(q => [q.id, q]));
  return session.questions.map(q => ({
    questionId: q.id,
    parentQuestionId: q.basedOn || null,
    questionText: q.text,
    topic: q.topic,
    depth: q.depth,
    triggerText: q.followUpEvidence?.triggerText || '',
    reason: q.followUpEvidence?.reason || '',
    decidedBy: q.followUpEvidence?.decidedBy || 'none',
  }));
}

export interface ILearningRecommendation {
  skill: string;
  reason: string;
  /** Career Learning roadmap topic to open, when mappable */
  learningPath?: string;
  cta: 'START_LEARNING';
}

/**
 * Map weak interview topics to Career Learning recommendations.
 * Deterministic: weak = topic avg < 55, or missing keywords repeated ≥ 2×.
 */
export function learningRecommendations(session: IAdaptiveInterview): ILearningRecommendation[] {
  const recs: ILearningRecommendation[] = [];
  const seen = new Set<string>();

  const push = (skill: string, reason: string) => {
    const key = skill.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    recs.push({ skill, reason, learningPath: skill, cta: 'START_LEARNING' });
  };

  for (const t of session.report?.topicPerformance || []) {
    if (t.avgScore < 55) {
      push(t.topic, `${t.topic}: scored ${t.avgScore}/100 across ${t.questionsAsked} question(s).`);
    }
  }

  // Repeated missing keywords across answers = a knowledge gap signal.
  const missingCount = new Map<string, number>();
  for (const r of session.responses) {
    for (const k of r.missingKeywords || []) {
      missingCount.set(k, (missingCount.get(k) || 0) + 1);
    }
  }
  for (const [kw, count] of missingCount) {
    if (count >= 2) push(kw, `Missed "${kw}" in ${count} different answers.`);
  }

  return recs.slice(0, 6);
}
