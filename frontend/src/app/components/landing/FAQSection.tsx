import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Button } from '../ui/button';
import { Reveal, SectionHeading } from './Reveal';
import { LOGIN, SIGNUP } from '../navigation';

/** FAQ (spec §50) — Radix Accordion, keyboard accessible by default. */
const FAQS = [
  {
    q: 'What is AETHER?',
    a: 'AETHER is a placement-preparation platform that combines aptitude and technical assessments, coding practice with AST-based analysis, voice-first mock interviews, resume analysis, role-based learning, career intelligence and job matching in one account.',
  },
  {
    q: 'How does AETHER measure readiness?',
    a: 'Readiness is a weighted calculation across the requirements stored for your target role, using evidence you have actually produced — completed assessments, coding submissions, interview sessions, resume versions and learning progress. Each figure can be traced back to the records behind it.',
  },
  {
    q: 'Can I prepare for multiple job roles?',
    a: 'Yes. Each role keeps its own requirements, progress, interview history, resume alignment, learning roadmap and job matches, so you can compare or switch targets without losing your history.',
  },
  {
    q: 'How does coding analysis work?',
    a: 'Your submission is executed against test cases and its structure is parsed to produce metrics such as loop depth and detected approach. Complexity is estimated and compared against the expected complexity, and correctness is kept separate from efficiency.',
  },
  {
    q: 'What is Job Requirement Match?',
    a: 'It compares a job description against your stored skill evidence and reports which requirements you already cover and which are missing. It is a requirement-coverage score — it is not a hiring probability and carries no guarantee.',
  },
  {
    q: 'Does AETHER generate interview questions from my resume?',
    a: 'Interviews are role-based and adaptive: follow-up questions respond to what you have already answered. Resume content is used to evaluate resume quality and job-description alignment rather than to claim any guarantee of question selection.',
  },
  {
    q: 'Where does career and job data come from?',
    a: 'Job listings and role requirement data come from the sources configured for your account. Where a figure on this page is illustrative rather than live, it is labelled as an example.',
  },
  {
    q: 'Can I use AETHER for free?',
    a: 'Yes. A free tier is available; paid plans add deeper coverage. Pricing shown above is read from the live billing configuration.',
  },
  {
    q: 'Does AETHER guarantee a job?',
    a: 'No. AETHER does not guarantee employment, offers or interviews. It measures preparation and surfaces role-relevant evidence; hiring decisions rest entirely with employers.',
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-slate-100 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Questions worth answering honestly" />

        <Reveal delay={0.05}>
          <Accordion type="single" collapsible className="mt-10 w-full">
            {FAQS.map(f => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-[15px] font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[14px] leading-relaxed text-slate-600">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCTA({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="border-t border-slate-100 bg-gradient-to-b from-white to-indigo-50/60 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Your Career Preparation,
            <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Finally Connected.
            </span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Build evidence. Close skill gaps. Practice deliberately. Apply with confidence.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Button asChild size="lg" className="h-12 bg-indigo-600 px-7 hover:bg-indigo-700">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-12 bg-indigo-600 px-7 hover:bg-indigo-700">
                <Link to={SIGNUP}>Start Preparing Free</Link>
              </Button>
            )}
            {!isAuthenticated && (
              <Button asChild size="lg" variant="outline" className="h-12 px-7">
                <Link to={LOGIN}>Sign In</Link>
              </Button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}