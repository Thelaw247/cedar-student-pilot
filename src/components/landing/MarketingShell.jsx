import React, { useEffect } from 'react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

/**
 * The public site's frame: dark floor, the owner's waveform behind
 * everything, the fixed nav, and the footer. The landing page and the
 * pricing, about and changelog pages all render inside it, so they read as
 * one site rather than a homepage and three app screens.
 *
 * `title` and `description` are written to the document while the page is
 * mounted and restored when it unmounts, so the app's own pages keep theirs.
 */
export default function MarketingShell({ title, description, children }) {
  // The dark floor goes on the canvas for as long as a public page is mounted.
  //
  // On a phone, iOS reveals a rubber-band region above the top and below the
  // bottom of the document that no element inside the page can cover — only
  // the canvas background fills it. The app's own background is the light
  // theme, so scrolling to the end of this dark page ended in a band of white
  // that looks like the page ran out. See the note beside .landing-active.
  useEffect(() => {
    document.documentElement.classList.add('landing-active');
    return () => document.documentElement.classList.remove('landing-active');
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') || null;
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle;
      if (!description) return;
      if (previousDescription === null) meta?.remove();
      else meta?.setAttribute('content', previousDescription);
    };
  }, [title, description]);

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
        <main>{children}</main>
        <LandingFooter />
      </div>
    </>
  );
}
