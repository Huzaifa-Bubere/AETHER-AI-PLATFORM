import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, requireCandidate } from '../../middleware/auth';
import { CareerRole } from '../models/CareerRole';
import { UserCareerGoal } from '../models/UserCareerGoal';
import { RoadmapProgress, type NodeState } from '../models/RoadmapProgress';
import { RoleTrendSnapshot, MarketDataSource } from '../models/market';
import { Skill } from '../models/Skill';
import { getOrBuildSkillProfile, confidenceMap, declareSkills, rebuildSkillProfile } from '../services/skillProfile.service';
import { computeReadiness, buildWeeklyPlan, GAP_THRESHOLD, type SkillDemand } from '../services/readiness.service';
import { careerAI } from '../services/careerAI.service';
import logger from '../../utils/logger';
import { asyncHandler } from '../../middleware/errorHandler';

/** Confidence lookup with a uniform numeric view. */
async function numericConfidence(userId: string): Promise<Map<string, number>> {
  const conf = await confidenceMap(userId);
  return new Map([...conf.entries()].map(([k, v]) => [k, v.confidence]));
}

const router = Router();

// ── Explore ──────────────────────────────────────────────────────────────────

/** GET /api/careers — browse/search roles with per-user readiness + market availability. */
router.get('/', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$or = [{ name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { description: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];

  const [roles, conf, goal, snapshots] = await Promise.all([
    CareerRole.find(filter).select('slug name description category skills roadmapStages roadmapNodes projects updatedAt').sort({ name: 1 }).lean(),
    confidenceMap((req as any).user.userId),
    UserCareerGoal.findActiveByUser((req as any).user.userId),
    RoleTrendSnapshot.find({}).sort({ periodEnd: -1 }).select('role region periodEnd totalPostings').lean(),
  ]);
  const latestByRole = new Map<string, { region: string; periodEnd: Date; totalPostings: number }>();
  for (const s of snapshots) {
    if (!latestByRole.has(s.role)) latestByRole.set(s.role, { region: s.region, periodEnd: s.periodEnd, totalPostings: s.totalPostings });
  }

  const data = roles.map(r => {
    const totalWeight = (r.skills || []).reduce((sum: number, s: any) => sum + (s.priority === 'ESSENTIAL' ? 3 : s.priority === 'RECOMMENDED' ? 2 : 1), 0);
    const earned = (r.skills || []).reduce((sum: number, s: any) => sum + (s.priority === 'ESSENTIAL' ? 3 : s.priority === 'RECOMMENDED' ? 2 : 1) * ((conf.get(s.skillSlug)?.confidence ?? 0) / 100), 0);
    const market = latestByRole.get(r.slug);
    return {
      slug: r.slug, name: r.name, description: r.description, category: r.category,
      skillsCount: (r.skills || []).length,
      stagesCount: (r.roadmapStages || []).length,
      projectsCount: (r.projects || []).length,
      readiness: totalWeight ? Math.round((earned / totalWeight) * 100) : 0,
      isGoal: goal?.roleSlug === r.slug,
      market: market ? { region: market.region, updated: market.periodEnd, postings: market.totalPostings } : null,
    };
  });
  const categories = [...new Set(roles.map(r => r.category))].sort();
  res.json({ success: true, data: { roles: data, categories, goal: goal ? { roleSlug: goal.roleSlug, hoursPerWeek: goal.hoursPerWeek, experienceLevel: goal.experienceLevel, targetTimelineWeeks: goal.targetTimelineWeeks } : null } });
}));

/** GET /api/careers/:slug — full role detail (incl. skills, stages, projects, resources). */
router.get('/:slug', authenticateToken, requireCandidate, [param('slug').isString()], asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.slug.toLowerCase(), isActive: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const [goal, progress, snapshot] = await Promise.all([
    UserCareerGoal.findActiveByUser((req as any).user.userId),
    RoadmapProgress.findByUserAndRole((req as any).user.userId, role.slug),
    RoleTrendSnapshot.latestForRole(role.slug),
  ]);
  res.json({ success: true, data: { role, goal, progress, snapshot } });
}));

