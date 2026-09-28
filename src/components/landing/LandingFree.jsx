import React from 'react';
import { CheckCircle2, Gift } from 'lucide-react';
import { TIERS } from '@/lib/tiers';
import SectionCta from '@/components/landing/SectionCta';

/**
 * What free actually includes (28 Sep 2026 audit, change 6).
 *
 * The loudest complaint in both competitors' app-store reviews is the same
 * one: the paywall arrives after one upload, and nobody said so. Praelecta's
 * free tier is two whole lectures with the whole pipeline, and this block
 * says so above the fold instead of in the pricing section's third sentence.
 * Every line is read from TIERS.free in tiers.js, so the box can never
 * promise something the plan does not include.
 */
export default function LandingFree() {
  return (
    <section id="free" className="px-4 pb-6 pt-2 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[26px] border border-primary/25 bg-primary/[0.07] p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">What free actually includes</p>
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.035em] text-foreground sm:text-3xl">Free is two full lectures, not a demo.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                No card. Nothing expires. And when you do reach a limit, you see it before you spend, never halfway through a lecture.
              </p>
              <SectionCta className="mt-5 sm:justify-start" label="Start free" note={null} />
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {TIERS.free.includes.map((line) => (
                <li key={line} className="flex items-start gap-2.5 rounded-xl border border-border bg-card/70 px-3.5 py-3 text-sm text-foreground/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
