import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CEDAR_LOGO_URL } from '@/lib/brand';
import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import ThreePillars from '@/components/landing/ThreePillars';
import AcademicReworkSection from '@/components/landing/AcademicReworkSection';
import LectureToSystemDemo from '@/components/landing/LectureToSystemDemo';
import {
  TestCoverageSection,
  HandbookSection,
  StudySystemSection,
  PlannerAndCompoundSection,
  ComparisonSection,
  HowItWorksSection,
  TrustPricingFinal,
} from '@/components/landing/LandingLowerSections';

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src={CEDAR_LOGO_URL} alt="" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-slate-950">Cedar Student Pilot</p>
            <p className="text-[10px] text-slate-400">The academic operating system for university.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
          <a href="#product" className="hover:text-slate-950">Product</a>
          <a href="#study-system" className="hover:text-slate-950">Study system</a>
          <a href="#pricing" className="hover:text-slate-950">Pricing</a>
          <Link to="/privacy" className="hover:text-slate-950">Privacy</Link>
          <Link to="/login" className="hover:text-slate-950">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Cedar Student Pilot — Make Every Class Compound';

    let description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || null;
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', 'Cedar Student Pilot keeps lectures, class knowledge, test coverage, study tools, and your schedule connected from the first lecture to the final exam.');

    return () => {
      document.title = previousTitle;
      if (previousDescription === null) description?.remove();
      else description?.setAttribute('content', previousDescription);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-950 selection:bg-blue-100 selection:text-blue-950">
      <LandingNav />
      <main>
        <LandingHero />
        <ThreePillars />
        <AcademicReworkSection />
        <LectureToSystemDemo />
        <TestCoverageSection />
        <HandbookSection />
        <StudySystemSection />
        <PlannerAndCompoundSection />
        <ComparisonSection />
        <HowItWorksSection />
        <TrustPricingFinal />
      </main>
      <LandingFooter />
    </div>
  );
}