/** GET /api/careers/:slug/roadmap — roadmap with computed node states for this user. */
router.get('/:slug/roadmap', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.slug.toLowerCase(), isActive: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const progress = await RoadmapProgress.findByUserAndRole((req as any).user.userId, role.slug);
  const stateByNode = new Map<string, NodeState>((progress?.nodes || []).map(n => [n.nodeId, n.state]));

  const conf = await confidenceMap((req as any).user.userId);
  const nodes = (role.roadmapNodes || []).map(n => {
    const prereqMet = (n.prerequisites || []).every(pid => {
      const p = (role.roadmapNodes || []).find(x => x.id === pid);
      return !p || (p.skillSlugs || []).some(s => stateByNode.get(p.id) === 'COMPLETED' || (conf.get(s)?.confidence ?? 0) >= GAP_THRESHOLD);
    });
    const stored = stateByNode.get(n.id);
    let state: NodeState = stored || 'READY';
    if (state !== 'COMPLETED' && state !== 'SKIPPED' && !prereqMet) state = 'LOCKED';
    if (!stored && prereqMet && (n.skillSlugs || []).some(s => (conf.get(s)?.confidence ?? 0) >= GAP_THRESHOLD)) state = 'COMPLETED';
    return {
      id: n.id, title: n.title, description: n.description, state,
      prerequisites: n.prerequisites || [], skillSlugs: n.skillSlugs || [],
      estimatedHours: n.estimatedHours, quizCount: (n.quiz || []).length,
      hasProject: !!n.project, resourceCount: (n.resourceIds || []).length,
    };
  });
  res.json({ success: true, data: {
    roleSlug: role.slug, roleName: role.name,
    stages: role.roadmapStages || [],
    nodes,
    progressSummary: {
      total: nodes.length,
      completed: nodes.filter(n => n.state === 'COMPLETED').length,
      inProgress: nodes.filter(n => n.state === 'IN_PROGRESS').length,
      percentage: nodes.length ? Math.round((nodes.filter(n => n.state === 'COMPLETED').length / nodes.length) * 100) : 0,
    },
    currentStageId: progress?.currentStageId,
  } });
}));

/** GET /api/careers/:slug/nodes/:nodeId — full topic detail for the drawer. */
router.get('/:slug/nodes/:nodeId', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.slug.toLowerCase() });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const node = (role.roadmapNodes || []).find(n => n.id === req.params.nodeId);
  if (!node) {
    res.status(404).json({ success: false, message: 'Roadmap topic not found' });
    return;
  }
  const resources = (role.resources || []).filter(r => (node.resourceIds || []).includes(r.id));
  const prereqTitles = (node.prerequisites || []).map(pid => {
    const p = (role.roadmapNodes || []).find(x => x.id === pid);
    return p ? { id: p.id, title: p.title } : null;
  }).filter(Boolean);
  const progress = await RoadmapProgress.findByUserAndRole((req as any).user.userId, role.slug);
  const nodeProgress = progress?.nodes.find(n => n.nodeId === node.id);
  res.json({ success: true, data: { node: { ...node, quiz: undefined, hasQuiz: (node.quiz || []).length > 0 }, resources, prerequisites: prereqTitles, state: nodeProgress?.state || 'READY', quizScores: nodeProgress?.quizScores || [] } });
}));

/** GET /api/careers/:slug/nodes/:nodeId/quiz — quiz questions (no answers). */
router.get('/:slug/nodes/:nodeId/quiz', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.slug.toLowerCase() });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const node = (role.roadmapNodes || []).find(n => n.id === req.params.nodeId);
  if (!node || !(node.quiz || []).length) {
    res.status(404).json({ success: false, message: 'No quiz for this topic' });
    return;
  }
  const questions = node.quiz.map(q => ({ question: q.question, options: q.options }));
  res.json({ success: true, data: { questions } });
}));

