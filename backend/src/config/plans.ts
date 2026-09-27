/**
 * AETHER — Centralized plan & entitlement configuration (spec §44-§51).
 *
 * Single source of truth for plans, prices, features and credit costs.
 * Backend enforces entitlements; frontend consumes the same config through
 * /api/payment/plans-config so the UI never hardcodes limits.
 */

export type PlanId = 'free' | 'pro' | 'campus';
export type BillingInterval = 'monthly' | 'halfyear' | 'yearly';

/** Central AI credit costs per operation type (spec §48). */
export const AI_CREDIT_COSTS: Record<string, number> = {
  'resume.aiRewrite': 1,
  'ats.aiExplanation': 1,
  'learning.aiTutor': 1,
  'interview.question': 5,
  'interview.report': 10,
  'analytics.aiInsight': 2,
};

export type EntitlementKey =
  // resume
  | 'resume.unlimitedVersions'
  | 'resume.allTemplates'
  | 'resume.advancedATS'
  | 'resume.semanticJD'
  | 'resume.fullJDLists'
  | 'resume.aiWriting'
  // learning
  | 'learning.fullCatalog'
  | 'learning.aiTutor'
  | 'learning.projects'
  | 'learning.certificates'
  // analytics
  | 'analytics.advanced'
  | 'analytics.skillProfile'
  // career
  | 'career.marketIntelligence'
  // interview
  | 'interview.advanced'
  // admin-only visibility
  | 'platform.whiteglove';

/** Feature catalogue rendered by the pricing page (no hardcoded limits in UI). */
export const FEATURE_CATALOG: Array<{ feature: EntitlementKey | 'core'; label: string }> = [
  { feature: 'core', label: 'Core assessments (aptitude, technical)' },
  { feature: 'core', label: 'Resume Quality Analysis' },
  { feature: 'core', label: 'Basic resume builder + PDF download' },
  { feature: 'resume.advancedATS', label: 'Full ATS analysis & bullet breakdown' },
  { feature: 'resume.semanticJD', label: 'Semantic Resume ↔ JD matching' },
  { feature: 'resume.unlimitedVersions', label: 'Unlimited resume versions' },
  { feature: 'resume.allTemplates', label: 'All ATS-safe templates' },
  { feature: 'resume.aiWriting', label: 'AI resume writing assistant' },
  { feature: 'learning.fullCatalog', label: 'Full learning catalog & roadmap' },
  { feature: 'learning.aiTutor', label: 'AI course tutor (Ask AETHER)' },
  { feature: 'learning.projects', label: 'Learning projects & evidence' },
  { feature: 'learning.certificates', label: 'Course completion certificates' },
  { feature: 'analytics.advanced', label: 'Advanced analytics & trends' },
  { feature: 'analytics.skillProfile', label: 'Unified skill profile' },
  { feature: 'career.marketIntelligence', label: 'Career market intelligence' },
  { feature: 'interview.advanced', label: 'More AI interview sessions' },
];

