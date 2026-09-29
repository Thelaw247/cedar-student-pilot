import React from 'react';
import MarketingShell from '@/components/landing/MarketingShell';
import LandingHero from '@/components/landing/LandingHero';
import LandingRecognition from '@/components/landing/LandingRecognition';
import { LandingFacts } from '@/components/landing/LandingProof';
import LandingHowItWorks from '@/components/landing/LandingHowItWorks';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingDownloads from '@/components/landing/LandingDownloads';
import LandingTestimonials from '@/components/landing/LandingTestimonials';
import LandingFaq from '@/components/landing/LandingFaq';
import LandingFinalCta from '@/components/landing/LandingFinalCta';
import { LANDING_TITLE, LANDING_DESCRIPTION } from '@/lib/publicPages';

/**
 * The homepage. The title names the category first — "lecture recording",
 * "study tool" — because that is what a student types into a search box;
 * the tagline stays in the hero, where it belongs. The description is what
 * the search snippet shows, so it says what happens, not how it feels. Both
 * strings live in lib/publicPages.js with every other public page's.
 *
 * Seven sections, each one thing: the hero (headline, one sentence, the
 * product, two buttons), the four facts, how it works (three steps with
 * the real screens), the feature grid (one tile per feature page), where it
 * runs, the testimonials slot, the FAQ, and the final button. Everything
 * longer than a line lives on the feature pages, the pricing page and the
 * comparison pages, one click from here.
 */
export { LANDING_TITLE, LANDING_DESCRIPTION };

export default function Landing() {
  return (
    <MarketingShell title={LANDING_TITLE} description={LANDING_DESCRIPTION}>
      <LandingHero />
      {/* Third-party badges, under the hero; nothing until earned. */}
      <LandingRecognition />
      <LandingFacts />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingDownloads />
      {/* Nothing until there is something true to show. */}
      <LandingTestimonials />
      <LandingFaq />
      <LandingFinalCta />
    </MarketingShell>
  );
}
