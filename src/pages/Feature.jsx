import React from 'react';
import MarketingShell from '@/components/landing/MarketingShell';
import RecordingFeature from '@/components/landing/RecordingFeature';
import StudyToolProof from '@/components/landing/StudyToolProof';
import StudyScheduleProof from '@/components/landing/RealProductPreview';
import StudySystemFeature from '@/components/landing/StudySystemFeature';
import LandingFaq from '@/components/landing/LandingFaq';
import LandingFinalCta from '@/components/landing/LandingFinalCta';
import SectionCta from '@/components/landing/SectionCta';
import { featureBySlug } from '@/lib/features';
import { PUBLIC_PAGES } from '@/lib/publicPages';

/**
 * /lecture-recorder, /test-coverage, /study-schedule, /study-system — the
 * long form of each homepage section, on its own page (28 Sep 2026 audit,
 * change 9). The homepage renders the same section components in `compact`
 * form; here they render in full, under a short intro, with the FAQ entries
 * that belong to the feature and the same closing call to action. One
 * component, four routes (App.jsx), written out so the sitemap test can see
 * each one; the copy is lib/features.js.
 */
const SECTIONS = {
  'recording': RecordingFeature,
  'test-coverage': StudyToolProof,
  'study-schedule': StudyScheduleProof,
  'study-system': StudySystemFeature,
};

export default function Feature({ slug }) {
  const feature = featureBySlug(slug);
  const page = feature && PUBLIC_PAGES[feature.path];
  const Section = feature && SECTIONS[feature.section];
  if (!feature || !page || !Section) return null;

  return (
    <MarketingShell {...page}>
      <section className="px-4 pb-4 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-primary">{feature.eyebrow}</p>
          <h1 className="mx-auto mt-2 max-w-3xl text-balance text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-foreground sm:text-5xl">{feature.h1}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">{feature.intro}</p>
          <SectionCta className="mt-7" label={feature.cta} />
        </div>
      </section>
      <Section />
      <LandingFaq ids={feature.faq} />
      <LandingFinalCta />
    </MarketingShell>
  );
}
