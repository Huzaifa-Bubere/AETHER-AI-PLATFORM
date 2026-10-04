import { Reveal, SectionHeading, ExampleTag } from './Reveal';

/** Career learning roadmap (spec §39) — role → requirement → course → … → mastery. */
const STAGES = [
  { label: 'Role', detail: 'Backend Developer' },
  { label: 'Skill Requirement', detail: 'Kafka' },
  { label: 'Course', detail: 'Streaming Systems' },
  { label: 'Lesson', detail: 'Partitions & offsets' },
  { label: 'Practice', detail: 'Guided problem' },
  { label: 'Quiz', detail: '8 questions' },
  { label: 'Project', detail: 'Event pipeline' },
  { label: 'Evidence', detail: 'Recorded in profile' },
  { label: 'Mastery', detail: 'Requirement covered' },
];

export function CareerLearningShowcase() {
  return (
    <section className="border-t border-slate-100 bg-[#F8FAFC] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="Career learning"
          title="A Roadmap That Ends in Evidence."
          lede="Learning is not a content library here. Each step is attached to a role requirement, and completing it changes what your readiness calculation reports."
        />

        <Reveal delay={0.05}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                Roadmap example · Kafka requirement
              </h3>
              <ExampleTag>Illustrative roadmap</ExampleTag>
            </div>

            <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {STAGES.map((s, i) => (
                <li key={s.label} className="relative">
                  <div className="h-full rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40">
                    <span className="text-[10px] font-bold tabular-nums text-indigo-500">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-0.5 text-[12.5px] font-bold text-slate-900">{s.label}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{s.detail}</p>
                  </div>
                  {i < STAGES.length - 1 && (
                    <span aria-hidden="true" className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-slate-300 lg:block">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}