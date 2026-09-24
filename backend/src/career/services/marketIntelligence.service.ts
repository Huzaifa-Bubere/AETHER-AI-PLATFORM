/**
 * MarketIntelligenceService — the evidence pipeline.
 *
 *   External job data (admin CSV/JSON import or permitted provider)
 *     → ingest (MarketJob rows)
 *     → skill extraction (deterministic dictionary)
 *     → role normalization (marketAliases)
 *     → aggregation per role
 *     → trend calculation vs previous comparable snapshot
 *     → RoleTrendSnapshot (precomputed; UI never touches raw jobs)
 *
 * Trend rules (documented):
 *   pct change vs previous period:
 *     ≤ -5 pts                  → TRENDING_DOWN
 *     -5..+5 pts                → STABLE
 *     > +5 pts                  → TRENDING_UP
 *     absent before, present now → NEW_SIGNAL
 *   Minimum sample: postings < MIN_SAMPLE → trend = 'INSUFFICIENT_DATA' and
 *   percentage is still stored but flagged; UI must show the sample size.
 */
import { MarketJob, RoleTrendSnapshot, MarketDataSource, SkillDictionaryEntry, type ISkillStat } from '../models/market';
import { CareerRole } from '../models/CareerRole';
import { extractSkills, mapRoleToSlug, registerCustomEntries, type DictionaryEntry } from './skillExtraction';
import logger from '../../utils/logger';

const MIN_SAMPLE = 30;
const TREND_THRESHOLD_PTS = 5;

export interface RawJobInput {
  job_title?: string;
  title?: string;
  description?: string;
  location?: string;
  city?: string;
  country?: string;
  experience?: string;
  company?: string;
  date?: string | number;
  postedAt?: string;
  externalId?: string;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  unmappedRoles: number;
  rolesMapped: Record<string, number>;
  errors: Array<{ row: number; reason: string }>;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      cur.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.length > 1 || cur[0] !== '') rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== '' || cur.length) { cur.push(field); if (cur.length > 1 || cur[0] !== '') rows.push(cur); }
  const headers = (rows.shift() || []).map(h => h.trim());
  return { headers, rows };
}

async function loadDictionaryOverrides(): Promise<void> {
  try {
    const entries = await SkillDictionaryEntry.find({}).lean();
    const mapped: DictionaryEntry[] = entries.map(e => ({
      canonical: e.canonical.toLowerCase().trim(),
      name: e.canonical,
      skillType: e.skillType || 'TOOL',
      aliases: e.aliases || [],
    }));
    registerCustomEntries(mapped);
  } catch (err) { logger.warn('market.dictionaryOverride.failed', { err: (err as Error).message }); }
}

function normalizeExperience(exp?: string): 'internship' | 'entry' | 'mid' | 'senior' | undefined {
  const e = (exp || '').toLowerCase();
  if (!e) return undefined;
  if (/intern|trainee|fresher|graduate/.test(e)) return 'internship';
  if (/senior|sr\.?|lead|principal|architect|[5-9]\+?\s*(year|yr)/.test(e)) return 'senior';
  if (/mid|intermediate|[2-4]\+?\s*(year|yr)/.test(e)) return 'mid';
  if (/entry|junior|jr\.?|0\s*-?\s*1\s*(year|yr)|[01]\s*(year|yr)/.test(e)) return 'entry';
  return undefined;
}

function classifySkillType(entries: Map<string, DictionaryEntry>, slug: string): string {
  return entries.get(slug)?.skillType || 'CONCEPT';
}

