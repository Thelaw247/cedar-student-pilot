import React from 'react';
import MarketingShell from '@/components/landing/MarketingShell';
import LandingHero from '@/components/landing/LandingHero';
import LandingWhyStudents from '@/components/landing/LandingWhyStudents';
import LandingFree from '@/components/landing/LandingFree';
import RecordingFeature from '@/components/landing/RecordingFeature';
import StudyToolProof from '@/components/landing/StudyToolProof';
import StudyScheduleProof from '@/components/landing/RealProductPreview';
import StudySystemFeature from '@/components/landing/StudySystemFeature';
import LandingCompare from '@/components/landing/LandingCompare';
import LandingRecognition from '@/components/landing/LandingRecognition';
import LandingTestimonials from '@/components/landing/LandingTestimonials';
import LandingDownloads from '@/components/landing/LandingDownloads';
import LandingEnd from '@/components/landing/LandingEnd';
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
 * Order, since the 28 Sep 2026 audit against studley.ai and turbo.ai: the
 * hero with its checkable facts, the promises ("Four things we will never
 * do to you") and what free includes before the product tour, because the
 * competitors' reviews say the paywall-before-value is what students decide
 * on; then the four sections in their short form (the long forms are the
 * feature pages), the at-a-glance comparison, and the rest.
 */
export { LANDING_TITLE, LANDING_DESCRIPTION };

export default function Landing() {
  return (
    <MarketingShell title={LANDING_TITLE} description={LANDING_DESCRIPTION}>
      <LandingHero />
      {/* Third-party badges, under the hero's buttons; nothing until earned. */}
      <LandingRecognition />
      <LandingWhyStudents />
      <LandingFree />
      <RecordingFeature compact />
      <StudyToolProof compact />
      <StudyScheduleProof compact />
      <StudySystemFeature compact />
      <LandingCompare />
      {/* Nothing until there is something true to show. */}
      <LandingTestimonials />
      <LandingDownloads />
      <LandingEnd />
      <LandingFaq />
      <LandingFinalCta />
    </MarketingShell>
  );
}
