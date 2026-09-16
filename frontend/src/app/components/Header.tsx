import { Brain, Menu, X, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button } from './Button';
import { adminNavigation, candidateNavigation, isNavigationActive } from './navigation';
import toast from 'react-hot-toast';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const { logout, isAuthenticated, user } = useAuthStore();
  const isAdmin = user?.auth?.role === 'admin';
  useEffect(() => setMobileMenuOpen(false), [location.pathname, location.search]);
  const navItems = isAuthenticated ? (isAdmin ? adminNavigation : candidateNavigation) : [
    { name: 'Features', path: '/#features' },
    { name: 'How it works', path: '/#how-it-works' },
    { name: 'Pricing', path: '/#pricing' },
  ];
  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); }
    catch { toast.error('Could not sign out. Please retry.'); }
    finally { setLoggingOut(false); }
  };
  return <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:bg-card focus:p-3">Skip to content</a>
    <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-5 lg:px-8">
      <Link to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/'} className="flex items-center gap-3" aria-label="ATHER home">
        <span className="rounded-lg bg-primary p-2"><Brain className="h-5 w-5 text-primary-foreground" /></span>
        <span className="text-xl font-bold tracking-widest">AETHER</span>
      </Link>
      {!isAuthenticated && <nav aria-label="Main navigation" className="hidden md:flex gap-7">
        {navItems.map(item => <a key={item.path} href={item.path} className="text-sm font-medium text-muted-foreground hover:text-foreground">{item.name}</a>)}
      </nav>}
      {isAuthenticated && <p className="hidden xl:block mr-auto ml-12 text-sm text-muted-foreground">Placement preparation, connected.</p>}
      <div className="hidden md:flex items-center gap-3 ml-auto">
        {isAuthenticated ? <>
          <Link to="/profile" className="flex items-center gap-2 text-sm text-muted-foreground"><User className="h-4 w-4" />{user?.profile?.firstName || 'Profile'}</Link>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Signing out...' : 'Sign out'}</Button>
        </> : <><Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link><Link to="/signup"><Button size="sm">Create account</Button></Link></>}
      </div>
      <button aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation"
        className={`rounded-lg p-2 hover:bg-muted ${isAuthenticated ? 'xl:hidden' : 'md:hidden'}`} onClick={() => setMobileMenuOpen(v => !v)}>
        {mobileMenuOpen ? <X /> : <Menu />}
      </button>
    </div>
    {mobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-card p-4 xl:hidden">
      {navItems.map(item => <Link key={item.path} to={item.path} aria-current={isNavigationActive(item.path, location.pathname, location.search) ? 'page' : undefined}
        className="block rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary">{item.name}</Link>)}
      <div className="mt-3 border-t border-border pt-3 md:hidden">
        {isAuthenticated ? <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>Sign out</Button> : <Link to="/login" className="block px-4 py-3 text-primary">Sign in</Link>}
      </div>
    </nav>}
  </header>;
}
