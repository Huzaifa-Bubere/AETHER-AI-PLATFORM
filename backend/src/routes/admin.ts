import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Interview from '../models/Interview';
import Resume from '../models/Resume';
import IntegrityEvent, { MAX_INTEGRITY_WARNINGS } from '../models/IntegrityEvent';
import logger from '../utils/logger';
import { billingOverview, recentPayments } from '../services/billingAnalytics.service';
import { systemSnapshot } from '../services/systemMetrics.service';
import { readRecentErrors } from '../services/errorLog.service';
import path from 'path';

const router = express.Router();

/**
 * % change against the previous comparable period.
 *
 * Returns null when there is no prior period, so the dashboard can render
 * "no prior data" instead of an invented percentage — the old stat cards shipped
 * literal strings like '+23%' that had no relationship to any query.
 */
function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Percentage-point change between two averages; null when either is missing. */
function percentPoints(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) return null;
  return current - previous;
}

// NOTE: requireAdmin middleware is applied when mounting this router in app.ts
// This allows for easier testing

// Get platform statistics
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      'auth.lastLogin': { $gte: thirtyDaysAgo }
    });
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfThisMonth } });
    const newUsersLastMonth = await User.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth }
    });

    // Get interview statistics
    const totalInterviews = await Interview.countDocuments();
    const completedInterviews = await Interview.countDocuments({ status: 'completed' });
    const inProgressInterviews = await Interview.countDocuments({ status: 'in-progress' });
    const interviewsLast30 = await Interview.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const interviewsPrev30 = await Interview.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    // An interview still 'in-progress' a day later is abandoned, not active.
    const staleInProgress = await Interview.countDocuments({
      status: 'in-progress', createdAt: { $lt: staleCutoff }
    });

    /** Mean overall score over a window, with the number of interviews behind it. */
    const averageScore = async (from?: Date, to?: Date) => {
      const match: Record<string, unknown> = {
        status: 'completed',
        'analysis.overallScore': { $exists: true, $gt: 0 },
      };
      if (from || to) {
        match.createdAt = {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lt: to } : {}),
        };
      }
      const rows = await Interview.aggregate([
        { $match: match },
        { $group: { _id: null, average: { $avg: '$analysis.overallScore' }, sample: { $sum: 1 } } },
      ]);
      const row = rows[0];
      if (!row || !row.sample) return { average: null as number | null, sample: 0 };
      return { average: Math.round(row.average) as number | null, sample: row.sample as number };
    };

    const [allTimeScore, last30Score, prev30Score] = await Promise.all([
      averageScore(),
      averageScore(thirtyDaysAgo),
      averageScore(sixtyDaysAgo, thirtyDaysAgo),
    ]);

    const avgSuccessRate = allTimeScore.average ?? 0;

    // Get interview type breakdown
    const interviewTypes = await Interview.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Get user growth data (last 7 months)
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get subscription breakdown
    const subscriptionStats = await User.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
    ]);

    // Sessions a human should look at: attempts that reached the warning limit,
    // counted as distinct (module, attempt) pairs rather than raw event rows.
    const flagged = await IntegrityEvent.aggregate([
      { $match: { warningNumber: { $gte: MAX_INTEGRITY_WARNINGS } } },
      { $group: { _id: { module: '$module', attemptId: '$attemptId' } } },
      { $count: 'count' },
    ]);
    const reviewRequiredSessions = flagged[0]?.count ?? 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newThisMonth: newUsersThisMonth,
          newLastMonth: newUsersLastMonth,
          growth: userGrowth,
          subscriptions: subscriptionStats
        },
        interviews: {
          total: totalInterviews,
          completed: completedInterviews,
          inProgress: inProgressInterviews,
          avgSuccessRate,
          avgSuccessRateSample: allTimeScore.sample,
          successRateLast30Days: last30Score.average,
          last30Days: interviewsLast30,
          previous30Days: interviewsPrev30,
          byType: interviewTypes
        },
        needsReview: {
          total: reviewRequiredSessions + staleInProgress,
          integritySessions: reviewRequiredSessions,
          staleInProgress,
          warningLimit: MAX_INTEGRITY_WARNINGS,
        },
        // Real movement between comparable periods. A null means there is nothing
        // to compare against, and the UI prints that instead of a made-up number.
        deltas: {
          usersPercent: percentChange(newUsersThisMonth, newUsersLastMonth),
          interviewsPercent: percentChange(interviewsLast30, interviewsPrev30),
          successRatePoints: percentPoints(prev30Score.average, last30Score.average),
        },
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform statistics',
      message: error.message
    });
  }
}));

