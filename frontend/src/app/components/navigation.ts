/**
 * AETHER — Candidate/admin navigation (spec §4/§5).
 *
 * Logical groups render with headers in the sidebar. `pro` flags entries that
 * carry a subtle PRO badge for free users (presentation only — the backend
 * enforces every entitlement).
 */

export interface NavItem {
  name: string;
  path: string;
  group?: 'OVERVIEW' | 'ASSESS' | 'CAREER' | 'ACCOUNT';
  pro?: boolean;
}

export const candidateNavigation: NavItem[] = [
  // OVERVIEW
  { name: 'Dashboard', path: '/dashboard', group: 'OVERVIEW' },
  { name: 'Analytics', path: '/analytics', group: 'OVERVIEW' },
  // ASSESS
  { name: 'Aptitude', path: '/aptitude', group: 'ASSESS' },
  { name: 'Technical Assessment', path: '/aptitude?round=technical', group: 'ASSESS' },
  { name: 'Coding Practice', path: '/coding', group: 'ASSESS' },
  { name: 'AI Mock Interview', path: '/ai-interview', group: 'ASSESS' },
  // CAREER
  { name: 'Resume Analyzer', path: '/resume', group: 'CAREER' },
  { name: 'Resume Builder', path: '/resume-builder', group: 'CAREER' },
  { name: 'Career Learning', path: '/career-learning', group: 'CAREER' },
  { name: 'Career Intelligence', path: '/career-intelligence', group: 'CAREER', pro: true },
  // ACCOUNT
  { name: 'Subscription', path: '/subscription', group: 'ACCOUNT' },
  { name: 'History', path: '/history', group: 'ACCOUNT' },
  { name: 'Profile', path: '/profile', group: 'ACCOUNT' },
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

export function isNavigationActive(path: string, pathname: string, search: string) {
  const [target, query = ''] = path.split('?');
  return target === pathname && new URLSearchParams(query).toString() === new URLSearchParams(search).toString();
}
