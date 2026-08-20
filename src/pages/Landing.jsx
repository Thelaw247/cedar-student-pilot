import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CEDAR_LOGO_URL } from '@/lib/brand';
import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import SimpleWorkflow from '@/components/landing/SimpleWorkflow';
import StudyToolProof from '@/components/landing/StudyToolProof';
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
          <a href="#how-it-works" className="hover:text-slate-950">How it works</a>
          <a href="#see-the-app" className="hover:text-slate-950">See the app</a>
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
    document.title = 'Cedar Student Pilot — Classes, Lectures & Study in One Place';

    let description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || null;
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', 'Keep your classes, permitted lecture recordings, lecture notes, exam coverage, study tools, handbook, and study schedule together in Cedar Student Pilot.');

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
        <SimpleWorkflow />
        <StudyToolProof />
        <LandingEnd />
      </main>
      <LandingFooter />
    </div>
  );
}
