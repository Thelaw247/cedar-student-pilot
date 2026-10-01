import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { LectureResultCard } from '@/components/landing/RecordingFeature';

/**
 * The first screen: six words, one sentence, two buttons, and the product.
 *
 * The headline is the founder's own problem turned into the promise —
 * "Just listen. We'll take the notes." — because a student reads it in
 * under a second, it says who does the work, and it fits on two lines at
 * any width (the old ten-word line wrapped to four on a wide monitor and
 * read as a paragraph). The second sentence carries the brand blue: one
 * accent, on the promise.
 *
 * No glow and no band behind this section. The page is one surface from
 * the header to the footer; a lit patch under the hero read as a filter
 * laid over the first screen and broke that. The product on the right is
 * the saved-lecture card from the recording section in a window frame,
 * and the text column starts at the top edge of that window, not halfway
 * down it — the eye enters both at the same line.
 */
export default function LandingHero() {
  return (
    <section className="px-4 pb-12 pt-28 sm:px-6 lg:pb-16 lg:pt-36">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div className="max-w-xl lg:pt-1">
          <h1 className="text-balance text-5xl font-bold leading-[1.0] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[4.5rem]">
            Just listen.{' '}
            <span className="text-primary">We&rsquo;ll take the notes.</span>
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

        <div>
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