// Get all users (paginated)
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const plan = req.query.plan as string;

  const query: any = {};
  
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { 'profile.firstName': { $regex: search, $options: 'i' } },
      { 'profile.lastName': { $regex: search, $options: 'i' } }
    ];
  }

  if (plan) {
    query['subscription.plan'] = plan;
  }

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .select('-password');

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Get specific user details
router.get('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Get user's interviews
  const interviews = await Interview.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(10);

  // Get user's resumes
  const resumes = await Resume.find({ userId: user._id })
    .sort({ uploadDate: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      user,
      interviews,
      resumes
    }
  });
}));

// Update user
router.put('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { subscription, auth, profile } = req.body;
  
  const user = await User.findById(req.params.id);
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Update subscription if provided
  if (subscription) {
    if (subscription.plan) user.subscription.plan = subscription.plan;
    if (subscription.status) user.subscription.status = subscription.status;
  }

  // Update auth if provided
  if (auth) {
    if (auth.role) user.auth.role = auth.role;
    if (auth.isVerified !== undefined) user.auth.isVerified = auth.isVerified;
  }

  // Update profile if provided
  if (profile) {
    if (profile.firstName) user.profile.firstName = profile.firstName;
    if (profile.lastName) user.profile.lastName = profile.lastName;
  }

  await user.save();

  logger.info(`Admin updated user: ${user.email}`);

  res.json({
    success: true,
    data: user,
    message: 'User updated successfully'
  });
}));

// Delete user
router.delete('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Delete user's interviews
  await Interview.deleteMany({ userId: user._id });
  
  // Delete user's resumes
  await Resume.deleteMany({ userId: user._id });
  
  // Delete user
  await User.findByIdAndDelete(req.params.id);

  logger.info(`Admin deleted user: ${user.email}`);

  res.json({
    success: true,
    message: 'User and all associated data deleted successfully'
  });
}));

