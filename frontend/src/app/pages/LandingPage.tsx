import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

import { MarketingNav } from '../components/landing/MarketingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { ProductPreview } from '../components/landing/ProductPreview';
import { FeatureBento } from '../components/landing/FeatureBento';
import { ConnectedPlatform } from '../components/landing/ConnectedPlatform';
import { MultiRoleShowcase } from '../components/landing/MultiRoleShowcase';
import { CareerLearningShowcase } from '../components/landing/CareerLearningShowcase';
import { JobFitShowcase } from '../components/landing/JobFitShowcase';
import { WorkflowSection, TrustSection } from '../components/landing/WorkflowSection';
import { PricingSection } from '../components/landing/PricingSection';
import { FAQSection, FinalCTA } from '../components/landing/FAQSection';
import { MarketingFooter } from '../components/landing/MarketingFooter';

/**
 * AETHER public welcome page (marketing experience only).
 *
 * This file is intentionally a COMPOSITION LAYER — every section lives in
 * `components/landing/` so the page stays maintainable.
 *
 * Routing is owned by App.tsx and is NOT changed here:
 *   `/`  → authenticated candidate: Dashboard, otherwise → /welcome
 *   `/welcome` → this page (public, viewable either way)
 *
 * Content rules enforced here (spec §16/§17/§42/§64):
 *  - no user counts, ratings, placement rates or testimonials
 *  - no fabricated employers, salaries or success statistics
 *  - no emotion / personality / honesty / eye-contact inference claims
 *  - every illustrative number is labelled as an example
 */

const TITLE = 'AETHER — AI Placement Preparation & Career Intelligence';
const DESCRIPTION =
  'AETHER combines assessments, coding, AI mock interviews, resume analysis, role-based learning, career intelligence and job matching in one explainable placement platform.';

export function LandingPage() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  // Public-page metadata. The app is a SPA without react-helmet, so this sets
  // the document title/description directly and restores nothing on unmount —
  // the title is owned by this page only.
  useEffect(() => {
    document.title = TITLE;
    const tag = document.querySelector('meta[name="description"]');
    if (tag) tag.setAttribute('content', DESCRIPTION);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav isAuthenticated={isAuthenticated} />
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <ProductPreview />
        <FeatureBento />
        <ConnectedPlatform />
        <MultiRoleShowcase />
        <CareerLearningShowcase />
        <JobFitShowcase />
        <WorkflowSection />
        <TrustSection />
        <PricingSection isAuthenticated={isAuthenticated} />
        <FAQSection />
        <FinalCTA isAuthenticated={isAuthenticated} />
      </main>
      <MarketingFooter />
    </div>
  );
}