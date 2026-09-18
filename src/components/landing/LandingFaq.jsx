import React from 'react';
import { HelpCircle } from 'lucide-react';
import { FAQ } from '@/lib/faq';

/**
 * The questions a student asks before signing up, answered on the page
 * instead of left for the register screen to lose them on.
 *
 * Native <details> so every answer is in the DOM for crawlers and works with
 * no JavaScript; the same list is mirrored as FAQPage JSON-LD in index.html
 * (lib/faq.js is the one source, and a test keeps the two copies equal).
 */
export default function LandingFaq() {
  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">Before you sign up</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Questions students ask first</h2>
        </div>
        <div className="mt-10 divide-y divide-border overflow-hidden rounded-[26px] border border-border bg-card">
          {FAQ.map((item) => (
            <details key={item.id} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-start gap-3 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <HelpCircle className="mt-0.5 h-5 w-5 flex-none text-primary transition-transform group-open:rotate-12" aria-hidden="true" />
                <span className="flex-1">{item.question}</span>
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 pl-8 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
