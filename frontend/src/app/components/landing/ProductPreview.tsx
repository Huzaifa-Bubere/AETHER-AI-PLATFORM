import { ExampleTag, Reveal } from './Reveal';

/**
 * "MEET AETHER" — a product frame derived from the real AETHER interface
 * (sidebar, role readiness, skill coverage, streak, coding score, interview
 * trend, resume status) rather than a stock marketing illustration (§29).
 * Every value is illustrative and labelled as such (§30).
 */

const SKILLS = [
  { name: 'Arrays & Hashing', pct: 82, tone: 'bg-emerald-500' },
  { name: 'Trees & Graphs', pct: 64, tone: 'bg-blue-500' },
  { name: 'Dynamic Programming', pct: 41, tone: 'bg-amber-500' },
  { name: 'System Design', pct: 33, tone: 'bg-violet-500' },
];

const ACTIVITY = [1, 2, 0, 3, 2, 4, 3, 1, 0, 2, 4, 4, 2, 1, 3, 0, 2, 3, 4, 1, 0, 3, 2, 4, 3, 1, 2, 4, 0, 2];

export function ProductPreview() {
  return (
    <section id="product" className="relative scroll-mt-20 border-t border-slate-100 bg-[#F8FAFC] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500">Meet AETHER</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            The workspace you prepare inside
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Every panel below is a real AETHER surface — readiness is computed from stored
            evidence, not generated.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
            {/* browser chrome */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              </span>
              <span className="ml-2 flex-1 truncate rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-400">
                aether.app/dashboard
              </span>
              <ExampleTag className="hidden sm:inline-flex" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[168px_1fr]">
              {/* sidebar */}
              <aside className="hidden border-r border-slate-200 bg-slate-50/70 p-4 md:block">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspace</p>
                <ul className="space-y-1 text-[12.5px] font-medium text-slate-600">
                  {['Dashboard', 'Aptitude', 'Coding', 'Interview', 'Resume', 'Career Learning', 'Career Intel.', 'Jobs', 'Analytics'].map((item, i) => (
                    <li
                      key={item}
                      className={`rounded-md px-2.5 py-1.5 ${i === 0 ? 'bg-indigo-50 text-indigo-700' : ''}`}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </aside>

              {/* main panels */}
              <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-3">
                {/* readiness */}
                <div className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Role Readiness · Backend Engineer
                    </p>
                    <span className="text-2xl font-black tabular-nums text-slate-900">74%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" />
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {SKILLS.map(s => (
                      <div key={s.name}>
                        <div className="mb-1 flex items-center justify-between text-[11.5px]">
                          <span className="font-medium text-slate-700">{s.name}</span>
                          <span className="tabular-nums text-slate-500">{s.pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${s.tone} rounded-full`} style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* streak */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Activity</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">12 days</p>
                  <p className="text-[11px] text-slate-500">Current streak</p>
                  <div className="mt-3 grid grid-cols-6 gap-1" aria-hidden="true">
                    {ACTIVITY.map((v, i) => (
                      <span
                        key={i}
                        className={`aspect-square rounded-[3px] ${
                          v === 0 ? 'bg-slate-100' : v === 1 ? 'bg-indigo-100' : v === 2 ? 'bg-indigo-300' : v === 3 ? 'bg-indigo-500' : 'bg-indigo-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[10.5px] text-slate-400">Example Activity</p>
                </div>

                {/* coding score */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Coding Score</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">85<span className="text-sm text-slate-400">/100</span></p>
                  <p className="mt-1 text-[11px] text-emerald-600">Estimated O(n) · expected O(n)</p>
                </div>

                {/* interview trend */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Interview Trend</p>
                  <svg viewBox="0 0 120 40" className="mt-2 h-10 w-full" aria-hidden="true">
                    <polyline points="0,32 20,26 40,28 60,18 80,20 100,10 120,6" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p className="mt-1 text-[11px] text-slate-500">Communication evidence</p>
                </div>

                {/* resume status */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Resume ATS</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">82<span className="text-sm text-slate-400">/100</span></p>
                  <p className="mt-1 text-[11px] text-slate-500">2 versions tracked</p>
                </div>
              </div>
            </div>
          </div>
          <ExampleTag className="mt-3 sm:hidden">Example Candidate View</ExampleTag>
        </Reveal>
      </div>
    </section>
  );
}