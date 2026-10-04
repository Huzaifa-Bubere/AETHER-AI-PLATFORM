import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from '../ui/sheet';
import { Logo } from './Logo';
import { LOGIN, SIGNUP } from '../navigation';

/**
 * Sticky marketing header (spec §7/§8).
 *
 * Nav items are SAME-PAGE anchors, never fake router routes. Smooth scrolling
 * is used where the browser supports it; the hash still updates so the link is
 * shareable and keyboard/touch behaviour stays native.
 *
 * The thin bottom border only appears once the page is scrolled (§7).
 */
const LINKS = [
  { id: 'product', label: 'Product' },
  { id: 'features', label: 'Features' },
  { id: 'career-intelligence', label: 'Career Intelligence' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
  // Keep the URL shareable without triggering a route change.
  window.history.replaceState(null, '', `#${id}`);
}

export function MarketingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // If we arrive with a hash (e.g. /welcome#pricing), honour it once mounted.
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const t = window.setTimeout(() => scrollToId(hash), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, location.pathname]);

  const go = (id: string) => {
    setOpen(false);
    scrollToId(id);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-white/85 backdrop-blur-md transition-shadow ${
        scrolled ? 'shadow-[0_1px_0_0_rgba(15,23,42,0.08)]' : ''
      }`}
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/welcome" className="shrink-0" aria-label="AETHER home">
          <Logo className="h-7" />
        </Link>

        <ul className="hidden flex-1 items-center gap-1 lg:flex">
          {LINKS.map(l => (
            <li key={l.id}>
              <button
                onClick={() => go(l.id)}
                className="rounded-md px-3 py-2 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {isAuthenticated ? (
            <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to={LOGIN}>Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Link to={SIGNUP}>Start Preparing</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu — Radix Sheet: ESC closable, focus trapped, touch friendly */}
        <div className="ml-auto lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation menu" className="h-10 w-10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0">
              <SheetTitle className="sr-only">Site navigation</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="border-b px-5 py-4">
                  <Logo className="h-6" />
                </div>
                <ul className="flex-1 overflow-y-auto p-3">
                  {LINKS.map(l => (
                    <li key={l.id}>
                      <button
                        onClick={() => go(l.id)}
                        className="block w-full rounded-lg px-3 py-3 text-left text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-2 border-t p-4">
                  {isAuthenticated ? (
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                      <Link to="/dashboard">Go to Dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                        <SheetClose asChild>
                          <Link to={SIGNUP}>Start Preparing</Link>
                        </SheetClose>
                      </Button>
                      <Button asChild variant="outline">
                        <SheetClose asChild>
                          <Link to={LOGIN}>Sign In</Link>
                        </SheetClose>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}