/** POST /api/careers/:slug/nodes/:nodeId/quiz — submit answers, grade server-side. */
router.post('/:slug/nodes/:nodeId/quiz', authenticateToken, requireCandidate, [body('answers').isArray()], asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.slug.toLowerCase() });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const node = (role.roadmapNodes || []).find(n => n.id === req.params.nodeId);
  if (!node || !(node.quiz || []).length) {
    res.status(404).json({ success: false, message: 'No quiz for this topic' });
    return;
  }
  const answers = (req.body.answers || []) as number[];
  const results = node.quiz.map((q, i) => ({ correct: answers[i] === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation }));
  const score = Math.round((results.filter(r => r.correct).length / node.quiz.length) * 100);
  res.json({ success: true, data: { score, results } });
}));

// ── Goal & progress ─────────────────────────────────────────────────────────

/** POST /api/careers/goal — set/update the user's target role + plan preferences. */
router.post('/goal', authenticateToken, requireCandidate, [
  body('roleSlug').isString().notEmpty(),
  body('hoursPerWeek').optional().isInt({ min: 1, max: 80 }),
  body('experienceLevel').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('targetTimelineWeeks').optional().isInt({ min: 1, max: 104 }),
], asyncHandler(async (req: Request, res: Response) => {
  const { roleSlug, hoursPerWeek, experienceLevel, targetTimelineWeeks } = req.body;
  const role = await CareerRole.findOne({ slug: String(roleSlug).toLowerCase(), isActive: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const goal = await UserCareerGoal.findOneAndUpdate(
    { userId: (req as any).user.userId },
    { $set: { roleSlug: role.slug, ...(hoursPerWeek != null && { hoursPerWeek }), ...(experienceLevel && { experienceLevel }), ...(targetTimelineWeeks != null && { targetTimelineWeeks }) } },
    { upsert: true, new: true },
  );
  // Initialize progress doc if missing.
  await RoadmapProgress.updateOne({ userId: (req as any).user.userId, roleSlug: role.slug }, { $setOnInsert: { nodes: [] } }, { upsert: true });
  res.json({ success: true, data: goal });
}));

/** GET /api/careers/me/goal */
router.get('/me/goal', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const goal = await UserCareerGoal.findActiveByUser((req as any).user.userId);
  res.json({ success: true, data: goal });
}));

/** GET /api/careers/me/readiness — readiness for the user's goal role (or :slug param). */
router.get('/me/readiness', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const slugOverride = String(req.query.role || '').toLowerCase();
  const goal = await UserCareerGoal.findActiveByUser((req as any).user.userId);
  const slug = slugOverride || goal?.roleSlug;
  if (!slug) {
    res.json({ success: true, data: null });
    return;
  }
  const role = await CareerRole.findOne({ slug, isActive: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const [conf, snapshot] = await Promise.all([
    numericConfidence((req as any).user.userId),
    RoleTrendSnapshot.latestForRole(slug),
  ]);
  const demand = new Map<string, SkillDemand>();
  for (const s of snapshot?.topSkills || []) demand.set(s.skill, { frequency: s.percentage, trend: s.trend });
  const result = computeReadiness(role, conf, demand);
  res.json({ success: true, data: { roleSlug: slug, roleName: role.name, snapshot: snapshot ? { region: snapshot.region, periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, totalPostings: snapshot.totalPostings, source: snapshot.sourceMetadata?.sourceName } : null, ...result } });
}));

/** GET /api/careers/me/gaps — gap list for goal role. */
router.get('/me/gaps', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const goal = await UserCareerGoal.findActiveByUser((req as any).user.userId);
  if (!goal) {
    res.json({ success: true, data: { gaps: [] } });
    return;
  }
  const role = await CareerRole.findOne({ slug: goal.roleSlug, isActive: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const [conf, snapshot] = await Promise.all([
    numericConfidence((req as any).user.userId),
    RoleTrendSnapshot.latestForRole(role.slug),
  ]);
  const demand = new Map<string, SkillDemand>();
  for (const s of snapshot?.topSkills || []) demand.set(s.skill, { frequency: s.percentage, trend: s.trend });
  const result = computeReadiness(role, conf, demand);
  res.json({ success: true, data: { roleSlug: role.slug, gaps: result.gaps } });
}));

