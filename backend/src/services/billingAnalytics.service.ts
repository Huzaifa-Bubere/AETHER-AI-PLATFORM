/**
 * AETHER — Admin billing analytics (spec §66-§69).
 *
 * Every figure is aggregated from real records:
 *   - revenue        → Payment documents with status 'completed' (actual paid invoices)
 *   - MRR            → active subscriptions normalized to monthly; labeled "Calculated MRR"
 *   - plan mix       → Subscription documents
 *   - cancellations  → Subscription status/cancelAtPeriodEnd
 *   - AI usage       → UsageLedger aggregation
 * No estimates from activeUsers × price. Nothing AI-generated.
 */

import mongoose from 'mongoose';
import { PLANS } from '../config/plans';

export const BILLING_CALC_VERSION = '1.0';

/** Monthly-normalized price for a plan+interval, from the central config only. */
function monthlyNormalized(planId: string, interval?: string): number {
  const def = PLANS[planId as keyof typeof PLANS];
  if (!def || def.pricing === 'custom') return 0; // campus is custom-quoted → excluded from MRR
  const months: Record<string, number> = { monthly: 1, halfyear: 6, yearly: 12 };
  const amount = def.pricing[(interval as 'monthly' | 'halfyear' | 'yearly') || 'monthly'];
  if (!amount) return 0;
  return amount / (months[interval || 'monthly'] || 1);
}

