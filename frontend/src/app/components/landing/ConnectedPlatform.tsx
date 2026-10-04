import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Brain, Code2, Mic, GraduationCap, Fingerprint, Target, Briefcase, Sparkles } from 'lucide-react';
import { Reveal, SectionHeading } from './Reveal';

/**
 * Connected-platform section (spec §35/§36) — the product's key differentiator:
 * evidence sources converge into one AETHER Skill Profile, which then drives
 * readiness, job match and recommendations.
 */

const INPUTS = [
  { label: 'Resume', icon: FileText },
  { label: 'Technical', icon: Brain },
  { label: 'Coding', icon: Code2 },
  { label: 'Interview', icon: Mic },
  { label: 'Learning', icon: GraduationCap },
];

const OUTPUTS = [
  { label: 'Role Readiness', icon: Target },
  { label: 'Job Match', icon: Briefcase },
  { label: 'Recommendations', icon: Sparkles },
];

const EVIDENCE = [
  'Coding Submission', 'Interview', 'Technical Quiz', 'Resume', 'Course Quiz', 'Project',
];

export function ConnectedPlatform() {
  const reduce = useReducedMotion();

  return (
    <section id="career-intelligence" className="scroll-mt-20 border-t border-slate-100 bg-[#F8FAFC] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="Connected system"
          title="Your Progress Is Connected."
          lede="Five separate activities would normally fragment into five disconnected scores. In AETHER they resolve into a single skill profile that every recommendation can be traced back to."
        />

        <div className="mx-auto mt-14 max-w-3xl">
          {/* inputs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {INPUTS.map(({ label, icon: Icon }, i) => (
              <Reveal key={label} delay={i * 0.05}>
                <div className="flex h-full flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center">
                  <Icon className="h-[18px] w-[18px] text-indigo-500" aria-hidden />
                  <span className="text-[12px] font-semibold text-slate-700">{label}</span>
                </div>
              </Reveal>
            ))}
          </div>

          {/* converging beams */}
          <div aria-hidden="true" className="relative h-16">
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {[10, 30, 50, 70, 90].map((x, i) => (
                <motion.path
                  key={x}
                  d={`M ${x} 0 C ${x} 45, 50 55, 50 100`}
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="0.6"
                  strokeDasharray="3 3"
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  whileInView={reduce ? undefined : { pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.9, delay: i * 0.08 }}
                />
              ))}
            </svg>
          </div>

          {/* core */}
          <Reveal>
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 p-6 text-center shadow-[0_18px_50px_-34px_rgba(79,70,229,0.6)]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
                <Fingerprint className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-xl font-black tracking-tight text-slate-900">AETHER Skill Profile</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
                AI explains evidence, it does not invent it. Deterministic assessment data is combined
                with AI explanations, so any recommendation can be traced to a real record.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EVIDENCE.map(e => (
                  <span key={e} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* diverging outputs */}
          <div aria-hidden="true" className="relative h-14">
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {[22, 50, 78].map((x, i) => (
                <motion.path
                  key={x}
                  d={`M 50 0 C 50 45, ${x} 55, ${x} 100`}
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="0.6"
                  strokeDasharray="3 3"
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  whileInView={reduce ? undefined : { pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.08 }}
                />
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {OUTPUTS.map(({ label, icon: Icon }, i) => (
              <Reveal key={label} delay={i * 0.06}>
                <div className="flex h-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <Icon className="h-[18px] w-[18px] text-indigo-500" aria-hidden />
                  <span className="text-[13px] font-semibold text-slate-800">{label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}