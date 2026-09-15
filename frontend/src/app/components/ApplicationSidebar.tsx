import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { adminNavigation, candidateNavigation, isNavigationActive } from './navigation';

export function ApplicationSidebar() {
  const { isAuthenticated, user } = useAuthStore();
  const { pathname, search } = useLocation();
  const inSession = /^\/(interview-room|coding-interview|ai-interview\/|aptitude\/attempts\/)/.test(pathname);
  const publicPage = ['/', '/login', '/signup', '/admin/login', '/forgot-password', '/reset-password', '/verify-email'].includes(pathname);
  if (!isAuthenticated || publicPage || inSession) return null;
  const isAdmin = user?.auth?.role === 'admin';
  return <aside className="application-sidebar hidden xl:flex fixed top-16 bottom-0 left-0 w-60 flex-col border-r border-border bg-card p-5 z-30">
    <p className="px-3 pt-3 pb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{isAdmin ? 'Administration' : 'Your preparation'}</p>
    <nav aria-label="Workspace navigation" className="space-y-1">
      {(isAdmin ? adminNavigation : candidateNavigation).map(item => {
        const active = isNavigationActive(item.path, pathname, search);
        return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined}
          className={`block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item.name}</Link>;
      })}
    </nav>
    <div className="mt-auto rounded-lg border border-border p-4 text-sm text-muted-foreground">Prepare with purpose.<br /><span className="text-foreground">Build your next opportunity.</span></div>
  </aside>;
}
