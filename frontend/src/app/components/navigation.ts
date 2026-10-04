/**
 * AETHER — single source of truth for application navigation.
 *
 * Spec §3/§7: one canonical route per feature. Header, ApplicationSidebar, the
 * mobile drawer and the dashboard all read from this file — no component
 * hardcodes a path of its own.
 *
 * `path` is always the CANONICAL route. Legacy routes that were renamed live in
 * `LEGACY_ROUTE_REDIRECTS` below and are wired in App.tsx as permanent redirects,
 * so old bookmarks and shared links keep working without creating duplicate pages.
 *
 * `pro` is presentation only (a subtle badge for free users). Every entitlement
 * is enforced server-side by EntitlementService — never by branching on the plan
 * string in React.
 */

export type NavGroup = 'OVERVIEW' | 'ASSESS' | 'CAREER' | 'PLACEMENT' | 'ACCOUNT';

export interface NavItem {
  name: string;
  path: string;
  group?: NavGroup;
  pro?: boolean;
  /** Optional short description used by the mobile drawer and command palette. */
  description?: string;
}

/** Rendered in the order given. */
export const NAV_GROUP_ORDER: NavGroup[] = ['OVERVIEW', 'ASSESS', 'CAREER', 'PLACEMENT', 'ACCOUNT'];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  OVERVIEW: 'Overview',
  ASSESS: 'Assess',
  CAREER: 'Career',
  PLACEMENT: 'Placement',
  ACCOUNT: 'Account',
};

export const candidateNavigation: NavItem[] = [
  // OVERVIEW
  { name: 'Dashboard', path: '/dashboard', group: 'OVERVIEW', description: 'Your preparation at a glance' },
  { name: 'Profile', path: '/profile', group: 'OVERVIEW', description: 'Professional profile, skills and streak' },
  { name: 'Analytics', path: '/analytics', group: 'OVERVIEW', description: 'Deep-dive performance analytics' },

  // ASSESS
  { name: 'Aptitude', path: '/aptitude', group: 'ASSESS', description: 'Aptitude test rounds' },
  { name: 'Technical Assessment', path: '/technical', group: 'ASSESS', description: 'Technical MCQ round' },
  { name: 'Coding Practice', path: '/coding', group: 'ASSESS', description: 'Problems, submissions and complexity analysis' },
  { name: 'AI Mock Interview', path: '/interview', group: 'ASSESS', description: 'Adaptive role-based mock interviews' },

  // CAREER
  { name: 'Resume Analyzer', path: '/resume-analyzer', group: 'CAREER', description: 'ATS quality and JD matching' },
  { name: 'Resume Builder', path: '/resume-builder', group: 'CAREER', description: 'Build role-specific, ATS-safe resumes' },
  { name: 'Career Learning', path: '/career-learning', group: 'CAREER', description: 'Role roadmaps and lessons' },
  { name: 'Career Intelligence', path: '/career-intelligence', group: 'CAREER', pro: true, description: 'Real job-market skill demand' },

  // PLACEMENT
  { name: 'Jobs', path: '/jobs', group: 'PLACEMENT', description: 'Current job postings' },
  { name: 'Job Fit', path: '/job-fit', group: 'PLACEMENT', description: 'Job requirement match' },
  { name: 'Saved Jobs', path: '/saved-jobs', group: 'PLACEMENT', description: 'Your application tracker' },

  // ACCOUNT
  { name: 'Subscription', path: '/subscription', group: 'ACCOUNT' },
  { name: 'History', path: '/history', group: 'ACCOUNT', description: 'Everything you have completed' },
  { name: 'Settings', path: '/settings', group: 'ACCOUNT', description: 'Account, preferences and notifications' },
];

export const adminNavigation: NavItem[] = [
  { name: 'Admin Dashboard', path: '/admin' },
  { name: 'Assessment Overview', path: '/admin/aptitude' },
  { name: 'Questions', path: '/admin/aptitude/questions' },
  { name: 'Test Management', path: '/admin/aptitude/tests' },
  { name: 'Knowledge Sources', path: '/admin/knowledge' },
  { name: 'Coding Problems', path: '/admin/coding' },
  { name: 'Career & Market', path: '/admin/careers' },
  { name: 'Learning Content', path: '/admin/learning-content' },
  { name: 'Billing', path: '/admin/billing' },
  { name: 'Students', path: '/admin/aptitude/students' },
  { name: 'Profile', path: '/profile' },
];

/**
 * Canonical home for a signed-in candidate (spec §4). The dashboard IS the home;
 * the marketing page lives at /welcome and is never the post-login destination.
 */
export const CANDIDATE_HOME = '/dashboard';
export const ADMIN_HOME = '/admin';
export const MARKETING_HOME = '/welcome';
export const LOGIN = '/login';
export const SIGNUP = '/signup';
export const ADMIN_LOGIN = '/admin/login';

/**
 * Legacy → canonical redirects (spec §3). Keys are the OLD path patterns, values
 * the canonical ones. App.tsx mounts these so renamed features never 404 and we
 * never end up with two pages for one feature.
 */
export const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  '/career': '/career-learning',
  '/learning': '/career-learning',
  '/courses': '/career-learning',
  '/resume': '/resume-analyzer',
  '/ai-interview': '/interview',
  '/technical-assessment': '/technical',
  '/aptitude/technical': '/technical',
};

/** Routes that must never render the app chrome (no sidebar, no workspace header). */
export const PUBLIC_ROUTES = [
  MARKETING_HOME,
  '/login',
  '/signup',
  '/admin/login',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/payment/success',
];

/**
 * Routes that render full-bleed (an exam or interview is in progress): the
 * sidebar and workspace padding are suppressed so nothing competes with the UI.
 */
export const IMMERSIVE_ROUTE_PATTERNS: RegExp[] = [
  /^\/interview-room/,
  /^\/coding-interview/,
  /^\/interview\/.+/,
  /^\/aptitude\/attempts\//,
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_ROUTE_PATTERNS.some(re => re.test(pathname));
}

export function isNavigationActive(path: string, pathname: string, search: string): boolean {
  const [target, query = ''] = path.split('?');
  if (target !== pathname) return false;
  // Exact query match, so two nav entries that differ only by ?round= can never
  // both highlight. Entries with no query are active regardless of extra params.
  const expected = new URLSearchParams(query);
  if (expected.size === 0) return true;
  const actual = new URLSearchParams(search);
  return [...expected.entries()].every(([k, v]) => actual.get(k) === v);
}