export interface PlanLimits {
  /** null = unlimited */
  resumeVersions: number | null;
  aiCreditsPerMonth: number | null;
  aiInterviewsPerMonth: number | null;
  jdTopConcepts: number | null;
  aptitudeAttemptsPerMonth: number | null;
}

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  /** rupee prices per interval; campus is custom */
  pricing: Partial<Record<BillingInterval, number>> | 'custom';
  limits: PlanLimits;
  entitlements: EntitlementKey[];
  stripeEnvKeys?: Partial<Record<BillingInterval, string>>;
  highlight?: boolean;
  ctaLabel: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For exploring AETHER',
    pricing: { monthly: 0, halfyear: 0, yearly: 0 },
    limits: {
      resumeVersions: 1,
      aiCreditsPerMonth: 20,
      aiInterviewsPerMonth: 1,
      jdTopConcepts: 5,
      aptitudeAttemptsPerMonth: 10,
    },
    entitlements: [],
    ctaLabel: 'Current Plan',
  },
  pro: {
    id: 'pro',
    name: 'AETHER Pro',
    tagline: 'For serious placement preparation',
    pricing: { monthly: 299, halfyear: 1499, yearly: 2499 },
    limits: {
      resumeVersions: null,
      aiCreditsPerMonth: 300,
      aiInterviewsPerMonth: 8,
      jdTopConcepts: null,
      aptitudeAttemptsPerMonth: null,
    },
    entitlements: [
      'resume.unlimitedVersions',
      'resume.allTemplates',
      'resume.advancedATS',
      'resume.semanticJD',
      'resume.fullJDLists',
      'resume.aiWriting',
      'learning.fullCatalog',
      'learning.aiTutor',
      'learning.projects',
      'learning.certificates',
      'analytics.advanced',
      'analytics.skillProfile',
      'career.marketIntelligence',
      'interview.advanced',
    ],
    highlight: true,
    ctaLabel: 'Upgrade to Pro',
    stripeEnvKeys: {
      monthly: 'STRIPE_PRICE_PRO_MONTHLY',
      halfyear: 'STRIPE_PRICE_PRO_HALF_YEAR',
      yearly: 'STRIPE_PRICE_PRO_YEARLY',
    },
  },
  campus: {
    id: 'campus',
    name: 'Campus',
    tagline: 'For colleges and placement cells',
    pricing: 'custom',
    limits: {
      resumeVersions: null,
      aiCreditsPerMonth: null,
      aiInterviewsPerMonth: null,
      jdTopConcepts: null,
      aptitudeAttemptsPerMonth: null,
    },
    entitlements: [
      'resume.unlimitedVersions',
      'resume.allTemplates',
      'resume.advancedATS',
      'resume.semanticJD',
      'resume.fullJDLists',
      'resume.aiWriting',
      'learning.fullCatalog',
      'learning.aiTutor',
      'learning.projects',
      'learning.certificates',
      'analytics.advanced',
      'analytics.skillProfile',
      'career.marketIntelligence',
      'interview.advanced',
      'platform.whiteglove',
    ],
    ctaLabel: 'Contact / Request Access',
  },
};

/** Backend-only: resolve a Stripe price id from env at runtime. */
export function stripePriceId(plan: PlanId, interval: BillingInterval): string | undefined {
  const key = PLANS[plan]?.stripeEnvKeys?.[interval];
  return key ? process.env[key] : undefined;
}

/** Deterministic savings % between intervals — UI shows only computed values. */
export function savingsPercent(from: BillingInterval, to: BillingInterval): number | null {
  const a = PLANS.pro.pricing;
  if (a === 'custom' || !a[from] || !a[to]) return null;
  const monthsBetween: Record<BillingInterval, number> = { monthly: 1, halfyear: 6, yearly: 12 };
  const monthlyA = (a[from] as number) / monthsBetween[from];
  const monthlyB = (a[to] as number) / monthsBetween[to];
  if (monthlyA <= 0) return null;
  return Math.round(((monthlyA - monthlyB) / monthlyA) * 100);
}

/** Client-safe plan config (no env keys). */
export function publicPlanConfig() {
  return {
    plans: Object.values(PLANS).map(p => ({
      id: p.id, name: p.name, tagline: p.tagline, pricing: p.pricing,
      limits: p.limits, entitlements: p.entitlements, highlight: !!p.highlight, ctaLabel: p.ctaLabel,
      features: FEATURE_CATALOG.filter(f => f.feature === 'core' || p.entitlements.includes(f.feature as EntitlementKey)).map(f => f.label),
    })),
    creditCosts: AI_CREDIT_COSTS,
    savings: {
      monthlyVsHalfyear: savingsPercent('monthly', 'halfyear'),
      monthlyVsYearly: savingsPercent('monthly', 'yearly'),
    },
  };
}
