import { Reveal, SectionHeading, ExampleTag } from './Reveal';

/**
 * Multi-role showcase (spec §37/§38). Percentages are illustrative and explicitly
 * labelled — AETHER computes them from stored evidence, these are static examples.
 */

const ROLES = [
  { name: 'Backend Developer', pct: 74, tone: 'from-blue-600 to-indigo-600' },
  { name: 'Data Analyst', pct: 68, tone: 'from-indigo-600 to-violet-600' },
  { name: 'AI / ML Engineer', pct: 52, tone: 'from-violet-600 to-fuchsia-600' },
];

const LEVELS = [
  { name: 'Languages', level: 'Job Ready', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: 'Frameworks', level: 'Working Knowledge', tone: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'Databases', level: 'Job Ready', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: 'Cloud', level: 'Foundation', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  { name: 'DevOps', level: 'Foundation', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  { name: 'Testing', level: 'Working Knowledge', tone: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'System Design', level: 'Advanced', tone: 'bg-violet-100 text-violet-700 border-violet-200' },
];

const LEVEL_ORDER = ['Foundation', 'Working Knowledge', 'Job Ready', 'Advanced'];

export function MultiRoleShowcase() {
  return (
    <section className="border-t border-slate-100 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="Multi-role"
          title="Prepare for More Than One Career Path."
          lede="Each role keeps its own requirements, progress, interview history, resume alignment, learning roadmap and job matches — so switching target does not mean starting over."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.15fr]">
          {/* role readiness cards */}
          <div className="space-y-3">
            <ExampleTag>Illustrative readiness</ExampleTag>
            {ROLES.map((r, i) => (
              <Reveal key={r.name} delay={i * 0.06}>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_14px_34px_-24px_rgba(79,70,229,0.6)]">
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-slate-900">{r.name}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full bg-gradient-to-r ${r.tone} rounded-full`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xl font-black tabular-nums text-slate-900">{r.pct}%</span>
                </div>
              </Reveal>
            ))}
          </div>

          {/* role requirement matrix */}
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                  Backend Developer · Requirements
                </h3>
                <ExampleTag>Example</ExampleTag>
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LEVELS.map(l => (
                  <li key={l.name} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <span className="text-[13px] font-medium text-slate-700">{l.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${l.tone}`}>
                      {l.level}
                    </span>
                  </li>
                ))}
              </ul>
              <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                {LEVEL_ORDER.map((l, i) => (
                  <li key={l} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true">→</span>}
                    {l}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}