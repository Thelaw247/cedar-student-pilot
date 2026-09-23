import React from 'react';
import { Award } from 'lucide-react';

/**
 * Third-party recognition — a Product Hunt launch, a review-site rating, an
 * App Store rating once the iPhone app is out, a press mention — shown as a
 * quiet strip directly under the hero's buttons once any of it exists (the
 * slot the 22 Sep 2026 audit asked for, D3.5).
 *
 * Empty until earned: the strip renders NOTHING while the list is empty, so
 * the page never shows a row of blank badge slots or a "Reviewed on" line
 * with nothing behind it. Each entry is a fact with a link a visitor can
 * check, never a claim:
 *
 *   { label: 'Product Hunt', text: '#3 Product of the Day', href: 'https://www.producthunt.com/...' }
 *   { label: 'App Store', text: '4.8 from 31 ratings', href: 'https://apps.apple.com/...' }
 *   { label: 'The Sheaf', text: '"The study app built by a first-year"', href: 'https://...' }
 */
export const RECOGNITION = [];

export default function LandingRecognition({ items = RECOGNITION }) {
  if (!items.length) return null;
  return (
    <section id="recognition" className="px-4 pb-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {items.map((item) => (
            <li key={item.href}>
              <a href={item.href} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Award className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="font-semibold text-foreground">{item.label}</span>
                <span>{item.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
