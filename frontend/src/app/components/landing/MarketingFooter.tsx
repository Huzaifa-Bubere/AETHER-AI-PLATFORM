import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { LOGIN, SIGNUP } from '../navigation';

/**
 * Marketing footer (spec §52). Every entry points at either a route that
 * genuinely exists or a same-page anchor — no dead links (§52).
 */

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      }}
      className="rounded text-left text-[13px] text-slate-600 transition-colors hover:text-indigo-700"
    >
      {children}
    </button>
  );
}

const COLUMNS: Array<{
  title: string;
  links: Array<{ label: string; to?: string; anchor?: string }>;
}> = [
  {
    title: 'Product',
    links: [
      { label: 'Aptitude', to: '/aptitude' },
      { label: 'Coding', to: '/coding' },
      { label: 'Interview', to: '/interview' },
      { label: 'Resume', to: '/resume-builder' },
      { label: 'Career Learning', to: '/career-learning' },
    ],
  },
  {
    title: 'Career',
    links: [
      { label: 'Role Intelligence', to: '/career-intelligence' },
      { label: 'Job Fit', to: '/job-fit' },
      { label: 'Jobs', to: '/jobs' },
      { label: 'Analytics', to: '/analytics' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Overview', anchor: 'product' },
      { label: 'Features', anchor: 'features' },
      { label: 'Pricing', anchor: 'pricing' },
      { label: 'FAQ', anchor: 'faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign In', to: LOGIN },
      { label: 'Create Account', to: SIGNUP },
      { label: 'Pricing', to: '/subscription' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 xl:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Logo className="h-7" />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-500">
              Adaptive, explainable, role-aware preparation for technical roles. AETHER does not
              guarantee employment.
            </p>
          </div>

          {COLUMNS.map(col => (
            <div key={col.title}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className="rounded text-[13px] text-slate-600 transition-colors hover:text-indigo-700">
                        {l.label}
                      </Link>
                    ) : (
                      <Anchor id={l.anchor!}>{l.label}</Anchor>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
          <p className="text-[12px] text-slate-400">
            © {new Date().getFullYear()} AETHER. Built for evidence-based preparation.
          </p>
          <p className="text-[12px] text-slate-400">
            Results shown on this page are illustrative examples, not platform averages.
          </p>
        </div>
      </div>
    </footer>
  );
}