// Get all interviews (paginated)
router.get('/interviews', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const type = req.query.type as string;

  const query: any = {};
  
  if (status) query.status = status;
  if (type) query.type = type;

  const interviews = await Interview.find(query)
    .populate('userId', 'email profile.firstName profile.lastName')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Interview.countDocuments(query);

  res.json({
    success: true,
    data: interviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

/**
 * Get system metrics.
 *
 * All measured: CPU from `os.cpus()` tick deltas (loadavg — the previous source —
 * is permanently 0 on Windows), memory from the OS, request counts from the
 * counter middleware, and a bounded history buffer the sampler fills in. When
 * the database is unreachable the endpoint still answers with `database: null`
 * rather than failing the whole panel.
 */
router.get('/system-metrics', asyncHandler(async (_req: Request, res: Response) => {
  const snapshot = systemSnapshot();

  let database: { size: number; collections: number; indexes: number } | null = null;
  try {
    const dbStats = await mongoose.connection.db.stats();
    database = {
      size: dbStats.dataSize,
      collections: dbStats.collections,
      indexes: dbStats.indexes,
    };
  } catch (error: any) {
    logger.warn('System metrics: database stats unavailable', { err: error?.message });
  }

  res.json({
    success: true,
    data: {
      cpu: snapshot.cpu,
      cpuMeasured: snapshot.cpuMeasured,
      memory: snapshot.memory,
      uptime: snapshot.uptimeSeconds,
      platform: snapshot.platform,
      nodeVersion: snapshot.nodeVersion,
      cores: snapshot.cores,
      totalMemoryBytes: snapshot.totalMemoryBytes,
      freeMemoryBytes: snapshot.freeMemoryBytes,
      samplingIntervalMs: snapshot.samplingIntervalMs,
      maxSamples: snapshot.maxSamples,
      requests: snapshot.requests,
      history: snapshot.history,
      database,
      timestamp: new Date(),
    }
  });
}));

/**
 * Get error logs — every rotated Winston file, newest first, grouped.
 *
 * The first version read only `logs/error.log` and parsed its `timestamp` with
 * `new Date()`. Both were wrong for this logger (see errorLog.service.ts): the
 * file had been rotated so the live file was `error1.log`, and the timestamp
 * shape `YYYY-MM-DD HH:mm:ss:ms` is not parseable by `new Date`, so every row
 * rendered "unknown".
 */
router.get('/error-logs', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const dir = path.join(process.cwd(), 'logs');

  try {
    const report = readRecentErrors({ dir, limit });
    res.json({
      success: true,
      data: { entries: report.entries, meta: report.meta },
      total: report.entries.length,
      message: report.meta.files.length === 0
        ? 'No error log file found yet — nothing has been logged at error level'
        : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to read log files', message: err.message });
  }
}));

// Get recent activity
router.get('/activity', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;

  // Get recent interviews
  const recentInterviews = await Interview.find()
    .populate('userId', 'email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('userId type status createdAt analysis.overallScore');

  const activities = recentInterviews.map(interview => ({
    user: (interview.userId as any)?.email || 'Unknown',
    action: `${interview.status === 'completed' ? 'Completed' : 'Started'} ${interview.type} Interview`,
    time: interview.createdAt,
    score: interview.status === 'completed' ? interview.analysis?.overallScore : null
  }));

  res.json({
    success: true,
    data: activities
  });
}));

/**
 * Get AI performance metrics — real DB aggregations only.
 *
 * The dashboard previously asked for `responseTime`, `questionQuality` and
 * `feedbackAccuracy`, none of which this endpoint ever returned: the rings drew
 * `undefined%`. Every metric below is a real average over stored interviews, or
 * is reported with `sampleSize: 0` and rendered as "no data".
 */
router.get('/ai-metrics', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await Interview.aggregate([
    { $match: { status: 'completed', 'analysis.overallScore': { $exists: true, $gt: 0 } } },
    {
      $group: {
        _id: null,
        sampleSize: { $sum: 1 },
        overallScore: { $avg: '$analysis.overallScore' },
        relevance: { $avg: '$analysis.contentMetrics.relevanceScore' },
        clarity: { $avg: '$analysis.contentMetrics.communicationClarity' },
        structure: { $avg: '$analysis.contentMetrics.structureScore' },
        // Each sub-metric needs its own denominator: not every stored analysis
        // filled every content metric.
        relevanceSample: { $sum: { $cond: [{ $ne: [{ $type: '$analysis.contentMetrics.relevanceScore' }, 'missing'] }, 1, 0] } },
        claritySample: { $sum: { $cond: [{ $ne: [{ $type: '$analysis.contentMetrics.communicationClarity' }, 'missing'] }, 1, 0] } },
        structureSample: { $sum: { $cond: [{ $ne: [{ $type: '$analysis.contentMetrics.structureScore' }, 'missing'] }, 1, 0] } },
      },
    },
  ]);

  const agg = rows[0] ?? null;
  const round = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;

  /** A value is published only when the metric has its own sample behind it. */
  const withSample = (value: number | null, sample: number): number | null => (sample > 0 ? value : null);

  const sampleSize = agg?.sampleSize ?? 0;
  const overallScore = withSample(agg ? round(agg.overallScore) : null, sampleSize);
  const relevanceSample = agg?.relevanceSample ?? 0;
  const claritySample = agg?.claritySample ?? 0;
  const structureSample = agg?.structureSample ?? 0;
  const relevance = withSample(agg ? round(agg.relevance) : null, relevanceSample);
  const clarity = withSample(agg ? round(agg.clarity) : null, claritySample);
  const structure = withSample(agg ? round(agg.structure) : null, structureSample);

  res.json({
    success: true,
    data: {
      totalAnalyzed: sampleSize,
      // Scalar fields kept for older consumers of this endpoint.
      accuracy: overallScore ?? 0,
      avgRelevanceScore: relevance ?? 0,
      avgClarityScore: clarity ?? 0,
      // The panel renders THIS list: label, value, scale and sample size travel
      // together, so the client never has to guess a range or print a fake 0.
      metrics: [
        { key: 'overallScore', label: 'Average overall score', value: overallScore, unit: '%', max: 100, sampleSize },
        { key: 'relevance', label: 'Content relevance', value: relevance, unit: '%', max: 100, sampleSize: relevanceSample },
        { key: 'clarity', label: 'Communication clarity', value: clarity, unit: '%', max: 100, sampleSize: claritySample },
        { key: 'structure', label: 'Answer structure', value: structure, unit: '%', max: 100, sampleSize: structureSample },
      ],
      note: 'Averages over stored interview analyses; metrics with no sample are shown as “no data”.',
    },
  });
}));