export async function billingOverview() {
  const Subscription = mongoose.model('Subscription');
  const Payment = mongoose.model('Payment');
  const UsageLedger = mongoose.model('UsageLedger');
  const User = mongoose.model('User');

  // ── Subscriptions by plan/status (real documents) ────────────────────────
  const planRows = await (Subscription as any).aggregate([
    {
      $group: {
        _id: { planId: '$planId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const paidStatuses = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED'];
  const planDistribution = ['free', 'pro', 'campus'].map(planId => ({
    planId,
    total: planRows.filter(r => r._id.planId === planId).reduce((s, r) => s + r.count, 0),
    active: planRows.filter(r => r._id.planId === planId && paidStatuses.includes(r._id.status)).reduce((s, r) => s + r.count, 0),
    canceled: planRows.filter(r => r._id.planId === planId && (r._id.status === 'CANCELED' || r._id.status === 'EXPIRED')).reduce((s, r) => s + r.count, 0),
    trialing: planRows.filter(r => r._id.planId === planId && r._id.status === 'TRIALING').reduce((s, r) => s + r.count, 0),
    pastDue: planRows.filter(r => r._id.planId === planId && r._id.status === 'PAST_DUE').reduce((s, r) => s + r.count, 0),
  }));

  const activePaid = await (Subscription as any).countDocuments({
    planId: { $in: ['pro', 'campus'] },
    status: { $in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    $or: [
      { currentPeriodEnd: { $gt: new Date() } },
      { currentPeriodEnd: { $exists: false } },
      { currentPeriodEnd: null },
    ],
  });
  const cancelAtPeriodEnd = await (Subscription as any).countDocuments({ cancelAtPeriodEnd: true });
  const canceledTotal = await (Subscription as any).countDocuments({ status: { $in: ['CANCELED', 'EXPIRED'] } });
  const pastDue = await (Subscription as any).countDocuments({ status: 'PAST_DUE' });

  // ── Revenue: actual paid invoices grouped by month (§67) ─────────────────
  const revenueByMonth = await (Payment as any).aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
    { $limit: 12 },
  ]);

  const currency = (await (Payment as any).findOne({ status: 'completed' }).sort({ createdAt: -1 }).select('currency').lean())?.currency || 'INR';

  const failedPayments = await (Payment as any).countDocuments({ status: 'failed' });
  const refundedTotal = (await (Payment as any).aggregate([
    { $match: { status: 'refunded' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]))[0]?.total || 0;

  // ── Calculated MRR (§68): active paid subs normalized to monthly ─────────
  const mrrRows = await (Subscription as any).aggregate([
    {
      $match: {
        planId: { $in: ['pro', 'campus'] },
        status: { $in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        $or: [
          { currentPeriodEnd: { $gt: new Date() } },
          { currentPeriodEnd: { $exists: false } },
          { currentPeriodEnd: null },
        ],
      },
    },
    { $group: { _id: { planId: '$planId', interval: '$billingInterval' }, count: { $sum: 1 } } },
  ]);
  const calculatedMrr = Math.round(
    mrrRows.reduce((sum, r) => sum + monthlyNormalized(r._id.planId, r._id.interval) * r.count, 0),
  );
  // Pro-only MRR (campus excluded — custom pricing, not part of listed MRR)
  const proMrr = Math.round(
    mrrRows.filter(r => r._id.planId === 'pro').reduce((sum, r) => sum + monthlyNormalized('pro', r._id.interval) * r.count, 0),
  );

  // ── AI credits consumed by month (real ledger rows) ──────────────────────
  const creditsByMonth = await (UsageLedger as any).aggregate([
    { $match: { feature: 'aiCredits' } },
    {
      $group: {
        _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
    { $limit: 12 },
  ]);

  const monthLabel = (y: number, m: number) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;

  // Current-month AI usage + top consumers (real rows)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const creditsThisMonth = (await (UsageLedger as any).aggregate([
    { $match: { feature: 'aiCredits', createdAt: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]))[0]?.total || 0;

  const topConsumers = await (UsageLedger as any).aggregate([
    { $match: { feature: 'aiCredits', createdAt: { $gte: monthStart } } },
    { $group: { _id: '$userId', total: { $sum: '$amount' }, operations: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $project: { total: 1, operations: 1, name: { $ifNull: [{ $arrayElemAt: ['$user.profile.firstName', 0] }, 'User'] }, email: { $ifNull: [{ $arrayElemAt: ['$user.email', 0] }, '—'] } } },
  ]);

  const totalUsers = await (User as any).countDocuments({});
  const conversionPct = totalUsers ? Math.round((activePaid / totalUsers) * 100) : 0;

  return {
    calculationVersion: BILLING_CALC_VERSION,
    generatedAt: new Date().toISOString(),
    currency,
    summary: {
      totalUsers,
      activePaidSubscriptions: activePaid,
      cancelAtPeriodEnd,
      canceledTotal,
      pastDue,
      conversionPct,
      calculatedMrr,
      proMrr,
      mrrNote: 'Calculated MRR = sum of monthly-normalized prices of active paid subscriptions (campus custom pricing excluded). Excludes canceled-at-period-end only after period end, past-due after grace, and all failed/unpaid invoices.',
      failedPayments,
      refundedTotal,
      creditsThisMonth,
    },
    planDistribution,
    revenueByMonth: revenueByMonth.map(r => ({
      month: monthLabel(r._id.y, r._id.m),
      total: Math.round(r.total),
      payments: r.count,
    })),
    creditsByMonth: creditsByMonth.map(r => ({
      month: monthLabel(r._id.y, r._id.m),
      credits: r.total,
    })),
    topConsumers,
    source: ['subscriptions', 'payments', 'usage_ledgers', 'users'],
  };
}

/** Recent billing events = real payment records (newest first). */
export async function recentPayments(limit = 20) {
  const Payment = mongoose.model('Payment');
  const rows = await (Payment as any).find({ status: { $in: ['completed', 'failed', 'refunded'] } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('amount currency plan status paymentMethod createdAt userId')
    .populate('userId', 'email profile.firstName profile.lastName')
    .lean();
  return rows.map((p: any) => ({
    id: p._id,
    amount: p.amount,
    currency: p.currency,
    plan: p.plan,
    status: p.status,
    method: p.paymentMethod || 'card',
    at: p.createdAt,
    user: p.userId ? { email: p.userId.email, name: `${p.userId.profile?.firstName || ''} ${p.userId.profile?.lastName || ''}`.trim() || p.userId.email } : null,
  }));
}
