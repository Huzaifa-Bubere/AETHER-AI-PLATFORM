import axios from 'axios';
import { LearningTopic, ILearningTopic } from '../models/LearningTopic';
import { LearningVideo } from '../models/LearningVideo';
import logger from '../../utils/logger';

/**
 * AETHER Career Learning — YouTube Data API v3 integration (spec §41–§47).
 *
 * Flow (spec §45):
 *   admin / scheduled refresh → YouTube API → deterministic ranking →
 *   store best videos → frontend reads the database.
 *
 * The frontend NEVER triggers a YouTube search. Every stored number
 * (viewCount, likeCount, duration) comes from real API metadata; when the API
 * does not return a value the field stays null and the UI omits it rather than
 * inventing a number.
 *
 * Ranking (spec §43) is deterministic and explainable:
 *   0.45 · relevanceScore
 * + 0.20 · normalizedViewScore
 * + 0.15 · normalizedLikeRate
 * + 0.10 · channelConfidence
 * + 0.10 · durationSuitability
 * The UI therefore says "Highly viewed, relevant video" / "Popular recommended
 * video" — never "the most liked video on YouTube" unless the data proved it.
 */

export const VIDEO_SELECTION_VERSION = '1.0';
const YT_API = 'https://www.googleapis.com/youtube/v3';

/** Curated confidence table for well-known educational channels. */
const EDUCATIONAL_CHANNEL_CONFIDENCE: Record<string, number> = {
  'freecodecamp.org': 1.0,
  'programming with mosh': 0.95,
  'traversy media': 0.95,
  'corey schafer': 0.95,
  'the net ninja': 0.9,
  'fireship': 0.9,
  'arjancodes': 0.9,
  'techworld with nana': 0.9,
  'hussein nasser': 0.88,
  'jennys lectures': 0.88,
  'neso academy': 0.88,
  'kunal kushwaha': 0.88,
  'apna college': 0.85,
  'codewithharry': 0.85,
  'web dev simplified': 0.85,
  'academind': 0.85,
  'bytebytego': 0.88,
  'gaurav sen': 0.85,
  'abdul bari': 0.88,
  'hackerrank': 0.85,
  'leetcode': 0.85,
  'neetcode': 0.9,
  'bro code': 0.8,
  'cs dojo': 0.82,
  'sentdex': 0.82,
  'dave gray': 0.85,
};

/** Words that suggest low-quality / clickbait content for a *learning* goal. */
const CLICKBAIT_PENALTY = ['shorts', '#shorts', 'reaction', 'drama', 'exposed', 'prank', 'meme', 'tiktok'];

export function isYoutubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