/** PUT /api/learning/progress/:role/:node — update node state. */
router.put('/learning/progress/:role/:node', authenticateToken, requireCandidate, [
  param('role').isString(), param('node').isString(),
  body('state').isIn(['READY', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
], asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.role.toLowerCase() });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const node = (role.roadmapNodes || []).find(n => n.id === req.params.node);
  if (!node) {
    res.status(404).json({ success: false, message: 'Roadmap topic not found' });
    return;
  }

  const userId = (req as any).user.userId;
  let progress = await RoadmapProgress.findByUserAndRole(userId, role.slug);
  if (!progress) progress = await RoadmapProgress.create({ userId, roleSlug: role.slug, nodes: [] });

  const state = req.body.state as NodeState;
  let entry = progress.nodes.find(n => n.nodeId === node.id);
  if (!entry) { entry = { nodeId: node.id, state, quizScores: [], updatedAt: new Date() } as any; progress.nodes.push(entry); }
  entry.state = state;
  entry.updatedAt = new Date();
  if (state === 'COMPLETED' && !entry.completedAt) entry.completedAt = new Date();

  // Server-side LOCKED enforcement: refuse COMPLETED when prerequisites unmet (allow READY/IN_PROGRESS browsing).
  if (state === 'COMPLETED') {
    const prereqOk = (node.prerequisites || []).every(pid => {
      const p = (role.roadmapNodes || []).find(x => x.id === pid);
      return !p || progress!.nodes.find(n => n.nodeId === pid)?.state === 'COMPLETED';
    });
    if (!prereqOk) {
      res.status(409).json({ success: false, message: 'Prerequisites for this topic are not completed yet' });
      return;
    }
  }

  // Stage pointer = stage of the first non-completed node in order.
  const completedIds = new Set(progress.nodes.filter(n => n.state === 'COMPLETED').map(n => n.nodeId));
  const stageOf = (nodeId: string) => (role.roadmapStages || []).find(st => (st.nodeIds || []).includes(nodeId));
  for (const n of role.roadmapNodes || []) {
    if (!completedIds.has(n.id)) { progress.currentStageId = stageOf(n.id)?.id; break; }
  }
  await progress.save();

  // Completed nodes feed skill evidence (COMPLETED_LEARNING) — rebuild async, never block.
  if (state === 'COMPLETED') void rebuildSkillProfile(String(userId)).catch(err => logger.warn('career.profileRebuild.failed', { err: err.message }));

  const summary = {
    total: (role.roadmapNodes || []).length,
    completed: progress.nodes.filter(n => n.state === 'COMPLETED').length,
  };
  res.json({ success: true, data: { nodeId: node.id, state, progressPercentage: summary.total ? Math.round((summary.completed / summary.total) * 100) : 0, summary } });
}));

/** GET /api/learning/progress/:role */
router.get('/learning/progress/:role', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const progress = await RoadmapProgress.findByUserAndRole((req as any).user.userId, req.params.role.toLowerCase());
  res.json({ success: true, data: progress });
}));

/** GET /api/careers/:slug/plan — prerequisite-respecting weekly plan. */
router.get('/:slug/plan', authenticateToken, requireCandidate, query('hoursPerWeek').optional().isInt(), asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findOne({ slug: req.params.slug.toLowerCase() });
  if (!role) {
    res.status(404).json({ success: false, message: 'Career role not found' });
    return;
  }
  const goal = await UserCareerGoal.findActiveByUser((req as any).user.userId);
  const hoursPerWeek = Number(req.query.hoursPerWeek) || goal?.hoursPerWeek || 10;
  const targetWeeks = Number(req.query.weeks) || goal?.targetTimelineWeeks;
  const conf = await numericConfidence((req as any).user.userId);
  const plan = buildWeeklyPlan(role, conf, hoursPerWeek, targetWeeks);
  res.json({ success: true, data: { hoursPerWeek, weeks: plan.length, plan } });
}));

// ── Market (read-only for candidates) ───────────────────────────────────────

