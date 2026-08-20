import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CEDAR_LOGO_URL } from '@/lib/brand';
import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import RecordingFeature from '@/components/landing/RecordingFeature';
import StudyToolProof from '@/components/landing/StudyToolProof';
import StudyScheduleProof from '@/components/landing/RealProductPreview';
import StudySystemFeature from '@/components/landing/StudySystemFeature';
import LandingEnd from '@/components/landing/LandingEnd';

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src={CEDAR_LOGO_URL} alt="" className="h-7 w-7 object-contain" />
          <p className="text-sm font-semibold text-slate-950">Cedar Student Pilot</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
          <a href="#recording" className="hover:text-slate-950">Recording</a>
          <a href="#test-coverage" className="hover:text-slate-950">Test coverage</a>
          <a href="#study-schedule" className="hover:text-slate-950">Study schedule</a>
          <a href="#study-system" className="hover:text-slate-950">Study tools</a>
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
    document.title = 'Cedar Student Pilot — Stop Rebuilding Your Class Before Every Exam';

    let description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || null;
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', 'Keep the lecture, choose the exact test coverage, schedule research-backed study sessions, and use connected study tools and project plans in Cedar Student Pilot.');

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
        <RecordingFeature />
        <StudyToolProof />
        <StudyScheduleProof />
        <StudySystemFeature />
        <LandingEnd />
      </main>
      <LandingFooter />
    </div>
  );
}