export const marketIntelligenceService = {
  /** Ingest raw job rows: normalize role, extract skills, store MarketJob records. */
  async ingest(rows: RawJobInput[], opts: { sourceName: string; region?: string; provider?: string; importedBy: string; periodStart?: Date; periodEnd?: Date }): Promise<ImportResult> {
    await loadDictionaryOverrides();
    const batchId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const roles = await CareerRole.find({ isActive: true }).select('slug marketAliases name').lean();
    const roleAliases = roles.map(r => ({ slug: r.slug, aliases: [...(r.marketAliases || []), r.name] }));

    const result: ImportResult = { batchId, totalRows: rows.length, acceptedRows: 0, rejectedRows: 0, unmappedRoles: 0, rolesMapped: {}, errors: [] };
    const buffer: Array<Record<string, unknown>> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = (row.job_title || row.title || '').toString().trim();
      const description = (row.description || '').toString().trim();
      if (!title || !description) {
        result.rejectedRows++;
        result.errors.push({ row: i + 1, reason: 'Missing job_title or description' });
        continue;
      }
      const roleSlug = mapRoleToSlug(title, roleAliases);
      if (!roleSlug) { result.unmappedRoles++; }
      const loc = (row.location || row.city || '').toString();
      const city = (row.city || loc.split(',')[0] || '').toString().trim();
      const country = (row.country || (loc.includes(',') ? loc.split(',').pop()!.trim() : opts.region || 'India')).toString().trim();
      const postedAt = row.postedAt ? new Date(row.postedAt) : row.date ? new Date(row.date) : undefined;
      const extracted = extractSkills(`${title}. ${description}`);
      buffer.push({
        provider: opts.provider || 'import',
        externalId: row.externalId,
        title,
        normalizedRole: roleSlug || 'unmapped',
        company: (row.company || '').toString().trim() || undefined,
        country,
        city,
        experienceLevel: normalizeExperience(row.experience),
        description: description.slice(0, 20000),
        extractedSkills: extracted.skills,
        postedAt: postedAt && !isNaN(postedAt.getTime()) ? postedAt : undefined,
        ingestedAt: new Date(),
        batchId,
      });
      if (roleSlug) result.rolesMapped[roleSlug] = (result.rolesMapped[roleSlug] || 0) + 1;
      result.acceptedRows++;
    }

    if (buffer.length) await MarketJob.insertMany(buffer, { ordered: false });

    const periodEnd = opts.periodEnd || new Date();
    const periodStart = opts.periodStart || new Date(periodEnd.getTime() - 30 * 24 * 3600 * 1000);
    await MarketDataSource.create({
      batchId,
      sourceName: opts.sourceName,
      sourceType: 'import',
      region: opts.region || 'India',
      periodStart,
      periodEnd,
      totalRows: result.totalRows,
      acceptedRows: result.acceptedRows,
      rejectedRows: result.rejectedRows,
      rolesMapped: result.rolesMapped,
      importedBy: opts.importedBy,
    });
    logger.info('market.ingested', { batchId, accepted: result.acceptedRows, rejected: result.rejectedRows });
    return result;
  },

  /** Aggregate stored jobs for a role+region into a snapshot with trends vs previous snapshot. */
  async createSnapshot(roleSlug: string, region: string, periodStart: Date, periodEnd: Date, sourceName = 'Market snapshot'): Promise<{ snapshotId: string; totalPostings: number } | null> {
    const jobs = await MarketJob.find({
      normalizedRole: roleSlug,
      $or: [{ country: new RegExp(region, 'i') }, { city: new RegExp(region, 'i') }, { region: undefined }],
      ingestedAt: { $gte: periodStart, $lte: periodEnd },
    }).select('extractedSkills experienceLevel ingestedAt').lean() as any[];

    if (!jobs.length) return null;

    const skillCounts = new Map<string, number>();
    const perType = new Map<string, Map<string, number>>();
    const expDist: Record<string, number> = {};
    const pairCounts = new Map<string, number>();
    let postingsWithSkills = 0;

    const role = await CareerRole.findOne({ slug: roleSlug }).select('skills').lean();
    const typeBySlug = new Map<string, string>((role?.skills || []).map((s: any) => [s.skillSlug, s.skillType]));

    for (const job of jobs) {
      const skills = ((job.extractedSkills || []) as string[]).filter(Boolean);
      if (skills.length) postingsWithSkills++;
      const uniq = [...new Set(skills)];
      for (const s of uniq) {
        skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
        const type = typeBySlug.get(s) || 'CONCEPT';
        if (!perType.has(type)) perType.set(type, new Map());
        const m = perType.get(type)!;
        m.set(s, (m.get(s) || 0) + 1);
      }
      const exp = job.experienceLevel || 'unspecified';
      expDist[exp] = (expDist[exp] || 0) + 1;
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          const key = [uniq[i], uniq[j]].sort().join('+');
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        }
      }
    }

    const total = Math.max(1, postingsWithSkills);
    const previous = await RoleTrendSnapshot.previousForRole(roleSlug, region, periodStart);
    const prevMap = new Map<string, { percentage: number }>((previous?.topSkills || []).map(s => [s.skill, { percentage: s.percentage }]));

    const topSkills: ISkillStat[] = [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([skill, count]) => {
        const percentage = Math.round((count / total) * 1000) / 10;
        const prev = prevMap.get(skill);
        let trend: string;
        if (jobs.length < MIN_SAMPLE) trend = 'INSUFFICIENT_DATA';
        else if (!prev) trend = 'NEW_SIGNAL';
        else {
          const delta = percentage - prev.percentage;
          trend = delta > TREND_THRESHOLD_PTS ? 'TRENDING_UP' : delta < -TREND_THRESHOLD_PTS ? 'TRENDING_DOWN' : 'STABLE';
        }
        return { skill, count, percentage, previousPercentage: prev?.percentage, trend };
      });

    const pickType = (t: string) =>
      [...(perType.get(t)?.entries() || [])].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s]) => s);

    const skillPairs = [...pairCounts.entries()]
      .filter(([, count]) => count >= Math.max(2, total * 0.05))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key, count]) => ({ skills: key.split('+') as [string, string], count, percentage: Math.round((count / total) * 1000) / 10 }));

    const snapshot = await RoleTrendSnapshot.create({
      role: roleSlug,
      region,
      periodStart,
      periodEnd,
      totalPostings: jobs.length,
      topSkills,
      topTools: pickType('TOOL'),
      topFrameworks: pickType('FRAMEWORK'),
      topDatabases: pickType('DATABASE'),
      topCloud: pickType('CLOUD'),
      skillPairs,
      experienceDistribution: expDist,
      sourceMetadata: { sourceName, sourceType: 'import', previousSnapshotId: previous?._id?.toString() },
      generatedAt: new Date(),
    });
    logger.info('market.snapshot.created', { role: roleSlug, region, postings: jobs.length, skills: topSkills.length });
    return { snapshotId: (snapshot._id as any).toString(), totalPostings: jobs.length };
  },

  /** Latest snapshot for a role (all regions; caller labels region). */
  async latestSnapshot(roleSlug: string) {
    await loadDictionaryOverrides();
    return RoleTrendSnapshot.latestForRole(roleSlug);
  },
};
