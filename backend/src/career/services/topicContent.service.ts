import mongoose, { Document } from 'mongoose';
import { LearningTopic, ILearningTopic, ITopicBlock } from '../models/LearningTopic';
import { TopicProgress, TopicState } from '../models/TopicProgress';
import { LearningVideo } from '../models/LearningVideo';
import logger from '../../utils/logger';
import { recordActivity } from '../../services/activity.service';

/**
 * AETHER Career Learning — topic content service (spec §28–§59).
 *
 * Everything the topic page needs comes from the database. Gemini is strictly
 * supplementary: with the AI offline the lesson is still 100% readable.
 */

export const TOPIC_STATES: TopicState[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEW_NEEDED'];

export interface ITopicNavItem {
  slug: string;
  title: string;
  group: string;
  level: string;
  estimatedMinutes: number;
  order: number;
  state: TopicState;
  bookmarked: boolean;
  /** unavailable until every prerequisite is COMPLETED */
  locked: boolean;
  hasQuiz: boolean;
  hasVideo: boolean;
}

export interface ITopicPage {
  topic: Omit<ILearningTopic, keyof Document> & { id: string };
  progress: {
    state: TopicState;
    bookmarked: boolean;
    notes: string;
    lastBlockIndex: number;
    bestQuizScore: number | null;
    attempts: number;
  };
  prerequisites: Array<{ slug: string; title: string; state: TopicState; optional: boolean; estimatedMinutes: number }>;
  locked: boolean;
  nextTopics: Array<{ slug: string; title: string; shortDescription: string; level: string; estimatedMinutes: number }>;
  relatedTopics: Array<{ slug: string; title: string; shortDescription: string; level: string }>;
  videos: Array<{
    youtubeVideoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    duration: string;
    durationSeconds: number | null;
    viewCount: number | null;
    likeCount: number | null;
    publishedAt: Date | null;
    rankingScore: number;
    rankingReasons: string[];
    fetchedAt: Date;
    /** "Highly viewed, relevant video" / "Recommended for this topic" */
    label: string;
  }>;
  videoStatus: {
    configured: boolean;
    available: boolean;
    credentialRequest: string | null;
    lastFetchedAt: Date | null;
  };
  stats: {
    totalBlocks: number;
    exampleCount: number;
    practiceCount: number;
    quizCount: number;
  };
}

function asState(value: string | undefined | null): TopicState {
  return (TOPIC_STATES as string[]).includes(String(value)) ? (value as TopicState) : 'NOT_STARTED';
}

/**
 * Strip the answer key from a topic quiz before it leaves the server (spec §57).
 * Grading happens in `gradeTopicQuiz`; the client must never receive
 * `correctIndex` or the explanation before it submits.
 */
export function sanitizeTopicQuiz(
  questions: Array<{ id: string; question: string; options: string[]; difficulty?: string; topicTag?: string }>,
): Array<{ id: string; question: string; options: string[]; difficulty: string; topicTag: string }> {
  return (questions || []).map(q => ({
    id: q.id,
    question: q.question,
    options: q.options,
    difficulty: q.difficulty || 'beginner',
    topicTag: q.topicTag || 'general',
  }));
}

// ── Navigation ───────────────────────────────────────────────────────────────

/**
 * The course-navigation column (spec §48). Only published topics appear; each
 * item carries the user's persisted state so the column survives a refresh.
 */
export async function listTopicNav(userId?: string, options: { group?: string; roleSlug?: string } = {}): Promise<ITopicNavItem[]> {
  const query: any = { status: 'published' };
  if (options.group) query.group = options.group;
  if (options.roleSlug) query.roleSlugs = options.roleSlug;

  const topics = await LearningTopic.find(query)
    .select('slug title group level estimatedMinutes order prerequisites quiz relatedTopicSlugs nextTopicSlugs')
    .sort({ order: 1, title: 1 })
    .lean();

  const progressBySlug = new Map<string, { state: TopicState; bookmarked: boolean }>();
  if (userId) {
    const rows = await TopicProgress.find({ userId: new mongoose.Types.ObjectId(userId) })
      .select('topicSlug state bookmarked').lean();
    for (const r of rows) progressBySlug.set(r.topicSlug, { state: asState(r.state), bookmarked: !!r.bookmarked });
  }

  const completed = new Set(
    [...progressBySlug.entries()].filter(([, v]) => v.state === 'COMPLETED').map(([k]) => k)
  );

  const videoSlugs = new Set(
    (await LearningVideo.find({ active: true }).select('topicSlug').lean()).map(v => v.topicSlug)
  );

  return topics.map(t => {
    const state = progressBySlug.get(t.slug)?.state || 'NOT_STARTED';
    const locked = (t.prerequisites || []).some(p => p && !completed.has(p));
    return {
      slug: t.slug,
      title: t.title,
      group: t.group || 'General',
      level: t.level,
      estimatedMinutes: t.estimatedMinutes,
      order: t.order,
      state,
      bookmarked: progressBySlug.get(t.slug)?.bookmarked || false,
      locked,
      hasQuiz: (t.quiz || []).length > 0,
      hasVideo: videoSlugs.has(t.slug),
    };
  });
}

// ── Topic page ───────────────────────────────────────────────────────────────

function videoLabel(video: { viewCount: number | null; likeCount: number | null; relevanceScore: number }): string {
  // Never claim "most viewed/most liked on YouTube" — we only know this
  // candidate set. Wording reflects what the data actually supports.
  if (video.viewCount != null && video.viewCount >= 500_000) return 'Highly viewed, relevant video';
  if (video.viewCount != null && video.viewCount >= 50_000) return 'Popular recommended video';
  return 'Recommended for this topic';
}

export async function getTopicPage(userId: string | undefined, slug: string): Promise<ITopicPage | null> {
  const topic = await LearningTopic.findOne({ slug: String(slug).toLowerCase(), status: 'published' }).lean();
  if (!topic) return null;

  // ── persisted progress ────────────────────────────────────────────────────
  let progress: any = null;
  if (userId) {
    progress = await TopicProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      topicSlug: topic.slug,
    }).lean();
  }

  // ── prerequisite states ───────────────────────────────────────────────────
  const prereqSlugs = (topic.prerequisites || []).filter(Boolean);
  const optionalSlugs = (topic.optionalPrerequisites || []).filter(Boolean);
  const prereqTopics = prereqSlugs.length + optionalSlugs.length > 0
    ? await LearningTopic.find({ slug: { $in: [...prereqSlugs, ...optionalSlugs] } })
        .select('slug title estimatedMinutes').lean()
    : [];
  const prereqStates = userId
    ? await TopicProgress.find({
        userId: new mongoose.Types.ObjectId(userId),
        topicSlug: { $in: [...prereqSlugs, ...optionalSlugs] },
      }).select('topicSlug state').lean()
    : [];
  const stateMap = new Map(prereqStates.map(p => [p.topicSlug, asState(p.state)]));

  const prerequisites = prereqTopics.map(p => ({
    slug: p.slug,
    title: p.title,
    state: stateMap.get(p.slug) || 'NOT_STARTED',
    optional: optionalSlugs.includes(p.slug),
    estimatedMinutes: p.estimatedMinutes,
  }));

  const locked = prereqSlugs.some(p => stateMap.get(p) !== 'COMPLETED');

  // ── next / related topics (§54) ───────────────────────────────────────────
  const linkedSlugs = [...(topic.nextTopicSlugs || []), ...(topic.relatedTopicSlugs || [])];
  const linked = linkedSlugs.length > 0
    ? await LearningTopic.find({ slug: { $in: linkedSlugs }, status: 'published' })
        .select('slug title shortDescription level estimatedMinutes').lean()
    : [];
  const linkedMap = new Map(linked.map(l => [l.slug, l]));
  const toItem = (l: any) => ({
    slug: l.slug, title: l.title, shortDescription: l.shortDescription,
    level: l.level, estimatedMinutes: l.estimatedMinutes,
  });

  // ── videos (stored metadata only — never a live search here) ──────────────
  const videos = await LearningVideo.find({ topicSlug: topic.slug, active: true })
    .sort({ rankingScore: -1 })
    .limit(4)
    .lean();

  const lastFetchedAt = videos.length ? videos[0].fetchedAt : null;

  return {
    topic: {
      ...(topic as any),
      id: String((topic as any)._id),
      // The answer key never reaches the client.
      quiz: sanitizeTopicQuiz((topic as any).quiz || []),
    },
    progress: {
      state: asState(progress?.state),
      bookmarked: !!progress?.bookmarked,
      notes: progress?.notes || '',
      lastBlockIndex: progress?.lastBlockIndex || 0,
      bestQuizScore: progress?.bestQuizScore ?? null,
      attempts: (progress?.quizAttempts || []).length,
    },
    prerequisites,
    locked,
    nextTopics: (topic.nextTopicSlugs || []).map(s => linkedMap.get(s)).filter(Boolean).map(toItem),
    relatedTopics: (topic.relatedTopicSlugs || []).map(s => linkedMap.get(s)).filter(Boolean).map(toItem),
    videos: videos.map(v => ({
      youtubeVideoId: v.youtubeVideoId,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: v.thumbnail,
      duration: v.duration,
      durationSeconds: v.durationSeconds,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      publishedAt: v.publishedAt,
      rankingScore: v.rankingScore,
      rankingReasons: v.rankingReasons,
      fetchedAt: v.fetchedAt,
      label: videoLabel(v as any),
    })),
    videoStatus: {
      configured: !!process.env.YOUTUBE_API_KEY,
      available: videos.length > 0,
      credentialRequest: process.env.YOUTUBE_API_KEY
        ? null
        : 'YouTube video refresh is not configured on this deployment (YOUTUBE_API_KEY missing). No video metadata is fabricated.',
      lastFetchedAt,
    },
    stats: {
      totalBlocks: (topic.sections || []).length,
      exampleCount: (topic.examples || []).length,
      practiceCount: (topic.practice || []).length,
      quizCount: (topic.quiz || []).length,
    },
  };
}