// ==================== RESUME MANAGEMENT ====================

// Get all resumes (paginated)
router.get('/resumes', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;

  const query: any = {};
  
  if (search) {
    query.filename = { $regex: search, $options: 'i' };
  }

  const resumes = await Resume.find(query)
    .populate('userId', 'email profile.firstName profile.lastName')
    .sort({ uploadDate: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Resume.countDocuments(query);

  res.json({
    success: true,
    data: resumes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Get specific resume
router.get('/resumes/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const resume = await Resume.findById(req.params.id)
    .populate('userId', 'email profile.firstName profile.lastName');
  
  if (!resume) {
    res.status(404).json({
      success: false,
      error: 'Resume not found'
    });
    return;
  }

  res.json({
    success: true,
    data: resume
  });
}));

// Delete resume
router.delete('/resumes/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const resume = await Resume.findById(req.params.id);
  
  if (!resume) {
    res.status(404).json({
      success: false,
      error: 'Resume not found'
    });
    return;
  }

  await Resume.findByIdAndDelete(req.params.id);

  logger.info(`Admin deleted resume: ${resume.filename}`);

  res.json({
    success: true,
    message: 'Resume deleted successfully'
  });
}));

// ==================== INTERVIEW DETAIL MANAGEMENT ====================

// Get specific interview
router.get('/interviews/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const interview = await Interview.findById(req.params.id)
    .populate('userId', 'email profile.firstName profile.lastName');
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: 'Interview not found'
    });
    return;
  }

  res.json({
    success: true,
    data: interview
  });
}));

// Update interview
router.put('/interviews/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { status, type } = req.body;
  
  const interview = await Interview.findById(req.params.id);
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: 'Interview not found'
    });
    return;
  }

  if (status) interview.status = status;
  if (type) interview.type = type;

  await interview.save();

  logger.info(`Admin updated interview: ${interview._id}`);

  res.json({
    success: true,
    data: interview,
    message: 'Interview updated successfully'
  });
}));

// Delete interview
router.delete('/interviews/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const interview = await Interview.findById(req.params.id);
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: 'Interview not found'
    });
    return;
  }

  await Interview.findByIdAndDelete(req.params.id);

  logger.info(`Admin deleted interview: ${interview._id}`);

  res.json({
    success: true,
    message: 'Interview deleted successfully'
  });
}));

// ==================== BULK OPERATIONS ====================

// Bulk delete users
router.post('/users/bulk-delete', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'userIds array is required'
    });
    return;
  }

  // Delete users' interviews
  await Interview.deleteMany({ userId: { $in: userIds } });
  
  // Delete users' resumes
  await Resume.deleteMany({ userId: { $in: userIds } });
  
  // Delete users
  const result = await User.deleteMany({ _id: { $in: userIds } });

  logger.info(`Admin bulk deleted ${result.deletedCount} users`);

  res.json({
    success: true,
    message: `Successfully deleted ${result.deletedCount} users and their associated data`
  });
}));

