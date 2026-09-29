import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { LectureResultCard } from '@/components/landing/RecordingFeature';

/**
 * The first screen: the headline and one sentence on the left, the product
 * on the right, two buttons, and the free tier in one line. Nothing else —
 * the facts, the steps and the features each have a section of their own
 * below, and every one of them is one scroll away rather than crowded into
 * the hero.
 *
 * The product on the right is the saved-lecture card from the recording
 * section, in a window frame: the thing a student actually gets, drawn from
 * the same fields as the lecture detail screen. It sits in a soft glow of
 * the brand blue so it reads as the page's one picture. The glow layers are
 * decoration-only (pointer-events-none, no overflow clipping of their own;
 * the section clips them, as landing-surface.test.js allows).
 */
export default function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-40 lg:pb-24 lg:pt-44">
      {/* The glow: a wide, low ellipse of brand blue under the hero, the
          way a lit surface sits behind a product photograph. Sized to the
          section, never clipped to a smaller box, so its edge stays soft. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[70%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(46,102,255,0.42),rgba(46,102,255,0.14)_38%,transparent_68%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_50%_0%,rgba(46,102,255,0.12),transparent_50%)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <div className="max-w-xl">
          <h1 className="text-balance text-[2.75rem] font-bold leading-[1.0] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[4.25rem]">
            You showed up to the lecture.{' '}
            <span className="text-primary">That should be the hard part.</span>
          </h1>
          {/* One sentence, under twenty-five words: the category and what
              happens. The rest of the page says the rest. */}
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Praelecta records the lecture and turns it into notes, flashcards and practice questions, then books the studying around your week.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/register" className="auth-cta inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold text-primary-foreground">
              Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 px-6 py-3.5 text-base font-semibold text-foreground/85 transition-colors hover:bg-card hover:text-foreground">
              <Play className="h-4 w-4 text-primary" aria-hidden="true" /> See how it works
            </a>
          </div>
          <p className="mt-5 text-sm font-semibold text-foreground/85">
            Two full lectures free. No card, nothing expires.
          </p>
        </div>

        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-primary/30 blur-3xl sm:-inset-10" />
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.10)]">
            <div className="flex items-center gap-2 border-b border-border bg-muted/70 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">PHYS 117 · Equilibrium &amp; free-body diagrams</span>
            </div>
            <LectureResultCard bare />
          </div>
        </div>
      </div>
    </section>
  );
}
