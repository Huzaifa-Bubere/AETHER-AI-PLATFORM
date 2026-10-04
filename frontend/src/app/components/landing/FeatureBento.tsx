import {
  Code2, Mic, FileText, GraduationCap, BrainCircuit, Target, Briefcase, BarChart3, CheckCircle2,
} from 'lucide-react';
import { Reveal, SectionHeading } from './Reveal';
import type { ReactNode } from 'react';

/**
 * Bento feature system (spec §32–§34). Asymmetric grid, subtle hover lift only —
 * cards never continuously move.
 */
function BentoCard({
  className = '',
  icon: Icon,
  title,
  children,
  bullets = [],
}: {
  className?: string;
  icon: typeof Code2;
  title: string;
  children?: ReactNode;
  bullets?: string[];
}) {
  return (
    <Reveal className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_18px_44px_-26px_rgba(79,70,229,0.55)] ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>
      </div>
      {children && <div className="mt-4">{children}</div>}
      {bullets.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2 text-[13.5px] leading-snug text-slate-600">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}
    </Reveal>
  );
}

export function FeatureBento() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-slate-100 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="One platform"
          title="One Platform. Every Stage of Placement Preparation."
          lede="Assessment, coding, interview, resume, learning, career intelligence and job matching share the same evidence store — so nothing is re-entered twice."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BentoCard
            className="lg:col-span-2"
            icon={Mic}
            title="AI Mock Interview"
            bullets={[
              'Voice-first adaptive interview',
              'Role-specific follow-up questions',
              'Technical + communication evidence',
            ]}
          >
            <div className="flex flex-wrap gap-2">
              {['Answer relevance', 'Technical depth', 'Communication structure', 'Response duration', 'Speaking pace'].map(t => (
                <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">{t}</span>
              ))}
            </div>
          </BentoCard>

          <BentoCard
            className="lg:col-span-2"
            icon={Code2}
            title="Coding Intelligence"
            bullets={['Monaco editor with test cases', 'AST-based analysis', 'Estimated vs expected complexity']}
          >
            {/* small terminal-ish preview */}
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
              <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                <span className="text-[10px] font-mono text-slate-400">solution.cpp</span>
              </div>
              <pre className="overflow-x-auto p-3 text-[11px] font-mono leading-relaxed text-slate-300">
{`for (int i = 0; i < n; i++) {
  seen[nums[i]] = i;`}
              </pre>
            </div>
          </BentoCard>

          <BentoCard
            icon={FileText}
            title="ATS Resume"
            bullets={['Resume quality score', 'Job-description match', 'Skill evidence attached']}
          />

          <BentoCard
            icon={GraduationCap}
            title="Career Learning"
            bullets={['Role-based roadmap', 'Lessons, quizzes and projects', 'Tracks requirement coverage']}
          />

          <BentoCard
            icon={BrainCircuit}
            title="Aptitude + Technical"
            bullets={['Timed aptitude battery', 'Topic-wise technical accuracy', 'Difficulty progression']}
          />

          <BentoCard
            icon={Target}
            title="Career Intelligence"
            bullets={['Skill-demand and role coverage', 'Weighted readiness per role', 'Explicit top gaps']}
          >
            <div className="flex items-end gap-1" aria-hidden="true">
              {[45, 62, 38, 74, 56, 88, 69].map((h, i) => (
                <span key={i} className="w-full rounded-t bg-gradient-to-t from-indigo-200 to-indigo-500" style={{ height: `${h * 0.42}px` }} />
              ))}
            </div>
          </BentoCard>

          <BentoCard
            icon={Briefcase}
            title="Job Match"
            bullets={['JD requirement match', 'Skill-match filtering', 'Saved and tracked roles']}
          />

          <BentoCard
            icon={BarChart3}
            title="Analytics + Streak"
            bullets={['Real assessment history', 'Per-metric source and sample size', 'Daily activity streak']}
          />
        </div>
      </div>
    </section>
  );
}