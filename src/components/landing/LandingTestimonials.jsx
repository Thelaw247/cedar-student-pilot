import React from 'react';
import { Quote } from 'lucide-react';

/**
 * What students say — a wall of named quotes with real outcomes.
 *
 * Empty on purpose until the first students have said something on the
 * record: the section renders NOTHING while the list is empty, so nobody
 * sees a hole and nothing here is invented. Fill it from real permission —
 * a first name, university and course, a photo, and the outcome in their
 * own words. Example shape (the audit's own suggestion):
 *
 *   { name: 'Sarah', detail: '2nd year, PHYS 117, UofT',
 *     photo: '/testimonials/sarah.jpg',
 *     quote: 'I caught up on 8 lectures in a weekend and pulled a B+ on the midterm.' }
 *
 * `photo` is optional; without it the card shows the initial.
 */
export const TESTIMONIALS = [];

export default function LandingTestimonials({ testimonials = TESTIMONIALS }) {
  if (!testimonials.length) return null;
  return (
    <section id="students" className="px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">From students using it this term</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">What it did for their courses</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={`${t.name}-${t.detail}`} className="flex flex-col rounded-[26px] border border-border bg-card p-6 shadow-[0_18px_55px_-35px_rgba(0,0,0,0.6)]">
              <Quote className="h-5 w-5 text-primary" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 text-base leading-7 text-foreground">{t.quote}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {t.photo
                  ? <img src={t.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                  : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{t.name.slice(0, 1)}</span>}
                <span>
                  <span className="block text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.detail}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
