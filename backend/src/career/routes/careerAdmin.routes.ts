import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { CareerRole } from '../models/CareerRole';
import { Skill } from '../models/Skill';
import { RoleTrendSnapshot, MarketDataSource, SkillDictionaryEntry, MarketJob } from '../models/market';
import { marketIntelligenceService, parseCsv, type RawJobInput } from '../services/marketIntelligence.service';
import { normalizeSkillName } from '../services/skillExtraction';
import logger from '../../utils/logger';

const router = Router();
router.use(authenticateToken, requireAdmin);

// ── Roles CRUD ───────────────────────────────────────────────────────────────

/** GET /api/admin/careers — list all roles incl. inactive. */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const roles = await CareerRole.find({}).select('slug name category isActive skills roadmapStages roadmapNodes lastReviewedAt updatedAt').sort({ name: 1 });
  res.json({ success: true, data: roles });
}));

/** POST /api/admin/careers — create role. */
router.post('/', [
  body('slug').isString().isLength({ min: 2, max: 60 }).matches(/^[a-z0-9-]+$/),
  body('name').isString().isLength({ min: 2, max: 80 }),
  body('description').isString().isLength({ min: 10 }),
  body('category').isString().notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const exists = await CareerRole.findOne({ slug: req.body.slug.toLowerCase() });
  if (exists) {
    res.status(409).json({ success: false, message: 'A role with this slug already exists' });
    return;
  }
  const role = await CareerRole.create({ ...req.body, slug: String(req.body.slug).toLowerCase(), lastReviewedAt: new Date() });
  logger.info('career.role.created', { slug: role.slug, by: (req as any).user.userId });
  res.status(201).json({ success: true, data: role });
}));

/** PUT /api/admin/careers/:id — update role (skills, stages, resources, etc.). */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  delete req.body.slug; // slug immutable
  const role = await CareerRole.findByIdAndUpdate(req.params.id, { ...req.body, lastReviewedAt: new Date() }, { new: true, runValidators: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Role not found' });
    return;
  }
  res.json({ success: true, data: role });
}));

/** DELETE /api/admin/careers/:id — soft-disable. */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Role not found' });
    return;
  }
  res.json({ success: true, data: { slug: role.slug, isActive: role.isActive } });
}));

/** PUT /api/admin/careers/:id/enable — re-enable. */
router.put('/:id/enable', asyncHandler(async (req: Request, res: Response) => {
  const role = await CareerRole.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
  if (!role) {
    res.status(404).json({ success: false, message: 'Role not found' });
    return;
  }
  res.json({ success: true, data: { slug: role.slug, isActive: role.isActive } });
}));

// ── Skills taxonomy ──────────────────────────────────────────────────────────

/** POST /api/admin/careers/skills — upsert canonical skill with aliases. */
router.post('/skills', [
  body('name').isString().notEmpty(),
  body('skillType').isIn(['LANGUAGE', 'FRAMEWORK', 'DATABASE', 'CLOUD', 'DEVOPS', 'TOOL', 'CONCEPT', 'SOFT_SKILL']),
  body('aliases').optional().isArray(),
], asyncHandler(async (req: Request, res: Response) => {
  const { name, skillType, aliases, category, description } = req.body;
  const slug = String(name).toLowerCase().trim().replace(/[^a-z0-9.+-]/g, '-');
  const allAliases = [...new Set([...(aliases || []).map((a: string) => String(a).toLowerCase().trim()), String(name).toLowerCase()])].filter(Boolean);
  const skill = await Skill.findOneAndUpdate(
    { slug },
    { $set: { name, skillType, aliases: allAliases, category: category || 'general', description } },
    { upsert: true, new: true },
  );
  // Mirror into the extraction dictionary override so imports recognize it.
  await SkillDictionaryEntry.updateOne({ canonical: slug }, { $set: { aliases: allAliases, skillType } }, { upsert: true });
  res.json({ success: true, data: skill });
}));

/** PUT /api/admin/careers/skills/:id/aliases — edit aliases. */
router.put('/skills/:id/aliases', [body('aliases').isArray()], asyncHandler(async (req: Request, res: Response) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) {
    res.status(404).json({ success: false, message: 'Skill not found' });
    return;
  }
  skill.aliases = (req.body.aliases || []).map((a: string) => String(a).toLowerCase().trim()).filter(Boolean);
  await skill.save();
  await SkillDictionaryEntry.updateOne({ canonical: skill.slug }, { $set: { aliases: skill.aliases } }, { upsert: true });
  res.json({ success: true, data: skill });
}));

/** GET /api/admin/careers/skills/normalize?name=... — test alias normalization. */
router.get('/skills/normalize', [query('name').isString()], asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { input: req.query.name, canonical: normalizeSkillName(String(req.query.name))?.name ?? null } });
}));

// ── Market import & snapshots ────────────────────────────────────────────────

/** POST /api/admin/market/import — CSV or JSON job rows. */
router.post('/market/import', [
  body('format').isIn(['csv', 'json']),
  body('sourceName').isString().notEmpty().isLength({ max: 120 }),
  body('region').optional().isString(),
  body('payload').isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const { format, sourceName, payload, region } = req.body;
  let rows: RawJobInput[];
  if (format === 'csv') {
    const parsed = parseCsv(String(payload));
    if (!parsed.headers.length) {
      res.status(400).json({ success: false, message: 'CSV appears to have no header row' });
      return;
    }
    rows = parsed.rows.map(r => {
      const obj: Record<string, string> = {};
      parsed.headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
      return obj;
    });
  } else {
    const parsed = JSON.parse(String(payload));
    rows = Array.isArray(parsed) ? parsed : parsed.jobs || parsed.postings || [];
    if (!Array.isArray(rows)) {
      res.status(400).json({ success: false, message: 'JSON must be an array of job rows or { jobs: [...] }' });
      return;
    }
  }
  const result = await marketIntelligenceService.ingest(rows, {
    sourceName, region: region || 'India', importedBy: (req as any).user.userId,
  });
  res.json({ success: true, data: result });
}));

/** POST /api/admin/market/process — (re)generate snapshot for a role from stored jobs. */
router.post('/market/process', [
  body('role').isString().notEmpty(),
  body('region').optional().isString(),
  body('periodStart').optional().isISO8601(),
  body('periodEnd').optional().isISO8601(),
  body('sourceName').optional().isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const { role, region, periodStart, periodEnd, sourceName } = req.body;
  const end = periodEnd ? new Date(periodEnd) : new Date();
  const start = periodStart ? new Date(periodStart) : new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const result = await marketIntelligenceService.createSnapshot(String(role).toLowerCase(), region || 'India', start, end, sourceName);
  if (!result) {
    res.status(404).json({ success: false, message: 'No stored job postings matched this role/region/period. Import data first.' });
    return;
  }
  res.json({ success: true, data: result });
}));

/** GET /api/admin/market/snapshots — audit list. */
router.get('/market/snapshots', asyncHandler(async (req: Request, res: Response) => {
  const snapshots = await RoleTrendSnapshot.find({}).sort({ periodEnd: -1 }).limit(100)
    .select('role region periodStart periodEnd totalPostings sourceMetadata generatedAt');
  const imports = await MarketDataSource.find({}).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: { snapshots, imports } });
}));

/** GET /api/admin/market/jobs/count — stored jobs count (transparency). */
router.get('/market/jobs/count', asyncHandler(async (req: Request, res: Response) => {
  const count = await MarketJob.countDocuments({});
  res.json({ success: true, data: { count } });
}));

export default router;
