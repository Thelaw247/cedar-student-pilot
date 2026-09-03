import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_MARK_URL } from '@/lib/brand';
import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import RecordingFeature from '@/components/landing/RecordingFeature';
import StudyToolProof from '@/components/landing/StudyToolProof';
import StudyScheduleProof from '@/components/landing/RealProductPreview';
import StudySystemFeature from '@/components/landing/StudySystemFeature';
import LandingWhyStudents from '@/components/landing/LandingWhyStudents';
import LandingDownloads from '@/components/landing/LandingDownloads';
import LandingEnd from '@/components/landing/LandingEnd';

function LandingFooter() {
  return (
    <footer className="px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src={BRAND_MARK_URL} alt="" className="h-7 w-7 object-contain" />
          <div>
            <p className="text-sm font-semibold text-foreground">Praelecta</p>
            <p className="text-xs text-muted-foreground">Made in Canada · Your recordings stay private to you</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
          <a href="#recording" className="hover:text-foreground">Recording</a>
          <a href="#test-coverage" className="hover:text-foreground">Test coverage</a>
          <a href="#study-schedule" className="hover:text-foreground">Study schedule</a>
          <a href="#study-system" className="hover:text-foreground">Study tools</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#download" className="hover:text-foreground">Desktop app</a>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/login" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Praelecta — You show up, we'll do the rest";

    let description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || null;
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', 'Record the lecture, tick what is on the test, and let the study sessions book themselves. Praelecta turns class into a transcript, flashcards, practice questions and a study plan. Two lectures free.');

    return () => {
      document.title = previousTitle;
      if (previousDescription === null) description?.remove();
      else description?.setAttribute('content', previousDescription);
    };
  }, []);

  // No bg-background on the wrapper below, deliberately. This element is
  // positioned, so an opaque background on it paints in the positioned-element
  // pass - above the z-index:-1 backdrop rather than below it - and hid the
  // waveform completely. The base colour is painted by .landing-backdrop.
  return (
    <>
      {/* The owner's waveform, held still behind everything while the page
          scrolls over it. It is a SIBLING of the surface below, deliberately:
          the surface is overflow-x:hidden, and iOS Safari clips a fixed child
          to that scroll container instead of the viewport. Inside it, the
          waveform vanished on phones and the navy floor stopped mid-page. */}
      <div className="landing-backdrop" aria-hidden="true" />
      <div className="landing-surface relative min-h-screen overflow-x-hidden text-foreground selection:bg-primary/25 selection:text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <RecordingFeature />
        <StudyToolProof />
        <StudyScheduleProof />
        <StudySystemFeature />
        <LandingWhyStudents />
        <LandingDownloads />
        <LandingEnd />
      </main>
      <LandingFooter />
      </div>
    </>
  );
}