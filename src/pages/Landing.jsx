import React from 'react';
import MarketingShell from '@/components/landing/MarketingShell';
import LandingHero from '@/components/landing/LandingHero';
import RecordingFeature from '@/components/landing/RecordingFeature';
import StudyToolProof from '@/components/landing/StudyToolProof';
import StudyScheduleProof from '@/components/landing/RealProductPreview';
import StudySystemFeature from '@/components/landing/StudySystemFeature';
import LandingWhyStudents from '@/components/landing/LandingWhyStudents';
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
 */
export { LANDING_TITLE, LANDING_DESCRIPTION };

export default function Landing() {
  return (
    <MarketingShell title={LANDING_TITLE} description={LANDING_DESCRIPTION}>
      <LandingHero />
      {/* Third-party badges, under the hero's buttons; nothing until earned. */}
      <LandingRecognition />
      <RecordingFeature />
      <StudyToolProof />
      <StudyScheduleProof />
      <StudySystemFeature />
      <LandingWhyStudents />
      {/* Nothing until there is something true to show. */}
      <LandingTestimonials />
      <LandingDownloads />
      <LandingEnd />
      <LandingFaq />
      <LandingFinalCta />
    </MarketingShell>
  );
}