/**
 * Resolve a roadmap node to a database-backed lesson topic (spec §52–§53).
 *
 * Roadmap nodes come from the career taxonomy (`programming-basics`, `js-deep`,
 * …) while lessons are authored topics (`python`, `javascript`, …). The match
 * order is explicit and deterministic:
 *   1. an explicit `roadmapNodeIds` link on the topic
 *   2. the topic slug equals the node id
 *   3. the strongest skill overlap between the topic and the roadmap node
 * Returns null when no published lesson covers the node, so the roadmap can
 * fall back to its own node detail instead of showing an empty lesson.
 */
export async function resolveTopicForRoadmapNode(roleSlug: string, nodeId: string) {
  const id = String(nodeId || '').toLowerCase();

  const explicit = await LearningTopic.findOne({
    status: 'published',
    $or: [{ roadmapNodeIds: id }, { slug: id }],
  }).select('slug title shortDescription level estimatedMinutes group').lean();
  if (explicit) {
    return { topicSlug: explicit.slug, title: explicit.title, shortDescription: explicit.shortDescription, level: explicit.level, estimatedMinutes: explicit.estimatedMinutes, group: explicit.group, matchedBy: 'explicit-link' as const };
  }

  // Skill overlap with the role's roadmap node.
  const { CareerRole } = await import('../models/CareerRole');
  const role = await CareerRole.findBySlug(String(roleSlug || '').toLowerCase());
  const node = (role?.roadmapNodes || []).find((n: any) => n.id === id);
  const nodeSkills: string[] = (node?.skillSlugs || []).filter(Boolean);
  if (!node || nodeSkills.length === 0) return null;

  const candidates = await LearningTopic.find({ status: 'published', skillSlugs: { $in: nodeSkills } })
    .select('slug title shortDescription level estimatedMinutes group skillSlugs order')
    .lean();
  if (candidates.length === 0) return null;

  const scored = candidates
    .map(c => ({
      topic: c,
      overlap: (c.skillSlugs || []).filter((s: string) => nodeSkills.includes(s)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || (a.topic.order ?? 0) - (b.topic.order ?? 0) || String(a.topic.slug).localeCompare(String(b.topic.slug)));

  const best = scored[0];
  return {
    topicSlug: best.topic.slug,
    title: best.topic.title,
    shortDescription: best.topic.shortDescription,
    level: best.topic.level,
    estimatedMinutes: best.topic.estimatedMinutes,
    group: best.topic.group,
    matchedBy: 'skill-overlap' as const,
    matchedSkills: (best.topic.skillSlugs || []).filter((s: string) => nodeSkills.includes(s)),
  };
}

// ── Progress actions (spec §49–§51) ──────────────────────────────────────────

async function upsertProgress(userId: string, topicSlug: string) {
  const oid = new mongoose.Types.ObjectId(userId);
  let doc = await TopicProgress.findOne({ userId: oid, topicSlug: topicSlug.toLowerCase() });
  if (!doc) {
    doc = new TopicProgress({ userId: oid, topicSlug: topicSlug.toLowerCase(), state: 'IN_PROGRESS' });
  }
  return doc;
}

export async function setTopicState(userId: string, slug: string, state: TopicState) {
  if (!(TOPIC_STATES as string[]).includes(state)) {
    throw Object.assign(new Error(`Invalid state: ${state}`), { code: 'INVALID_STATE' });
  }
  const doc = await upsertProgress(userId, slug);
  const firstCompletion = state === 'COMPLETED' && doc.state !== 'COMPLETED';
  doc.state = state;
  if (state === 'COMPLETED') doc.completedAt = new Date();
  await doc.save();

  // AETHER activity (spec §16): completing a lesson is qualifying activity, but
  // only the FIRST completion counts — re-opening a finished lesson must not
  // inflate the streak or the activity count.
  if (firstCompletion) {
    const topic = await LearningTopic.findOne({ slug: String(slug).toLowerCase() })
      .select('title roleSlugs').lean();
    await recordActivity({
      userId,
      eventType: 'LESSON_COMPLETED',
      entityType: 'TOPIC',
      entityId: String(doc._id),
      entityLabel: topic?.title ?? doc.topicSlug,
      roleId: topic?.roleSlugs?.[0],
      metadata: { topicSlug: doc.topicSlug },
    });
  }
  return { topicSlug: doc.topicSlug, state: doc.state, bookmarked: doc.bookmarked };
}

export async function toggleBookmark(userId: string, slug: string, bookmarked?: boolean) {
  const doc = await upsertProgress(userId, slug);
  doc.bookmarked = typeof bookmarked === 'boolean' ? bookmarked : !doc.bookmarked;
  await doc.save();
  return { topicSlug: doc.topicSlug, bookmarked: doc.bookmarked, state: doc.state };
}

export async function saveNotes(userId: string, slug: string, notes: string, lastBlockIndex?: number) {
  const doc = await upsertProgress(userId, slug);
  doc.notes = String(notes || '').slice(0, 20000);
  if (typeof lastBlockIndex === 'number' && lastBlockIndex >= 0) doc.lastBlockIndex = lastBlockIndex;
  if (doc.state === 'NOT_STARTED') doc.state = 'IN_PROGRESS';
  await doc.save();
  return { topicSlug: doc.topicSlug, notes: doc.notes, lastBlockIndex: doc.lastBlockIndex, state: doc.state, updatedAt: doc.updatedAt };
}

// ── Quiz (spec §57–§58) ──────────────────────────────────────────────────────

export interface IQuizResult {
  score: number;
  correct: number;
  total: number;
  results: Array<{ id: string; correct: boolean; correctIndex: number; explanation: string; difficulty: string; topicTag: string }>;
  weakTags: string[];
  recommendations: Array<{ slug: string | null; title: string; reason: string }>;
  stateAfter: TopicState;
}

/**
 * Pure grading of a topic quiz (spec §57–§58): no database, no AI, fully
 * deterministic. Returns the per-question verdicts and the weak topic tags that
 * drive review recommendations. Kept separate from persistence so it is
 * unit-testable and identical to what runs in production.
 */
export function gradeQuizAnswers(
  questions: Array<{ id: string; correctIndex: number; explanation?: string; difficulty?: string; topicTag?: string }>,
  answers: Array<number | null | undefined>,
): { score: number; correct: number; total: number; results: IQuizResult['results']; weakTags: string[] } {
  if (questions.length === 0) {
    return { score: 0, correct: 0, total: 0, results: [], weakTags: [] };
  }

  const results = questions.map((q, i) => {
    const picked = Number(answers?.[i] ?? -1);
    return {
      id: q.id,
      correct: picked === q.correctIndex,
      correctIndex: q.correctIndex,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'beginner',
      topicTag: q.topicTag || 'general',
    };
  });

  const correct = results.filter(r => r.correct).length;
  const score = Math.round((correct / questions.length) * 100);
  const weakTags = Array.from(new Set(results.filter(r => !r.correct).map(r => r.topicTag)));

  return { score, correct, total: questions.length, results, weakTags };
}

/** Server-side grading — answers never leave the client for scoring. */
export async function gradeTopicQuiz(userId: string, slug: string, answers: number[]): Promise<IQuizResult | null> {
  const topic = await LearningTopic.findOne({ slug: String(slug).toLowerCase(), status: 'published' })
    .select('slug title quiz').lean();
  if (!topic) return null;
  const questions = (topic.quiz || []) as any[];
  if (questions.length === 0) {
    return { score: 0, correct: 0, total: 0, results: [], weakTags: [], recommendations: [], stateAfter: 'IN_PROGRESS' };
  }

  const { score, correct, total, results, weakTags } = gradeQuizAnswers(questions, answers || []);

  // Wrong answers create an explicit review recommendation (§58).
  const recommendations: Array<{ slug: string | null; title: string; reason: string }> = [];
  for (const tag of weakTags.slice(0, 3)) {
    const related = await LearningTopic.findOne({ status: 'published', slug: { $ne: topic.slug }, $or: [{ slug: tag }, { title: new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] })
      .select('slug title').lean();
    recommendations.push(
      related
        ? { slug: related.slug, title: related.title, reason: `Review "${tag}" — the quiz showed a gap there.` }
        : { slug: null, title: `${topic.title} → ${tag}`, reason: `Review the "${tag}" section of this topic before moving on.` }
    );
  }  if (recommendations.length === 0) {
    recommendations.push({ slug: null, title: topic.title, reason: 'Strong result — revisit this topic after a few days to lock it in.' });
  }

  // Persist the attempt and let the score drive the state (§50).
  const doc = await upsertProgress(userId, slug);
  doc.quizAttempts.push({
    score, correct, total, weakTags,
    answers: (answers || []).map(Number), attemptedAt: new Date(),
  } as any);
  doc.bestQuizScore = Math.max(doc.bestQuizScore ?? 0, score);
  if (score < 60) doc.state = 'REVIEW_NEEDED';
  else if (doc.state !== 'COMPLETED') doc.state = 'IN_PROGRESS';
  await doc.save();

  // AETHER activity (spec §16): a graded quiz is qualifying activity and carries
  // the real score, so the timeline and skill evidence can both read it.
  await recordActivity({
    userId,
    eventType: 'QUIZ_COMPLETED',
    entityType: 'TOPIC',
    entityId: String(doc._id),
    entityLabel: topic.title,
    roleId: topic.roleSlugs?.[0],
    metadata: { topicSlug: topic.slug, scorePercent: score, correct, total },
  });

  return { score, correct, total, results, weakTags, recommendations, stateAfter: doc.state };
}

// ── Continue learning & personalized recommendations (§51, §59) ──────────────

export async function continueLearning(userId: string, limit = 3) {
  const rows = await TopicProgress.find({
    userId: new mongoose.Types.ObjectId(userId),
    state: { $in: ['IN_PROGRESS', 'REVIEW_NEEDED'] },
  }).sort({ updatedAt: -1 }).limit(limit).lean();

  if (rows.length === 0) return { items: [], emptyState: 'No learning activity yet. Start with a topic from a roadmap.' };

  const topics = await LearningTopic.find({ slug: { $in: rows.map(r => r.topicSlug) }, status: 'published' })
    .select('slug title group estimatedMinutes sections').lean();
  const topicMap = new Map(topics.map(t => [t.slug, t]));

  return {
    items: rows
      .map(r => {
        const t = topicMap.get(r.topicSlug);
        if (!t) return null;
        const total = (t.sections || []).length || 1;
        const pct = r.state === 'COMPLETED' ? 100 : Math.min(95, Math.round(((r.lastBlockIndex + 1) / total) * 100));
        return {
          topicSlug: t.slug,
          title: t.title,
          group: t.group || 'General',
          estimatedMinutes: t.estimatedMinutes,
          state: asState(r.state),
          progressPercent: pct,
          bestQuizScore: r.bestQuizScore ?? null,
          updatedAt: r.updatedAt,
        };
      })
      .filter(Boolean),
    emptyState: null,
  };
}

/**
 * Evidence-based recommendations (spec §59). Sources, in priority order:
 *   1. REVIEW_NEEDED topics and weak quiz tags (real assessment evidence)
 *   2. declared target role gaps (career readiness gaps)
 *   3. next topics after the most recently completed topic (curriculum order)
 * Never a hardcoded list.
 */
export async function recommendTopics(userId: string, limit = 4) {
  const reasons: Array<{ slug: string; reason: string; priority: number }> = [];
  const seen = new Set<string>();

  const push = (slug: string | undefined | null, reason: string, priority: number) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    reasons.push({ slug, reason, priority });
  };

  const progress = await TopicProgress.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  const byState = new Map(progress.map(p => [p.topicSlug, p]));

  // 1. Review-needed / weak quiz evidence.
  for (const p of progress) {
    if (p.state === 'REVIEW_NEEDED') {
      push(p.topicSlug, 'Quiz score below 60% — review this topic before moving on.', 100);
    }
    const weak = (p.quizAttempts || []).flatMap(a => a.weakTags || []);
    for (const tag of Array.from(new Set(weak)).slice(0, 2)) {
      push(tag, `You answered "${tag}" questions incorrectly in a quiz.`, 90);
    }
  }

  // 2. Target-role gaps (real readiness evidence when a goal exists).
  try {
    const UserCareerGoal = mongoose.model('UserCareerGoal');
    const goal = await (UserCareerGoal as any).findOne({ userId: new mongoose.Types.ObjectId(userId) }).sort({ updatedAt: -1 }).lean();
    if (goal?.roleSlug) {
      const { CareerRole } = await import('../models/CareerRole');
      const { computeReadiness } = await import('./readiness.service');
      const UserSkillProfile = mongoose.model('UserSkillProfile');
      const role = await (CareerRole as any).findBySlug(goal.roleSlug);
      const profile = await (UserSkillProfile as any).findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
      if (role) {
        const confidence = new Map<string, number>();
        for (const s of (profile?.skills || [])) {
          confidence.set(String(s.slug || s.name || ''), Math.round(Number(s.confidence ?? s.score ?? 0)));
        }
        const readiness = computeReadiness(role, confidence);
        for (const gap of (readiness.gaps || []).slice(0, 3)) {
          const topic = await LearningTopic.findOne({
            status: 'published',
            $or: [{ skillSlugs: gap.skillSlug }, { slug: gap.skillSlug }],
          }).select('slug').lean();
          if (topic) push(topic.slug, `Required for your target role "${role.name}" — currently a gap.`, 80);
        }
      }
    }
  } catch (err: any) {
    logger.warn(`Role-gap recommendations unavailable: ${err?.message}`);
  }

  // 3. Curriculum order after completed topics.
  const completed = progress.filter(p => p.state === 'COMPLETED').map(p => p.topicSlug);
  if (completed.length > 0) {
    const topics = await LearningTopic.find({ slug: { $in: completed } })
      .select('slug nextTopicSlugs').lean();
    for (const t of topics) {
      for (const next of (t.nextTopicSlugs || []).slice(0, 2)) {
        push(next, `Follows "${t.slug}" in the curriculum.`, 60);
      }
    }
  }

  // 4. Cold start: the earliest published topics for beginners.
  if (reasons.length === 0) {
    const starters = await LearningTopic.find({ status: 'published', level: 'beginner' })
      .sort({ order: 1 }).limit(limit).select('slug title').lean();
    for (const s of starters) push(s.slug, 'Beginner-friendly starting point.', 10);
  }

  reasons.sort((a, b) => b.priority - a.priority);
  const top = reasons.slice(0, limit);
  const topics = await LearningTopic.find({ slug: { $in: top.map(t => t.slug) }, status: 'published' })
    .select('slug title shortDescription level estimatedMinutes group').lean();
  const topicMap = new Map(topics.map(t => [t.slug, t]));

  return {
    recommendations: top
      .filter(t => topicMap.has(t.slug))
      .map(t => {
        const topic = topicMap.get(t.slug)!;
        return {
          slug: topic.slug,
          title: topic.title,
          shortDescription: topic.shortDescription,
          level: topic.level,
          estimatedMinutes: topic.estimatedMinutes,
          group: topic.group,
          reason: t.reason,
        };
      }),
    evidence: {
      reviewNeeded: progress.filter(p => p.state === 'REVIEW_NEEDED').length,
      completed: completed.length,
      inProgress: progress.filter(p => p.state === 'IN_PROGRESS').length,
    },
    emptyState: reasons.length === 0 ? 'No learning evidence yet — pick any roadmap topic to begin.' : null,
  };
}

/** Block-level grounding text for the Ask AETHER tutor (spec §55). */
export function topicGroundingText(topic: Pick<ILearningTopic, 'title' | 'description' | 'learningObjectives' | 'sections' | 'examples' | 'commonMistakes'>): string {
  const parts: string[] = [];
  parts.push(`TOPIC: ${topic.title}`);
  parts.push(`OVERVIEW: ${topic.description}`);
  if (topic.learningObjectives?.length) parts.push(`OBJECTIVES:\n- ${topic.learningObjectives.join('\n- ')}`);
  for (const block of (topic.sections || []) as ITopicBlock[]) {
    if (block.type === 'heading') parts.push(`## ${block.content || ''}`);
    else if (block.type === 'paragraph') parts.push(block.content || '');
    else if (block.type === 'list' || block.type === 'steps') parts.push((block.items || []).map(i => `- ${i}`).join('\n'));
    else if (block.type === 'code') parts.push(`CODE (${block.language || 'text'}):\n${block.code || ''}${block.output ? `\nOUTPUT: ${block.output}` : ''}`);
    else if (block.content) parts.push(`${block.type.toUpperCase()}: ${block.content}`);
  }
  for (const ex of (topic.examples || []).slice(0, 4)) {
    parts.push(`EXAMPLE (${ex.kind}) ${ex.title}: ${ex.explanation}\n${ex.code}`);
  }
  for (const cm of (topic.commonMistakes || []).slice(0, 3)) {
    parts.push(`COMMON MISTAKE: ${cm.title} — ${cm.why}`);
  }
  return parts.join('\n\n').slice(0, 12000);
}