export function refreshIntervalDays(): number {
  const raw = Number(process.env.YOUTUBE_REFRESH_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

// ── Deterministic helpers (unit-tested, no network) ───────────────────────────

/** "PT18M42S" → 1122. Returns null when the ISO-8601 duration is unparseable. */
export function parseIsoDuration(iso?: string | null): number | null {
  if (!iso) return null;
  const m = String(iso).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m;
  const total =
    (Number(d) || 0) * 86400 +
    (Number(h) || 0) * 3600 +
    (Number(min) || 0) * 60 +
    (Number(s) || 0);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

/**
 * Build the search query from the topic, level and learning goal (spec §41).
 * Examples: "Python variables beginner tutorial".
 */
export function buildSearchQuery(topic: Pick<ILearningTopic, 'title' | 'level'>, learningGoal?: string): string {
  const levelWord = topic.level === 'beginner' ? 'beginner' : topic.level === 'advanced' ? 'advanced' : 'intermediate';
  const goal = learningGoal ? ` ${learningGoal}` : '';
  return `${topic.title}${goal} ${levelWord} tutorial`;
}

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

export interface IVideoCandidate {
  youtubeVideoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  publishedAt: Date | null;
}

export interface IRankedCandidate extends IVideoCandidate {
  relevanceScore: number;
  rankingScore: number;
  rankingReasons: string[];
}

/** Relevance of a candidate to the topic (0..1), deterministic. */
export function relevanceScore(candidate: IVideoCandidate, topicTitle: string): number {
  const titleTokens = new Set(tokenize(topicTitle));
  const haystack = tokenize(`${candidate.title} ${candidate.description}`);
  const haySet = new Set(haystack);
  const titleLower = candidate.title.toLowerCase();
  const topicLower = topicTitle.toLowerCase();

  let score = 0;
  // Exact topic phrase in the title is the strongest signal.
  if (titleLower.includes(topicLower)) score += 0.45;
  else if (haystack.slice(0, 12).some(t => t === tokenize(topicLower)[0])) score += 0.2;

  // Token overlap.
  let hits = 0;
  for (const t of titleTokens) if (haySet.has(t)) hits += 1;
  score += titleTokens.size ? (hits / titleTokens.size) * 0.35 : 0;

  // Educational framing.
  if (/\b(tutorial|explained|course|full course|basics|guide|introduction|crash course|learn)\b/i.test(titleLower)) score += 0.12;
  if (/\b(algorithms?|data structures?|interview)\b/i.test(haystack.join(' '))) score += 0.05;

  // Clickbait / non-educational signals.
  if (CLICKBAIT_PENALTY.some(w => titleLower.includes(w))) score -= 0.35;

  return Math.max(0, Math.min(1, score));
}

/** Suitability of a video length for a lesson (peak 6–35 minutes). */
export function durationSuitability(seconds: number | null): number {
  if (seconds == null) return 0.5; // unknown → neutral, never assumed good
  if (seconds < 60) return 0.15;
  if (seconds < 240) return 0.55;
  if (seconds <= 900) return 1.0;
  if (seconds <= 2100) return 0.9;
  if (seconds <= 3600) return 0.7;
  if (seconds <= 7200) return 0.5;
  return 0.3;
}

export function channelConfidence(channelTitle: string): number {
  const key = String(channelTitle || '').toLowerCase().trim();
  for (const [name, value] of Object.entries(EDUCATIONAL_CHANNEL_CONFIDENCE)) {
    if (key === name || key.includes(name)) return value;
  }
  return 0.5; // unknown channel → neutral baseline, never assumed reputable
}

/**
 * Deterministic ranking (spec §43). Weights are fixed and documented; the same
 * candidate set always produces the same order.
 */
export function rankCandidates(candidates: IVideoCandidate[], topicTitle: string): IRankedCandidate[] {
  if (candidates.length === 0) return [];

  const views = candidates.map(c => c.viewCount || 0);
  const maxLogViews = Math.log10(Math.max(1, ...views));

  const likeRates = candidates.map(c =>
    c.viewCount && c.viewCount > 0 && c.likeCount != null ? c.likeCount / c.viewCount : 0
  );
  const maxLikeRate = Math.max(0.0001, ...likeRates);

  return candidates
    .map((c, i) => {
      const relevance = relevanceScore(c, topicTitle);
      const viewScore = maxLogViews > 0 ? Math.log10(1 + (views[i] || 0)) / maxLogViews : 0;
      const likeScore = likeRates[i] / maxLikeRate;
      const channel = channelConfidence(c.channelTitle);
      const duration = durationSuitability(c.durationSeconds);

      const rankingScore =
        0.45 * relevance +
        0.20 * viewScore +
        0.15 * likeScore +
        0.10 * channel +
        0.10 * duration;

      const reasons: string[] = [];
      reasons.push(`Relevance ${Math.round(relevance * 100)}% to "${topicTitle}"`);
      if (c.viewCount != null) reasons.push(`${formatViewCount(c.viewCount)} views`);
      if (c.likeCount != null && c.viewCount) {
        reasons.push(`like rate ${(likeRates[i] * 100).toFixed(2)}%`);
      }
      reasons.push(channel >= 0.8 ? `recognised educational channel (${c.channelTitle})` : `channel: ${c.channelTitle}`);
      if (c.durationSeconds != null) reasons.push(`duration ${formatDuration(c.durationSeconds)}`);

      return {
        ...c,
        relevanceScore: Number(relevance.toFixed(4)),
        rankingScore: Number(rankingScore.toFixed(4)),
        rankingReasons: reasons,
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore || a.youtubeVideoId.localeCompare(b.youtubeVideoId));
}

export function formatViewCount(n: number | null): string {
  if (n == null) return '';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── YouTube Data API v3 calls ────────────────────────────────────────────────

async function ytGet(path: string, params: Record<string, string | number | boolean | undefined>) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured');
  const res = await axios.get(`${YT_API}/${path}`, {
    params: { ...params, key },
    timeout: 15000,
  });
  return res.data;
}

export class YoutubeQuotaError extends Error {
  constructor(message = 'YouTube API quota exceeded') {
    super(message);
    this.name = 'YoutubeQuotaError';
  }
}

/** Search videos for a query, then enrich them with statistics + duration. */
export async function fetchCandidates(query: string, options: { maxResults?: number; language?: string } = {}): Promise<IVideoCandidate[]> {
  const language = options.language || 'en';
  let search: any;
  try {
    search = await ytGet('search', {
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: Math.min(25, Math.max(5, options.maxResults || 12)),
      relevanceLanguage: language,
      videoEmbeddable: true,
      safeSearch: 'strict',
      order: 'relevance',
    });
  } catch (err: any) {
    const reason = err?.response?.data?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new YoutubeQuotaError();
    throw err;
  }

  const items: any[] = search?.items || [];
  const ids = items.map(i => i?.id?.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  let details: any;
  try {
    details = await ytGet('videos', {
      part: 'snippet,statistics,contentDetails',
      id: ids.join(','),
    });
  } catch (err: any) {
    const reason = err?.response?.data?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new YoutubeQuotaError();
    throw err;
  }

  const byId = new Map<string, any>((details?.items || []).map((v: any) => [v.id, v]));

  return ids
    .map((id: string) => {
      const v = byId.get(id);
      if (!v) return null;
      const stats = v.statistics || {};
      const durationIso = v.contentDetails?.duration || '';
      const durationSeconds = parseIsoDuration(durationIso);
      return {
        youtubeVideoId: id,
        title: v.snippet?.title || '',
        description: v.snippet?.description || '',
        channelId: v.snippet?.channelId || '',
        channelTitle: v.snippet?.channelTitle || '',
        thumbnail:
          v.snippet?.thumbnails?.high?.url ||
          v.snippet?.thumbnails?.medium?.url ||
          v.snippet?.thumbnails?.default?.url ||
          '',
        duration: durationIso,
        durationSeconds,
        // Statistics are returned as strings; keep null when the API omits them.
        viewCount: stats.viewCount != null ? Number(stats.viewCount) : null,
        likeCount: stats.likeCount != null ? Number(stats.likeCount) : null,
        publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
      } as IVideoCandidate;
    })
    .filter((c): c is IVideoCandidate => !!c && !!c.title);
}

// ── Persistence / refresh orchestration (spec §45–§47) ───────────────────────

export interface IRefreshResult {
  topicSlug: string;
  searched: boolean;
  candidates: number;
  stored: number;
  deactivated: number;
  reason?: string;
  top?: { title: string; channelTitle: string; rankingScore: number; viewCount: number | null } | null;
}

/**
 * Refresh the stored videos for one topic. Never leaves a broken player behind:
 * candidates that disappear from the API are marked inactive with a reason and
 * replaced by the next best candidate.
 */
export async function refreshTopicVideos(topic: ILearningTopic, options: { maxResults?: number; keep?: number } = {}): Promise<IRefreshResult> {
  const slug = topic.slug;
  if (!isYoutubeConfigured()) {
    return {
      topicSlug: slug, searched: false, candidates: 0, stored: 0, deactivated: 0,
      reason: 'YOUTUBE_API_KEY is not configured — video refresh is disabled (no fabricated metadata).',
      top: null,
    };
  }

  const query = buildSearchQuery(topic, (topic as any).learningGoal);
  const keep = options.keep ?? 4;

  let candidates: IVideoCandidate[];
  try {
    candidates = await fetchCandidates(query, { maxResults: options.maxResults });
  } catch (err: any) {
    if (err instanceof YoutubeQuotaError) {
      return { topicSlug: slug, searched: true, candidates: 0, stored: 0, deactivated: 0, reason: 'YouTube API quota exceeded — keeping previously stored videos.', top: null };
    }
    logger.warn(`YouTube fetch failed for "${slug}": ${err?.message}`);
    return { topicSlug: slug, searched: true, candidates: 0, stored: 0, deactivated: 0, reason: `YouTube API error: ${err?.message}`, top: null };
  }

  if (candidates.length === 0) {
    return { topicSlug: slug, searched: true, candidates: 0, stored: 0, deactivated: 0, reason: 'No embeddable educational videos found for this query.', top: null };
  }

  const ranked = rankCandidates(candidates, topic.title);
  const selected = ranked.slice(0, keep);
  const selectedIds = new Set(selected.map(s => s.youtubeVideoId));

  // Replace videos that no longer appear in the fresh candidate set.
  const existing = await LearningVideo.find({ topicSlug: slug }).lean();
  let deactivated = 0;
  for (const doc of existing) {
    if (doc.active && !selectedIds.has(doc.youtubeVideoId)) {
      await LearningVideo.updateOne(
        { _id: doc._id },
        { $set: { active: false, inactiveReason: 'No longer returned by the latest refresh' } }
      );
      deactivated += 1;
    }
  }

  let stored = 0;
  for (const s of selected) {
    await LearningVideo.updateOne(
      { topicSlug: slug, youtubeVideoId: s.youtubeVideoId },
      {
        $set: {
          topicId: (topic as any)._id,
          topicSlug: slug,
          youtubeVideoId: s.youtubeVideoId,
          title: s.title,
          channelId: s.channelId,
          channelTitle: s.channelTitle,
          thumbnail: s.thumbnail,
          duration: s.duration,
          durationSeconds: s.durationSeconds,
          viewCount: s.viewCount,
          likeCount: s.likeCount,
          publishedAt: s.publishedAt,
          language: 'en',
          relevanceScore: s.relevanceScore,
          rankingScore: s.rankingScore,
          rankingReasons: s.rankingReasons,
          searchQuery: query,
          fetchedAt: new Date(),
          active: true,
          inactiveReason: undefined,
        },
      },
      { upsert: true }
    );
    stored += 1;
  }

  return {
    topicSlug: slug,
    searched: true,
    candidates: candidates.length,
    stored,
    deactivated,
    top: selected[0]
      ? {
          title: selected[0].title,
          channelTitle: selected[0].channelTitle,
          rankingScore: selected[0].rankingScore,
          viewCount: selected[0].viewCount,
        }
      : null,
  };
}

export interface IBulkRefreshSummary {
  configured: boolean;
  selectionVersion: string;
  refreshIntervalDays: number;
  topicsProcessed: number;
  videosStored: number;
  videosDeactivated: number;
  quotaExceeded: boolean;
  results: IRefreshResult[];
  message?: string;
}

/**
 * Refresh every published topic (optionally only stale ones). Quota-aware: on
 * the first quota error the run stops and reports honestly.
 */
export async function refreshAllTopicVideos(options: { slug?: string; limit?: number; onlyStale?: boolean } = {}): Promise<IBulkRefreshSummary> {
  const summary: IBulkRefreshSummary = {
    configured: isYoutubeConfigured(),
    selectionVersion: VIDEO_SELECTION_VERSION,
    refreshIntervalDays: refreshIntervalDays(),
    topicsProcessed: 0,
    videosStored: 0,
    videosDeactivated: 0,
    quotaExceeded: false,
    results: [],
  };

  if (!summary.configured) {
    summary.message = 'YOUTUBE_API_KEY is not configured. Add it to the backend environment and re-run the refresh — no video metadata is fabricated locally.';
    return summary;
  }

  const query: any = { status: 'published' };
  if (options.slug) query.slug = String(options.slug).toLowerCase();

  let topics = await LearningTopic.find(query).sort({ order: 1 }).limit(options.limit || 200).lean();

  if (options.onlyStale) {
    const cutoff = new Date(Date.now() - refreshIntervalDays() * 86400_000);
    const recent = await LearningVideo.find({ active: true, fetchedAt: { $gte: cutoff } })
      .select('topicSlug').lean();
    const fresh = new Set(recent.map(r => r.topicSlug));
    topics = topics.filter(t => !fresh.has(t.slug));
  }

  for (const topic of topics) {
    const result = await refreshTopicVideos(topic as unknown as ILearningTopic);
    summary.results.push(result);
    summary.topicsProcessed += 1;
    summary.videosStored += result.stored;
    summary.videosDeactivated += result.deactivated;
    if (result.reason?.includes('quota')) {
      summary.quotaExceeded = true;
      break;
    }
  }

  return summary;
}

/**
 * Verify stored videos are still available (spec §47): anything the API no
 * longer returns is deactivated so the UI falls back to the next candidate or
 * to "Open on YouTube" instead of rendering a broken player.
 */
export async function validateStoredVideos(limit = 50): Promise<{ checked: number; deactivated: number; reason?: string }> {
  if (!isYoutubeConfigured()) {
    return { checked: 0, deactivated: 0, reason: 'YOUTUBE_API_KEY is not configured.' };
  }

  const videos = await LearningVideo.find({ active: true }).limit(limit).lean();
  if (videos.length === 0) return { checked: 0, deactivated: 0 };

  let deactivated = 0;
  const chunks: typeof videos[] = [];
  for (let i = 0; i < videos.length; i += 50) chunks.push(videos.slice(i, i + 50));

  for (const chunk of chunks) {
    try {
      const data = await ytGet('videos', {
        part: 'id,status',
        id: chunk.map(v => v.youtubeVideoId).join(','),
      });
      const available = new Set<string>(
        (data?.items || [])
          .filter((v: any) => v?.status?.privacyStatus === 'public' && v?.status?.embeddable !== false)
          .map((v: any) => v.id)
      );
      for (const v of chunk) {
        if (!available.has(v.youtubeVideoId)) {
          await LearningVideo.updateOne(
            { _id: v._id },
            { $set: { active: false, inactiveReason: 'Video is no longer public/embeddable' } }
          );
          deactivated += 1;
        }
      }
    } catch (err: any) {
      return { checked: videos.length, deactivated, reason: `Validation stopped: ${err?.message}` };
    }
  }

  return { checked: videos.length, deactivated };
}
