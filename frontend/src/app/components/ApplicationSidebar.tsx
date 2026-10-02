import { Link, useLocation } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import {
  adminNavigation,
  candidateNavigation,
  isImmersiveRoute,
  isNavigationActive,
  isPublicRoute,
  NAV_GROUP_LABELS,
  NAV_GROUP_ORDER,
} from './navigation';

export function ApplicationSidebar() {
  const { isAuthenticated, user } = useAuthStore();
  const { pathname, search } = useLocation();
  const sub = useSubscriptionStore();
  // Route classification comes from navigation.ts so the sidebar, the header and
  // the mobile drawer can never disagree about what is public or immersive.
  if (!isAuthenticated || isPublicRoute(pathname) || isImmersiveRoute(pathname)) return null;
  const isAdmin = user?.auth?.role === 'admin';
  const items = isAdmin ? adminNavigation : candidateNavigation;
  const isFree = !isAdmin && sub.planId === 'free';

  // Group items for candidates; admins keep the flat list.
  const groups = isAdmin
    ? null
    : NAV_GROUP_ORDER.map(g => ({
        key: g,
        label: NAV_GROUP_LABELS[g],
        items: items.filter(i => i.group === g),
      })).filter(g => g.items.length > 0);

  const linkClass = (active: boolean) =>
    `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`;

  return (
    <aside className="application-sidebar hidden xl:flex fixed top-16 bottom-0 left-0 w-60 flex-col border-r border-border bg-card p-5 z-30 overflow-y-auto">
      {!isAdmin && <p className="px-3 pt-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your preparation</p>}
      <nav aria-label="Workspace navigation" className="space-y-5">
        {groups
          ? groups.map(g => (
              <div key={g.key}>
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400/80">{g.label}</p>
                <div className="space-y-0.5">
                  {g.items.map(item => {
                    const active = isNavigationActive(item.path, pathname, search);
                    return (
                      <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                        <span>{item.name}</span>
                        {item.pro && isFree && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[8.5px] font-black tracking-wider text-indigo-600">
                            <Sparkles className="w-2 h-2" /> PRO
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          : (
            <div className="space-y-0.5">
              {items.map(item => {
                const active = isNavigationActive(item.path, pathname, search);
                return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={linkClass(active)}>{item.name}</Link>;
              })}
            </div>
          )}
      </nav>

      {isFree && (
        <Link to="/subscription" className="mt-auto rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 p-4 text-white shadow-sm hover:shadow transition-shadow">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-80"><Sparkles className="w-3 h-3" /> AETHER Pro</p>
          <p className="text-xs mt-1.5 leading-relaxed opacity-90">Full ATS + JD match, unlimited resumes, advanced analytics.</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold">Upgrade <ArrowRight className="w-3 h-3" /></span>
        </Link>
      )}
      {!isFree && (
        <div className="mt-auto rounded-lg border border-border p-4 text-sm text-muted-foreground">Prepare with purpose.<br /><span className="text-foreground">Build your next opportunity.</span></div>
      )}
    </aside>
  );
}
