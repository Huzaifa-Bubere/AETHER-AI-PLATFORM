import { JobAlert, alertMinRelevance } from '../models/JobAlert';
import { UserCareerGoal } from '../../career/models/UserCareerGoal';
import { SavedJobSearch } from '../models/SavedJobSearch';
import { buildRankingContext, scoreJobForCandidate, type RankingContext } from './jobRecommendation.service';
import logger from '../../utils/logger';

/**
 * In-app job alerts (spec §G1–§G3).
 *
 * Runs AFTER a scheduled ingestion, over the postings that were newly created
 * by that run. It does not run on page load and it does not alert every user
 * about every posting: a candidate is only alerted for a role they actually
 * target, and only when the posting clears the relevance threshold.
 *
 * No email, no push, no claim of delivery — these are rows the candidate reads
 * inside AETHER.
 */

export interface AlertGenerationReport {
  /** Postings evaluated this run. */
  evaluated: number;
  /** Alerts actually created (duplicates are suppressed by a unique index). */
  created: number;
  /** Candidates skipped because nothing cleared the threshold. */
  skipped: number;
  threshold: number;
}

/** Candidate ids that have at least one active role goal — the only ones alerted. */
export async function candidatesWithTargetRoles(): Promise<string[]> {
  const goals = await UserCareerGoal.find({ isPrimary: true }).select('userId').lean().catch(() => []);
  return [...new Set((goals as any[]).map(g => String(g.userId)))];
}

/**
 * Raise alerts for a batch of newly ingested postings.
 *
 * `postings` must be the NEWLY CREATED postings from the ingestion run — the
 * service intentionally does not rescan history, so re-running ingestion
 * against an unchanged provider produces no new alerts.
 */
export async function generateAlertsForPostings(
  postings: Array<Record<string, unknown>>,
): Promise<AlertGenerationReport> {
  const threshold = alertMinRelevance();
  const report: AlertGenerationReport = { evaluated: postings.length, created: 0, skipped: 0, threshold };

  if (postings.length === 0) return report;

  const candidates = await candidatesWithTargetRoles();
  if (candidates.length === 0) {
    logger.info('[jobAlerts] no candidate has a primary role goal; nothing to alert');
    return report;
  }

  for (const candidateId of candidates) {
    // Saved searches widen the role scope but never replace career goals.
    const savedSearches = await SavedJobSearch.find({ userId: candidateId }).lean().catch(() => []);
    const context: RankingContext = await buildRankingContext(candidateId);
    const searchRoleSlugs = (savedSearches as any[]).map(s => String(s.roleSlug ?? '').toLowerCase()).filter(Boolean);
    const scopedContext: RankingContext = searchRoleSlugs.length
      ? { ...context, targetRoleSlugs: [...new Set([...context.targetRoleSlugs, ...searchRoleSlugs])] }
      : context;

    for (const posting of postings) {
      const roleIds = ((posting.roleIds as string[]) ?? []).map(r => String(r).toLowerCase());
      // Do not alert a candidate about a role they are not targeting.
      if (roleIds.length > 0 && !roleIds.some(r => scopedContext.targetRoleSlugs.includes(r))) {
        report.skipped += 1;
        continue;
      }

      const { recommendationScore, recommendationLabel } = scoreJobForCandidate(posting, scopedContext);
      if (recommendationScore === null || recommendationScore < threshold) {
        report.skipped += 1;
        continue;
      }

      try {
        // Unique index on (userId, jobId, type) makes a duplicate insert a
        // no-op, so re-running ingestion never spams the candidate.
        await JobAlert.create({
          userId: candidateId,
          type: 'NEW_JOB_MATCH',
          jobId: posting._id,
          roleSlug: roleIds.find(r => scopedContext.targetRoleSlugs.includes(r)) ?? null,
          title: String(posting.title ?? ''),
          company: String(posting.company ?? ''),
          recommendationScore,
          recommendationLabel,
          readAt: null,
        });
        report.created += 1;
      } catch (error) {
        // Duplicate key = already alerted. Anything else is logged, never hidden.
        if ((error as { code?: number }).code === 11000) {
          report.skipped += 1;
        } else {
          logger.warn('[jobAlerts] could not raise alert', { err: (error as Error).message });
        }
      }
    }
  }

  logger.info(`[jobAlerts] ${report.created} raised, ${report.skipped} skipped (threshold ${threshold})`);
  return report;
}