/** GET /api/careers/:slug/market — latest snapshot + source transparency metadata. */
router.get('/:slug/market', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const slug = req.params.slug.toLowerCase();
  const snapshot = await RoleTrendSnapshot.latestForRole(slug);
  if (!snapshot) {
    res.json({ success: true, data: null });
    return;
  }
  const source = await MarketDataSource.findOne({}).sort({ createdAt: -1 }).select('sourceName region totalRows acceptedRows createdAt').lean();
  res.json({ success: true, data: { snapshot, latestImport: source } });
}));

// ── AI (cached; graceful degradation) ───────────────────────────────────────

/** POST /api/careers/ai/explain-skill */
router.post('/ai/explain-skill', authenticateToken, requireCandidate, [body('skillName').isString().notEmpty()], asyncHandler(async (req: Request, res: Response) => {
  const { skillName, roleName } = req.body;
  const norm = await Skill.findOne({ $or: [{ name: new RegExp(`^${String(skillName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, { slug: String(skillName).toLowerCase() }] });
  const goal = await UserCareerGoal.findActiveByUser((req as any).user.userId);
  const roleSlug = roleName ? null : goal?.roleSlug;
  const role = roleSlug ? await CareerRole.findOne({ slug: roleSlug }) : roleName ? await CareerRole.findOne({ name: roleName }) : null;
  const snapshot = role ? await RoleTrendSnapshot.latestForRole(role.slug) : null;
  const stat = snapshot?.topSkills?.find(s => s.skill === norm?.slug);
  let explanation = await careerAI.explainSkill({
    skillName: norm?.name || skillName,
    skillType: norm?.skillType,
    roleName: role?.name || roleName,
    marketFact: stat && snapshot ? {
      frequency: stat.percentage, trend: stat.trend,
      samplePostings: snapshot.totalPostings,
      period: `${new Date(snapshot.periodStart).toLocaleDateString()} – ${new Date(snapshot.periodEnd).toLocaleDateString()}`,
      region: snapshot.region,
    } : undefined,
  });
  if (!explanation) {
    // Deterministic fallback — page never breaks without Gemini.
    explanation = {
      explanation: `${norm?.name || skillName} is part of the ${role?.name || 'selected'} roadmap. See the linked resources and practice suggestions below.`,
      analogy: '', example: '', interviewConcepts: [], commonMistakes: [], nextSteps: [], cached: false,
    };
  }
  res.json({ success: true, data: explanation });
}));

/** POST /api/careers/ai/advisor */
router.post('/ai/advisor', authenticateToken, requireCandidate, [body('question').isString().notEmpty().isLength({ max: 500 })], asyncHandler(async (req: Request, res: Response) => {
  const goal = await UserCareerGoal.findActiveByUser((req as any).user.userId);
  let context: { roleName?: string; readiness?: number; topGaps?: string[]; matchedSkills?: string[]; snapshotFact?: string } = {};
  if (goal) {
    const role = await CareerRole.findOne({ slug: goal.roleSlug });
    const [conf, snapshot] = await Promise.all([
      numericConfidence((req as any).user.userId),
      RoleTrendSnapshot.latestForRole(goal.roleSlug),
    ]);
    if (role) {
      const demand = new Map<string, SkillDemand>();
      for (const s of snapshot?.topSkills || []) demand.set(s.skill, { frequency: s.percentage, trend: s.trend });
      const result = computeReadiness(role, conf, demand);
      context = {
        roleName: role.name,
        readiness: result.readiness,
        topGaps: result.gaps.slice(0, 8).map(g => g.name),
        matchedSkills: result.matched.slice(0, 12).map(m => m.name),
        snapshotFact: snapshot ? `${snapshot.totalPostings} ${snapshot.region} postings, period ${new Date(snapshot.periodStart).toLocaleDateString()}–${new Date(snapshot.periodEnd).toLocaleDateString()}, source: ${snapshot.sourceMetadata?.sourceName}. Top requested skills: ${snapshot.topSkills.slice(0, 8).map(s => `${s.skill} ${s.percentage}%`).join(', ')}.` : undefined,
      };
    }
  }
  const answer = await careerAI.askAdvisor({ question: req.body.question, ...context });
  res.json({
    success: true,
    data: answer ?? { answer: 'The AI advisor is unavailable right now. Your readiness score, gaps and roadmap below are computed from your actual assessment data and remain available.', cached: false },
    aiAvailable: !!answer,
  });
}));

// Skills taxonomy (for admin UI + declare skills)
/** GET /api/careers/meta/skills — list canonical skills. */
router.get('/meta/skills', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const skills = await Skill.find({}).select('slug name category skillType aliases').sort({ name: 1 }).lean();
  res.json({ success: true, data: skills });
}));

/** POST /api/careers/me/declare-skills — self-declared skills (weakest evidence). */
router.post('/me/declare-skills', authenticateToken, requireCandidate, [body('skills').isArray({ max: 100 })], asyncHandler(async (req: Request, res: Response) => {
  await declareSkills((req as any).user.userId, (req.body.skills || []).map(String));
  res.json({ success: true });
}));

// ══ Career Learning — structured courses (spec §44–53) ═══════════════════

import { Course, LearningProgress } from '../models/Course';
import { buildCourseRecommendations } from '../services/courseRecommender.service';
import { explainLessonConcept } from '../services/courseAI.service';

/** GET /api/careers/courses?role=backend-developer — published course catalog. */
router.get('/courses', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const role = String(req.query.role || '').toLowerCase();
  const filter: Record<string, unknown> = { status: 'published' };
  if (role) filter.roleSlugs = role;
  const courses = await Course.find(filter)
    .select('title slug description roleSlugs skillSlugs difficulty estimatedHours prerequisites modules.status')
    .lean();
  const slugs = courses.map(c => c.slug);
  const progressDocs = await LearningProgress.find({
    userId: (req as any).user.userId,
    courseSlug: { $in: slugs },
  }).lean();
  const byCourse = new Map(progressDocs.map(p => [p.courseSlug, p]));
  const data = courses.map((c: any) => {
    const progress = byCourse.get(c.slug);
    const totalLessons = (c.modules || []).reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0);
    const completed = (progress?.lessons || []).filter((l: any) => l.state === 'COMPLETED').length;
    return {
      title: c.title, slug: c.slug, description: c.description,
      difficulty: c.difficulty, estimatedHours: c.estimatedHours,
      moduleCount: (c.modules || []).length,
      totalLessons,
      completedLessons: completed,
      progressPercent: totalLessons ? Math.round((completed / totalLessons) * 100) : 0,
    };
  });
  res.json({ success: true, data: { courses: data } });
}));

/** GET /api/careers/courses/:slug — full course with lesson state for this user. */
router.get('/courses/:slug', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  if (!course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return;
  }
  const progress = await LearningProgress.findByUserAndCourse((req as any).user.userId, course.slug);
  const lessonState = new Map<string, string>((progress?.lessons || []).map((l: any) => [l.lessonId, l.state]));
  const quizScore = new Map<string, number>((progress?.quizScores || []).map((q: any) => [q.moduleId, q.score]));

  const modules = (course.modules || []).map((m: any) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order: m.order,
    lessonCount: (m.lessons || []).length,
    estimatedMinutes: (m.lessons || []).reduce((s: number, l: any) => s + (l.estimatedMinutes || 0), 0),
    hasQuiz: (m.quiz || []).length > 0,
    quizScore: quizScore.get(m.id) ?? null,
    hasProject: !!m.project,
    completedLessons: (m.lessons || []).filter((l: any) => lessonState.get(l.id) === 'COMPLETED').length,
  }));
  const totalLessons = (course.modules || []).reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0);
  const completedLessons = (progress?.lessons || []).filter((l: any) => l.state === 'COMPLETED').length;
  const quizScores = (progress?.quizScores || []).map((q: any) => q.score) as number[];
  const remainingMinutes = (course.modules || []).reduce((s: number, m: any) =>
    s + (m.lessons || []).filter((l: any) => lessonState.get(l.id) !== 'COMPLETED')
      .reduce((t: number, l: any) => t + (l.estimatedMinutes || 0), 0), 0);

  res.json({
    success: true,
    data: {
      course: {
        title: course.title, slug: course.slug, description: course.description,
        difficulty: course.difficulty, estimatedHours: course.estimatedHours,
        roleSlugs: course.roleSlugs, skillSlugs: course.skillSlugs, prerequisites: course.prerequisites,
      },
      modules,
      progress: {
        totalLessons,
        completedLessons,
        percentage: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
        quizAverage: quizScores.length ? Math.round(quizScores.reduce((s, q) => s + q, 0) / quizScores.length) : null,
        projectsCompleted: progress?.projectsCompleted?.length || 0,
        estimatedRemainingMinutes: remainingMinutes,
      },
    },
  });
}));

/** GET /api/careers/courses/:slug/modules/:moduleId/lessons/:lessonId — lesson content. */
router.get('/courses/:slug/modules/:moduleId/lessons/:lessonId', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  if (!course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return;
  }
  const mod = (course.modules || []).find((m: any) => m.id === req.params.moduleId);
  const lesson = mod?.lessons?.find((l: any) => l.id === req.params.lessonId);
  if (!mod || !lesson) {
    res.status(404).json({ success: false, message: 'Lesson not found' });
    return;
  }
  const progress = await LearningProgress.findByUserAndCourse((req as any).user.userId, course.slug);
  const state = (progress?.lessons || []).find((l: any) => l.lessonId === lesson.id)?.state || 'NOT_STARTED';
  const siblings = (mod.lessons || []).map((l: any) => ({ id: l.id, title: l.title, order: l.order }));
  res.json({ success: true, data: { module: { id: mod.id, title: mod.title }, lesson, state, siblings } });
}));

/** PUT /api/careers/courses/:slug/lessons/:lessonId/progress — persist lesson state. */
router.put('/courses/:slug/lessons/:lessonId/progress', authenticateToken, requireCandidate,
  [body('state').isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])],
  asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  if (!course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return;
  }
  const lessonExists = (course.modules || []).some((m: any) => (m.lessons || []).some((l: any) => l.id === req.params.lessonId));
  if (!lessonExists) {
    res.status(404).json({ success: false, message: 'Lesson not found' });
    return;
  }
  const state = req.body.state as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  let progress = await LearningProgress.findByUserAndCourse((req as any).user.userId, course.slug);
  if (!progress) {
    progress = await LearningProgress.create({
      userId: (req as any).user.userId,
      courseSlug: course.slug,
      roleSlug: course.roleSlugs?.[0] || '',
      lessons: [], quizScores: [], projectsCompleted: [],
    });
  }
  let entry = progress.lessons.find(l => l.lessonId === req.params.lessonId);
  if (!entry) {
    entry = { lessonId: req.params.lessonId, state, updatedAt: new Date() } as any;
    progress.lessons.push(entry);
  }
  entry.state = state;
  entry.updatedAt = new Date();
  if (state === 'COMPLETED' && !entry.completedAt) entry.completedAt = new Date();
  await progress.save();

  // Completed lessons feed the unified skill profile (COMPLETED_LEARNING) — async.
  if (state === 'COMPLETED') {
    import('../services/skillProfile.service')
      .then(m => m.rebuildSkillProfile(String((req as any).user.userId)))
      .catch(() => undefined);
  }

  const totalLessons = (course.modules || []).reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0);
  const completed = progress.lessons.filter(l => l.state === 'COMPLETED').length;
  res.json({
    success: true,
    data: {
      lessonId: req.params.lessonId, state,
      progressPercentage: totalLessons ? Math.round((completed / totalLessons) * 100) : 0,
    },
  });
}));

/** GET /api/careers/courses/:slug/modules/:moduleId/quiz — questions without answers. */
router.get('/courses/:slug/modules/:moduleId/quiz', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  const mod = course?.modules?.find((m: any) => m.id === req.params.moduleId);
  if (!course || !mod || !(mod.quiz || []).length) {
    res.status(404).json({ success: false, message: 'No quiz for this module' });
    return;
  }
  const questions = mod.quiz.map((q: any) => ({ id: q.id, question: q.question, options: q.options }));
  res.json({ success: true, data: { questions } });
}));

/** POST /api/careers/courses/:slug/modules/:moduleId/quiz — grade server-side, persist mastery. */
router.post('/courses/:slug/modules/:moduleId/quiz', authenticateToken, requireCandidate,
  [body('answers').isArray()],
  asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  const mod = course?.modules?.find((m: any) => m.id === req.params.moduleId);
  if (!course || !mod || !(mod.quiz || []).length) {
    res.status(404).json({ success: false, message: 'No quiz for this module' });
    return;
  }
  const answers = (req.body.answers || []) as number[];
  const results = mod.quiz.map((q: any, i: number) => ({
    correct: answers[i] === q.correctIndex,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    topicTag: q.topicTag,
  }));
  const score = Math.round((results.filter(r => r.correct).length / mod.quiz.length) * 100);

  let progress = await LearningProgress.findByUserAndCourse((req as any).user.userId, course.slug);
  if (!progress) {
    progress = await LearningProgress.create({
      userId: (req as any).user.userId,
      courseSlug: course.slug,
      roleSlug: course.roleSlugs?.[0] || '',
      lessons: [], quizScores: [], projectsCompleted: [],
    });
  }
  let qEntry = progress.quizScores.find(q => q.moduleId === mod.id);
  if (!qEntry) {
    qEntry = { moduleId: mod.id, score: 0, attempts: 0, lastAttemptAt: new Date() } as any;
    progress.quizScores.push(qEntry);
  }
  qEntry.score = Math.max(qEntry.score, score); // best attempt counts toward mastery
  qEntry.attempts += 1;
  qEntry.lastAttemptAt = new Date();
  await progress.save();

  res.json({ success: true, data: { score, results } });
}));

/** POST /api/careers/courses/:slug/modules/:moduleId/project — mark project complete. */
router.post('/courses/:slug/modules/:moduleId/project', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  const mod = course?.modules?.find((m: any) => m.id === req.params.moduleId);
  if (!course || !mod?.project) {
    res.status(404).json({ success: false, message: 'No project for this module' });
    return;
  }
  let progress = await LearningProgress.findByUserAndCourse((req as any).user.userId, course.slug);
  if (!progress) {
    progress = await LearningProgress.create({
      userId: (req as any).user.userId,
      courseSlug: course.slug,
      roleSlug: course.roleSlugs?.[0] || '',
      lessons: [], quizScores: [], projectsCompleted: [],
    });
  }
  if (!progress.projectsCompleted.includes(mod.id)) progress.projectsCompleted.push(mod.id);
  await progress.save();
  res.json({ success: true, data: { projectsCompleted: progress.projectsCompleted.length } });
}));

/**
 * GET /api/careers/me/learning-recommendations — explainable "learn next".
 * Combines skill confidence (evidence-based) + goal role + roadmap prereqs.
 * Every item carries a documented WHY (spec §49, §67).
 */
router.get('/me/learning-recommendations', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const data = await buildCourseRecommendations((req as any).user.userId);
  res.json({ success: true, data });
}));

/**
 * POST /api/careers/courses/:slug/ask — lesson-grounded AI tutor (spec §48).
 * RAG-grounded in the lesson content; deterministic fallback keeps content usable.
 */
router.post('/courses/:slug/ask', authenticateToken, requireCandidate,
  [body('question').isString().trim().isLength({ min: 3, max: 500 }), body('lessonId').optional().isString()],
  asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
  if (!course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return;
  }
  const lesson = (course.modules || [])
    .flatMap((m: any) => (m.lessons || []).map((l: any) => ({ ...l, moduleId: m.id })))
    .find((l: any) => l.id === req.body.lessonId) || null;
  const answer = await explainLessonConcept({
    question: String(req.body.question),
    course: { title: course.title, slug: course.slug },
    lesson: lesson ? { title: lesson.title, content: lesson.content, codeExamples: lesson.codeExamples } : null,
  });
  res.json({ success: true, data: answer });
}));

export default router;
