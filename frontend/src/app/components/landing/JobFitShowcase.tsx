import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertCircle, Search, MapPin, Briefcase } from 'lucide-react';
import { Button } from '../ui/button';
import { Reveal, SectionHeading, ExampleTag } from './Reveal';

/**
 * Placement Intelligence showcase (spec §10A–§10C).
 *
 * Two connected cards: Job Search → Job Fit. All content is illustrative and
 * labelled as such — AETHER never shows invented employers, salaries or
 * placement statistics on the marketing page.
 *
 * The Job Fit card deliberately says "requirement match" — never a hiring
 * probability (§40).
 */
const MATCHED = ['Node.js', 'MongoDB'];
const NOT_EVIDENCED = ['Docker', 'AWS'];

const FLOW = ['JOB', 'JOB FIT', 'SKILL GAP', 'CAREER LEARNING', 'RESUME', 'AI INTERVIEW', 'APPLICATION'];

export function JobFitShowcase() {
  return (
    <section className="border-t border-slate-100 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="Placement Intelligence"
          title="From a job posting to an interview you are ready for."
          lede="AETHER connects job search, requirement matching, skill gaps, learning, your resume and AI interviews into one explainable flow."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Job Search card ── */}
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">Job Search</h3>
                <ExampleTag>Illustrative Product Preview</ExampleTag>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-slate-800">
                Discover opportunities aligned with your career path.
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" aria-hidden />
                <span className="text-[13px] text-slate-400">Role, skill or company</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['Role: Backend', 'Any work mode', 'Experience: 0–2 yrs', 'Source: All'].map(f => (
                  <span key={f} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600">{f}</span>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">Backend Developer</p>
                    <p className="text-[12.5px] text-slate-500">Remote · Mumbai</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700">
                    <MapPin className="h-3 w-3" aria-hidden /> Role matched
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Node.js', 'MongoDB', 'Docker'].map(s => (
                    <span key={s} className="rounded bg-primary/5 px-2 py-0.5 text-[11.5px] font-medium text-indigo-700">{s}</span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/jobs">
                      <Briefcase className="mr-1.5 h-3.5 w-3.5" aria-hidden /> View Job
                    </Link>
                  </Button>
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" asChild>
                    <Link to="/job-fit">Analyze Fit</Link>
                  </Button>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3" aria-hidden />
                Illustrative preview. Live listings come only from your configured sources — no invented employers.
              </p>
            </div>
          </Reveal>

          {/* ── Job Fit card ── */}
          <Reveal delay={0.08}>
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">Job Fit</h3>
                <ExampleTag>Illustrative Product Preview</ExampleTag>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-slate-800">
                Know where you stand before you apply.
              </p>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">AETHER Job Requirement Match</p>
                </div>
                <p className="text-3xl font-black tabular-nums text-slate-900">
                  76<span className="text-base text-slate-400">/100</span>
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-emerald-700">Matched evidence</p>
                  <ul className="mt-2 space-y-1.5">
                    {MATCHED.map(m => (
                      <li key={m} className="flex items-center gap-2 text-[13px] text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />{m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700">Not yet evidenced</p>
                  <ul className="mt-2 space-y-1.5">
                    {NOT_EVIDENCED.map(m => (
                      <li key={m} className="flex items-center gap-2 text-[13px] text-slate-700">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" aria-hidden />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/resume-analyzer">Improve Resume</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/career-learning">Learn Skills</Link>
                </Button>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" asChild>
                  <Link to="/interview">Prepare for This Job</Link>
                </Button>
              </div>

              <p className="mt-3 text-[11px] text-slate-400">
                “Not evidenced” means nothing on your profile or resume shows it yet — not that you lack the skill.
              </p>
            </div>
          </Reveal>
        </div>

        {/* ── Connected flow (spec §10C) ── */}
        <Reveal delay={0.05}>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">How AETHER connects it</p>
            <ol className="mt-4 flex flex-wrap items-center gap-2">
              {FLOW.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-bold tracking-wide text-slate-700">
                    {step}
                  </span>
                  {i < FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-indigo-400" aria-hidden />}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12.5px] text-slate-500">
              One job posting drives your requirement match, your skill gaps, the lessons that close them, the resume
              version you send, the interview you practise and the application you track — with the same evidence
              behind every number.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
