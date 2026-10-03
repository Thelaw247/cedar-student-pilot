import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Pause, Play } from 'lucide-react';
import Stars from '@/components/ui/Stars';
import { usePublicReviews } from '@/hooks/usePublicReviews';
import { ratingSummary } from '@/lib/reviews';

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
 * the app in use, in a window frame, and the text column starts at the
 * top edge of that window, not halfway down it — the eye enters both at
 * the same line.
 */

/**
 * The demo loop: forty-six seconds of a real account, recorded from the
 * live app and cut in the order the page tells the story — a recorded
 * lecture that is already notes, formulas and an exam radar; two lectures
 * ticked on the study page and the tools following; the day and the week
 * the studying was booked into. Muted, looping, 16:9, under 2.5 MB, with
 * one control: a pause button, because anything that moves for more than
 * five seconds needs a way to stop it (WCAG 2.2.2). It starts on the notes, so the poster (its first frame) is what
 * the headline promises. The filename is versioned because _headers caches
 * it for a year: a new cut is a new name.
 *
 * v2 (Oct 2026) is v1 with the account's email address in the sidebar
 * blurred, frame for frame; v1 was removed from public/ so the address is
 * no longer served at all.
 */
export const HERO_DEMO_VIDEO = '/hero-demo-v2.mp4';
export const HERO_DEMO_POSTER = '/hero-demo-v2.jpg';
const HERO_DEMO_ALT = 'Praelecta in use: a recorded lecture already turned into notes, formulas and an exam radar; two lectures ticked for studying; the week with the sessions booked in.';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(REDUCED_MOTION).matches);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia(REDUCED_MOTION);
    const onChange = (e) => setReduced(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * A visitor who asked their system for less motion, or their browser to
 * save data, gets the first frame as a picture, not a 2.4 MB loop; everyone
 * else gets the loop. Both carry the same description for a screen reader.
 *
 * The loop is fetched once and played from a blob: URL, not from its own
 * address. praelecta.ca's static assets answer a byte-range request with
 * the whole file and a 200 (checked 2 Oct 2026: `Range: bytes=0-1` returns
 * all 2.4 MB, no Content-Range). Chrome, Edge and Firefox play from that;
 * Safari on the iPhone and the Mac asks for two bytes first, gets the whole
 * file instead of a 206, and stops — the visitor would see the poster and
 * nothing would move. A blob: URL is served by the browser to itself,
 * ranges included, so the same file plays everywhere, and the CSP already
 * allows media from blob:. Until the file is in, the poster (the same
 * first frame) shows; if the fetch fails, the poster stays.
 */
export function HeroDemo() {
  const reduced = usePrefersReducedMotion();
  const saveData = typeof navigator !== 'undefined' && !!navigator.connection?.saveData;
  const still = reduced || saveData;
  const [src, setSrc] = React.useState(null);
  const videoRef = React.useRef(null);
  const [paused, setPaused] = React.useState(false);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  React.useEffect(() => {
    if (still) return undefined;
    const controller = new AbortController();
    let objectUrl = null;
    fetch(HERO_DEMO_VIDEO, { signal: controller.signal, priority: 'low' })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`hero demo: ${res.status}`))))
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {}); // the poster stays: the same first frame, standing still
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [still]);

  if (still) {
    return <img src={HERO_DEMO_POSTER} alt={HERO_DEMO_ALT} width="1386" height="780" className="block aspect-video w-full bg-card object-cover" />;
  }
  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src || undefined}
        poster={HERO_DEMO_POSTER}
        width="1386"
        height="780"
        className="block aspect-video w-full bg-card object-cover"
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        aria-label={HERO_DEMO_ALT}
      />
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={paused ? 'Play the demo' : 'Pause the demo'}
        className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * What students rated it, next to the button they press — the one number
 * here that comes from other people. The average of every rating left in
 * the app (GET /public/reviews), and nothing at all until there are enough
 * of them to mean something (ratingSummary: five or more). Never typed in.
 */
function HeroRating() {
  const summary = ratingSummary(usePublicReviews());
  if (!summary) return null;
  return (
    <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Stars rating={summary.average} />
      <span><span className="font-semibold text-foreground">{summary.average.toFixed(1)}</span> out of 5 from {summary.count} students</span>
    </p>
  );
}

export default function LandingHero() {
  return (
    <section className="px-4 pb-12 pt-28 sm:px-6 lg:pb-16 lg:pt-36">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div className="max-w-xl lg:pt-1">
          {/* 40 / 52 / 60px: two lines from a phone to a wide screen (measured
              at 390, 768, 1024, 1280, 1440 and 1920). At 72px it broke into
              three lines on a laptop and five on a phone. */}
          <h1 className="text-balance text-[2.5rem] font-bold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-[3.25rem] xl:text-[3.75rem]">
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
              Record your first lecture free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 px-6 py-3.5 text-base font-semibold text-foreground/85 transition-colors hover:bg-card hover:text-foreground">
              <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" /> See how it works
            </a>
          </div>
          {/* "Up to 90 minutes": the free credits cover two lectures that long
              (server/lib/credits.js), and notes and flashcards are what the
              free plan includes; the practice questions and scheduling in the
              sentence above come with paid plans. */}
          <p className="mt-5 text-sm font-semibold text-foreground/85">
            Two full lectures free, up to 90 minutes each, with notes and flashcards. No card, nothing expires.
          </p>
          <HeroRating />
        </div>

        <div>
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.10)]">
            <div className="flex items-center gap-2 border-b border-border bg-muted/70 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">praelecta.ca</span>
            </div>
            <HeroDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
