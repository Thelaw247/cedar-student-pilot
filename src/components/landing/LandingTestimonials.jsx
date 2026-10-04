import React from 'react';
import { Quote } from 'lucide-react';
import Stars from '@/components/ui/Stars';
import { usePublicReviews } from '@/hooks/usePublicReviews';
import { ratingSummary } from '@/lib/reviews';

/**
 * What students say — named quotes with real stars.
 *
 * Two sources, both with the student's own say-so:
 *  - reviews left in the app (ReviewPrompt / Settings → Your review) where
 *    the student ticked "show on praelecta.ca" and the founder checked the
 *    wording, read from GET /public/reviews;
 *  - TESTIMONIALS below, for a quote given another way (an email, a
 *    message), added by hand with the student's permission, in this shape:
 *
 *   { name: 'Sarah', course: 'PHYS 117', school: 'University of Saskatchewan',
 *     photo: '/testimonials/sarah.jpg',
 *     quote: 'I caught up on 8 lectures in a weekend and pulled a B+ on the midterm.' }
 *
 * The section renders NOTHING while both are empty, so nobody sees a hole
 * and nothing here is invented. The average above the quotes counts every
 * rating, shown or not (the API's), and appears only once there are enough
 * ratings for it to mean something (shared/reviews.js).
 */
export const TESTIMONIALS = [];

/** "Sarah, PHYS 117, University of Saskatchewan" — the audit's own format. */
export const testimonialCaption = (t) => [t.name, t.course, t.school].filter(Boolean).join(', ');

/** A review from the API, in this section's shape. */
export const fromReview = (r) => ({ name: r.name, course: r.detail, school: r.school, quote: r.quote, rating: r.rating });

/**
 * A quote as this section draws it: TESTIMONIALS, or a review through fromReview.
 * @typedef {{ name: string, course?: string, school?: string, photo?: string, quote: string, rating?: number }} Testimonial
 */

/**
 * The homepage passes nothing, and the section reads GET /public/reviews;
 * `testimonials` and `stats`, when given, stand in for that answer.
 *
 * @param {{ testimonials?: Testimonial[], stats?: { count?: number, average?: number, reviews?: object[] } | null }} [props]
 */
export default function LandingTestimonials({ testimonials: given, stats: givenStats } = {}) {
  const fetched = usePublicReviews();
  const stats = givenStats !== undefined ? givenStats : fetched;
  const testimonials = given || [...TESTIMONIALS, ...(stats?.reviews || []).map(fromReview)];
  if (!testimonials.length) return null;
  const summary = ratingSummary(stats);
  return (
    <section id="students" className="px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">What students say</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">In their words, about their courses</h2>
          {summary && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Stars rating={summary.average} />
              <span><span className="font-semibold text-foreground">{summary.average.toFixed(1)}</span> out of 5 from {summary.count} students</span>
            </p>
          )}
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={`${testimonialCaption(t)}|${t.quote}`} className="flex flex-col rounded-[26px] border border-border bg-card p-6 shadow-[0_18px_55px_-35px_rgba(0,0,0,0.6)]">
              {t.rating ? <Stars rating={t.rating} /> : <Quote className="h-5 w-5 text-primary" aria-hidden="true" />}
              <blockquote className="mt-4 flex-1 text-base leading-7 text-foreground">{t.quote}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {t.photo
                  ? <img src={t.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                  : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{t.name.slice(0, 1)}</span>}
                <span>
                  <span className="block text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{[t.course, t.school].filter(Boolean).join(', ')}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
