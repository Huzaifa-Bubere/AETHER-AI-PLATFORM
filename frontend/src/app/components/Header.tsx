import { Menu, X, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button } from './Button';
import {
  adminNavigation,
  candidateNavigation,
  isNavigationActive,
} from './navigation';
import toast from 'react-hot-toast';

import aetherLogo from '../../assets/aether-logo.png';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const location = useLocation();

  const {
    logout,
    isAuthenticated,
    user,
  } = useAuthStore();

  const isAdmin = user?.auth?.role === 'admin';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const navItems = isAuthenticated
    ? isAdmin
      ? adminNavigation
      : candidateNavigation
    : [
        {
          name: 'Features',
          path: '/#features',
        },
        {
          name: 'How it works',
          path: '/#how-it-works',
        },
        {
          name: 'Pricing',
          path: '/#pricing',
        },
      ];

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await logout();
    } catch {
      toast.error('Could not sign out. Please retry.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-card">
      {/* Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-card focus:p-3"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-5 lg:px-8">

        {/* =====================================================
            AETHER LOGO
        ===================================================== */}
        <Link
          to={
            isAuthenticated
              ? isAdmin
                ? '/admin'
                : '/dashboard'
              : '/'
          }
          className="group flex items-center gap-3"
          aria-label="AETHER home"
        >
          {/* Logo */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 group-hover:shadow-md">
            <img
              src={aetherLogo}
              alt="AETHER Logo"
              className="h-full w-full object-contain p-1"
            />
          </div>

          {/* Brand */}
          <div className="flex flex-col leading-none">
            <span className="text-xl font-bold tracking-[0.16em] text-slate-900">
              AETHER
            </span>

            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              AI for Careers
            </span>
          </div>
        </Link>

        {/* =====================================================
            PUBLIC NAVIGATION
        ===================================================== */}
        {!isAuthenticated && (
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 md:flex"
          >
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.name}
              </a>
            ))}
          </nav>
        )}

        {/* =====================================================
            AUTHENTICATED HEADER MESSAGE
        ===================================================== */}
        {isAuthenticated && (
          <p className="ml-12 mr-auto hidden text-sm text-muted-foreground xl:block">
            Placement preparation, connected.
          </p>
        )}

        {/* =====================================================
            DESKTOP PROFILE / AUTH
        ===================================================== */}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <User className="h-4 w-4" />

                <span>
                  {user?.profile?.firstName || 'Profile'}
                </span>
              </Link>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button
                  variant="ghost"
                  size="sm"
                >
                  Sign in
                </Button>
              </Link>

              <Link to="/signup">
                <Button size="sm">
                  Create account
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* =====================================================
            MOBILE MENU BUTTON
        ===================================================== */}
        <button
          type="button"
          aria-label={
            mobileMenuOpen
              ? 'Close navigation'
              : 'Open navigation'
          }
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          className={`rounded-lg p-2 transition-colors hover:bg-muted ${
            isAuthenticated ? 'xl:hidden' : 'md:hidden'
          }`}
          onClick={() =>
            setMobileMenuOpen((value) => !value)
          }
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* =====================================================
          MOBILE NAVIGATION
      ===================================================== */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-card p-4 xl:hidden"
        >
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isNavigationActive(
                item.path,
                location.pathname,
                location.search
              );

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border pt-3 md:hidden">
            {isAuthenticated ? (
              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full"
              >
                {loggingOut
                  ? 'Signing out...'
                  : 'Sign out'}
              </Button>
            ) : (
              <Link
                to="/login"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}