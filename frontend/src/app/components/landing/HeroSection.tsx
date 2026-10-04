import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { SIGNUP } from '../navigation';

// 3D is code-split so the headline, copy and CTAs render immediately (§22/§56).
const AetherHeroScene = lazy(() => import('./AetherHeroScene'));

const TRUST_POINTS = [
  'No credit card required',
  'Role-aware preparation',
  'Explainable feedback',
  'Evidence-based progress',
];

export function HeroSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const goToProduct = () => {
    const el = document.getElementById('product');
    el?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <section className="relative overflow-hidden bg-white">
      {/* ambient background: subtle grid + radial glow (§28) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -right-24 top-10 h-[380px] w-[380px] rounded-full bg-violet-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[420px] rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-24 lg:pt-20 xl:px-8">
        {/* ── Left: messaging ── */}
        <div className="max-w-[680px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-600" />
            </span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-indigo-700">
              Adaptive · Explainable · Role-Aware
            </span>
          </div>

          <h1 className="mt-6 text-[clamp(2.5rem,6.2vw,4.5rem)] font-black leading-[1.04] tracking-tight text-slate-900">
            From Preparation to Placement,
            <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              One Intelligent Career Platform.
            </span>
          </h1>

          <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-slate-600">
            Assess your skills, practice coding and interviews, improve your resume, close
            role-specific skill gaps, and discover jobs aligned with your actual evidence — all
            inside AETHER.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isAuthenticated ? (
              <Button asChild size="lg" className="h-12 bg-indigo-600 px-7 text-[15px] hover:bg-indigo-700">
                <Link to="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-12 bg-indigo-600 px-7 text-[15px] hover:bg-indigo-700">
                <Link to={SIGNUP}>
                  Start Preparing Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button size="lg" variant="outline" className="h-12 px-6 text-[15px]" onClick={goToProduct}>
              Explore AETHER
            </Button>
          </div>

          {/* Trust line — factual only, no invented statistics (§15) */}
          <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            {TRUST_POINTS.map(p => (
              <li key={p} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: 3D identity visual ── */}
        <div className="relative h-[320px] sm:h-[400px] lg:h-[520px]">
          <Suspense
            fallback={
              // Reserve the same box so mounting the canvas causes no layout shift (§68).
              <div className="h-full w-full" aria-hidden="true" />
            }
          >
            <AetherHeroScene className="h-full w-full" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}