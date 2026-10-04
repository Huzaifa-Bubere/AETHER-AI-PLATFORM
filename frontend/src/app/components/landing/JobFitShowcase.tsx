import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Search, MapPin, Briefcase, Code2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Reveal, SectionHeading, ExampleTag } from './Reveal';

/**
 * Job Fit + job search showcase (spec §40/§41).
 * Deliberately says "requirement match" — never hiring probability (§40).
 */
const MATCHED = ['Node.js', 'MongoDB', 'REST'];
const MISSING = ['AWS', 'Docker'];

export function JobFitShowcase() {
  return (
    <section className="border-t border-slate-100 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="Job fit"
          title="Know Where You Stand Before You Apply."
          lede="AETHER compares a job description against your stored evidence and shows exactly which requirements you already cover and which are missing."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          {/* requirement match card */}
          <Reveal>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Job Requirement Match
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">Backend Engineer</h3>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black tabular-nums text-slate-900">
                    76<span className="text-base text-slate-400">/100</span>
                  </p>
                  <span className="mt-1 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
                    GOOD REQUIREMENT MATCH
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-emerald-700">Matched</p>
                  <ul className="mt-2 space-y-1.5">
                    {MATCHED.map(m => (
                      <li key={m} className="flex items-center gap-2 text-[13px] text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />{m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700">Missing Evidence</p>
                  <ul className="mt-2 space-y-1.5">
                    {MISSING.map(m => (
                      <li key={m} className="flex items-center gap-2 text-[13px] text-slate-700">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" aria-hidden />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Button asChild className="mt-6 bg-indigo-600 hover:bg-indigo-700">
                <Link to="/job-fit">Analyze a Job Description</Link>
              </Button>
            </div>
          </Reveal>

          {/* job search panel */}
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">Job Search</h3>
                <ExampleTag>Illustrative UI</ExampleTag>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" aria-hidden />
                <span className="text-[13px] text-slate-400">Role, skill or company</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Role: Backend', 'Remote', 'Experience: 0–2 yrs', 'Source: All'].map(f => (
                  <span key={f} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                    {f}
                  </span>
                ))}
              </div>
              <ul className="mt-4 space-y-2">
                {['Backend Engineer — Remote', 'Software Engineer, Backend — Hybrid', 'Platform Engineer — Onsite'].map((t, i) => (
                  <li key={t} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <Briefcase className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{t}</span>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700">
                      {82 - i * 9}% match
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3" aria-hidden />
                Listings shown from your configured sources — no invented employers.
              </p>
            </div>
          </Reveal>
        </div>

        {/* coding showcase */}
        <Reveal delay={0.05}>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Code2 className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="text-[15px] font-bold text-slate-900">From submission to complexity feedback</h3>
            </div>
            <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {['Code submission', 'Test execution', 'AST analysis', 'Approach', 'Estimated complexity', 'Optimization feedback'].map((s, i) => (
                <li key={s} className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-3">
                  <span className="text-[10px] font-bold tabular-nums text-indigo-500">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{s}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-600">
              <span className="font-semibold text-emerald-700">Correct Solution</span>
              <span>Estimated: <span className="font-mono font-bold">O(n²)</span></span>
              <span>Expected: <span className="font-mono font-bold">O(n)</span></span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                Optimization Opportunity
              </span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}