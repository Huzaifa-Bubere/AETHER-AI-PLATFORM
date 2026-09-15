export const candidateNavigation = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Aptitude', path: '/aptitude' },
  { name: 'Technical Assessment', path: '/aptitude?round=technical' },
  { name: 'Coding Practice', path: '/interview-setup?type=coding' },
  { name: 'AI Mock Interview', path: '/interview-setup' },
  { name: 'Resume Analyzer', path: '/resume' },
  { name: 'History', path: '/history' },
  { name: 'Profile', path: '/profile' },
];

export const adminNavigation = [
  { name: 'Admin Dashboard', path: '/admin' },
  { name: 'Assessment Overview', path: '/admin/aptitude' },
  { name: 'Questions', path: '/admin/aptitude/questions' },
  { name: 'Test Management', path: '/admin/aptitude/tests' },
  { name: 'Knowledge Sources', path: '/admin/knowledge' },
  { name: 'Students', path: '/admin/aptitude/students' },
  { name: 'Profile', path: '/profile' },
];

export function isNavigationActive(path: string, pathname: string, search: string) {
  const [target, query = ''] = path.split('?');
  return target === pathname && new URLSearchParams(query).toString() === new URLSearchParams(search).toString();
}
