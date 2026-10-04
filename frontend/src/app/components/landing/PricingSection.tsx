import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Reveal, SectionHeading } from './Reveal';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useSubscriptionInit } from '../subscription/SubscriptionUI';

/**
 * Pricing preview (spec §49).
 *
 * Single source of truth: plans are read from the SAME subscription store the
 * real /subscription page uses. Nothing is hardcoded here, so prices can never
 * drift from billing.
 */
export function PricingSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  useSubscriptionInit();
  const sub = useSubscriptionStore();
  const plans = sub.planConfig?.plans ?? [];

  useEffect(() => { void sub.fetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="pricing" className="scroll-mt-20 border-t border-slate-100 bg-[#F8FAFC] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when you want deeper coverage."
          lede="Plan details below are read from the live billing configuration, so they always match what you will actually be charged."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.length === 0
            ? [0, 1, 2].map(i => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-label="Loading plan" />
                </Reveal>
              ))
            : plans.map((plan: any, i: number) => {
                const id = String(plan.id ?? plan.planId ?? '');
                const featured = id === 'pro';
                const features: string[] = plan.features ?? plan.included ?? [];
                return (
                  <Reveal key={id || i} delay={i * 0.05}>
                    <div
                      className={`flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5 ${
                        featured
                          ? 'border-indigo-300 bg-white shadow-[0_24px_60px_-34px_rgba(79,70,229,0.7)]'
                          : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      {featured && (
                        <span className="mb-3 inline-flex w-fit rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Most Popular
                        </span>
                      )}
                      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                        {plan.name ?? id}
                      </h3>
                      <p className="mt-3 text-3xl font-black tabular-nums text-slate-900">
                        {plan.price === 0 || plan.amount === 0 ? (
                          'Free'
                        ) : (
                          <>
                            <span className="align-top text-lg">₹</span>
                            {plan.price ?? plan.amount}
                            <span className="align-top text-base text-slate-400">/mo</span>
                          </>
                        )}
                      </p>
                      {features.length > 0 && (
                        <ul className="mt-5 flex-1 space-y-2">
                          {features.slice(0, 6).map((f: string) => (
                            <li key={f} className="flex items-start gap-2 text-[13px] leading-snug text-slate-600">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        asChild
                        className={`mt-6 ${featured ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                        variant={featured ? 'default' : 'outline'}
                      >
                        <Link to={isAuthenticated ? '/subscription' : '/signup'}>
                          {isAuthenticated ? 'Manage plan' : 'Start Preparing Free'}
                        </Link>
                      </Button>
                    </div>
                  </Reveal>
                );
              })}
        </div>
      </div>
    </section>
  );
}