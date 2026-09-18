import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, Brain, FileText, Headphones, RotateCcw, ShieldCheck } from 'lucide-react';
import { TIERS } from '@/lib/tiers';
import PricingTiers from '@/components/landing/PricingTiers';
import CreditsExplainer from '@/components/landing/CreditsExplainer';
import PaymentTrustLine from '@/components/landing/PaymentTrustLine';
import LandingProof from '@/components/landing/LandingProof';

const supportRows = [
  {
    icon: FileText,
    from: 'Because we have the lecture',
    title: 'you get the transcript, summary, concepts, formulas, notes, exam mentions and the class handbook. All of it comes with the recording.',
  },
  {
    icon: Brain,
    from: 'Because we know what the test covers',
    title: 'the flashcards, practice questions and reviews stay inside exactly that part of the course. No wasted evenings.',
  },
  {
    icon: Headphones,
    from: 'Because we booked the study',
    title: 'you open the session, run the timer, move it if life gets in the way, and see what you actually got done.',
  },
];

export default function LandingEnd() {
  return (
    <>
      <section className="px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-primary">It all comes from the same three things</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Do three things. Get the whole study kit.</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">There is no second system to keep up with. Because we have the lecture, know what the test covers, and booked the sessions, everything else falls out of that on its own.</p>
          </div>

          <div className="mx-auto mt-10 max-w-4xl divide-y divide-border overflow-hidden rounded-[26px] border border-border bg-card">
            {supportRows.map((row) => (
              <div key={row.from} className="grid gap-4 p-5 sm:grid-cols-[48px_1fr] sm:items-start sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><row.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{row.from}</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-foreground">{row.title}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="rounded-lg bg-muted px-3 py-2"><BookOpen className="mr-1.5 inline h-3.5 w-3.5 text-primary" />Class handbook</span>
            <span className="rounded-lg bg-muted px-3 py-2"><RotateCcw className="mr-1.5 inline h-3.5 w-3.5 text-primary" />Rebook sessions</span>
            <span className="rounded-lg bg-muted px-3 py-2"><BarChart3 className="mr-1.5 inline h-3.5 w-3.5 text-primary" />Progress &amp; analytics</span>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            {/* Real numbers from the database, above the prices: the first
                thing a student wonders here is whether anyone else uses this. */}
            <LandingProof />
            <p className="mt-5 text-sm font-semibold text-primary">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Free to try. Less than a textbook to keep.</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Two full lectures on us, transcript, summary and flashcards included, so you can see it work on your own class before paying anything.
              When you want more, plans start at <span className="font-semibold text-foreground">${TIERS.student.monthly.toFixed(2)} a month</span>, or{' '}
              <span className="font-semibold text-foreground">${TIERS.student.semester.toFixed(2)} for the whole semester</span>: one bill that matches your term, because that is how school actually works. No other study app does that.
            </p>
          </div>

          <div className="mt-10">
            <PricingTiers compact />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <CreditsExplainer />
            <div className="rounded-[26px] border border-border bg-secondary p-7 text-secondary-foreground sm:p-8">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h3 className="mt-5 text-2xl font-bold tracking-[-0.03em]">Your recordings are yours. Full stop.</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Before any recording, you confirm you are allowed to make it. You decide what gets recorded, which lectures a test covers, and when you study. Your recordings stay private to your account, we never share them, and you can delete them whenever you want.</p>
              <Link to="/privacy" className="mt-6 inline-flex text-sm font-semibold text-primary hover:text-foreground">Read the privacy policy</Link>
            </div>
          </div>

          <PaymentTrustLine className="mt-8" />
        </div>
      </section>
    </>
  );
}