// ==================== EXPORT FEATURES ====================

// Export users to CSV
router.get('/export/users', asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find().select('-password').lean();

  // Convert to CSV format
  const csvHeader = 'Email,First Name,Last Name,Role,Plan,Status,Created At\n';
  const csvRows = users.map(user => 
    `${user.email},${user.profile.firstName},${user.profile.lastName},${user.auth.role || 'user'},${user.subscription.plan},${user.subscription.status},${user.createdAt}`
  ).join('\n');

  const csv = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
  res.send(csv);
}));

// Export interviews to CSV
router.get('/export/interviews', asyncHandler(async (req: Request, res: Response) => {
  const interviews = await Interview.find()
    .populate('userId', 'email')
    .lean();

  // Convert to CSV format
  const csvHeader = 'User Email,Type,Status,Score,Created At\n';
  const csvRows = interviews.map(interview => 
    `${(interview.userId as any)?.email || 'Unknown'},${interview.type},${interview.status},${interview.analysis?.overallScore || 'N/A'},${interview.createdAt}`
  ).join('\n');

  const csv = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=interviews.csv');
  res.send(csv);
}));

// ── Admin billing dashboard (spec §66-§69) ───────────────────────────────────

/** GET /api/admin/billing — real aggregation over Subscription/Payment/UsageLedger. */
router.get('/billing', asyncHandler(async (_req: Request, res: Response) => {
  const [overview, payments] = await Promise.all([
    billingOverview(),
    recentPayments(20),
  ]);
  res.json({ success: true, data: { ...overview, recentPayments: payments } });
}));

/** GET /api/admin/billing/subscriptions — subscription rows with user info, filterable. */
router.get('/billing/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const { planId, status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const Subscription = mongoose.model('Subscription');
  const filter: Record<string, unknown> = {};
  if (planId && ['free', 'pro', 'campus'].includes(planId)) filter.planId = planId;
  if (status) filter.status = status.toUpperCase();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [rows, total] = await Promise.all([
    (Subscription as any).find(filter)
      .sort({ updatedAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .populate('userId', 'email profile.firstName profile.lastName')
      .select('planId status billingInterval currentPeriodEnd cancelAtPeriodEnd accessEndsAt createdAt updatedAt')
      .lean(),
    (Subscription as any).countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: rows.map((s: any) => ({
      id: s._id,
      user: s.userId ? { email: s.userId.email, name: `${s.userId.profile?.firstName || ''} ${s.userId.profile?.lastName || ''}`.trim() || s.userId.email } : null,
      planId: s.planId,
      status: s.status,
      billingInterval: s.billingInterval || null,
      currentPeriodEnd: s.currentPeriodEnd || null,
      cancelAtPeriodEnd: !!s.cancelAtPeriodEnd,
      accessEndsAt: s.accessEndsAt || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
  });
}));

/** GET /api/admin/billing/export — CSV of subscriptions (spec §69 institutional reports). */
router.get('/billing/export', asyncHandler(async (_req: Request, res: Response) => {
  const Subscription = mongoose.model('Subscription');
  const rows = await (Subscription as any).find()
    .sort({ updatedAt: -1 })
    .populate('userId', 'email')
    .select('planId status billingInterval currentPeriodEnd cancelAtPeriodEnd createdAt updatedAt')
    .lean();

  const csvHeader = 'User Email,Plan,Status,Billing Interval,Current Period End,Cancel At Period End,Created At,Updated At\n';
  const csvRows = rows.map((s: any) =>
    `${(s.userId as any)?.email || 'Unknown'},${s.planId},${s.status},${s.billingInterval || ''},${s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString() : ''},${!!s.cancelAtPeriodEnd},${new Date(s.createdAt).toISOString()},${new Date(s.updatedAt).toISOString()}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
  res.send(csvHeader + csvRows);
}));

export default router;
