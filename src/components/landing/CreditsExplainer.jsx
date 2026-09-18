import React from 'react';
import { Coins } from 'lucide-react';
import { CREDIT_COSTS, CREDIT_PACKS, CREDITS_PER_LECTURE, TIERS } from '@/lib/tiers';

/**
 * The credit model in plain words, on the pricing surface itself.
 *
 * Praelecta is the only app in its category that meters by credits, and the
 * explanation used to live only on the terms page. A student deciding whether
 * the Student plan is enough should not have to read a legal document to
 * learn that a one-hour lecture is ten credits. Every figure is read from
 * lib/tiers.js.
 */
export default function CreditsExplainer({ className = '' }) {
  const perHalfHour = CREDIT_COSTS.perThirtyMinutes.process_lecture;
  const perHour = perHalfHour * 2;
  const flat = CREDIT_COSTS.flat;
  const smallest = CREDIT_PACKS[0];
  const lecturesFrom = (credits) => Math.floor(credits / CREDITS_PER_LECTURE);

  return (
    <div className={`rounded-[26px] border border-border bg-card p-7 sm:p-8 ${className}`}>
      <Coins className="h-6 w-6 text-primary" />
      <h3 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-foreground">How credits work</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Every plan gives you credits each month, and every action shows its cost before you spend it, so you always know where you stand.
      </p>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        <li><span className="font-semibold text-foreground">A one-hour lecture is {perHour} credits</span> ({perHalfHour} per 30 minutes of audio), and that includes the transcript, summary, concepts and flashcards.</li>
        <li><span className="font-semibold text-foreground">Practice questions cost {flat.study_material}</span>, an AI lecture review {flat.lecture_review}, exam topic prediction {flat.exam_prediction}, a class handbook {flat.handbook}.</li>
        <li><span className="font-semibold text-foreground">Student&rsquo;s {TIERS.student.creditsPerMonth} a month is about {lecturesFrom(TIERS.student.creditsPerMonth)} lectures</span>; Scholar&rsquo;s {TIERS.scholar.creditsPerMonth} about {lecturesFrom(TIERS.scholar.creditsPerMonth)}. Monthly credits reset each month.</li>
        <li><span className="font-semibold text-foreground">Need more mid-semester?</span> A credit pack from ${smallest.price.toFixed(2)} for {smallest.credits} credits tops you up without changing your plan, and packs never expire.</li>
        <li><span className="font-semibold text-foreground">Nothing that fails costs you a credit.</span></li>
      </ul>
    </div>
  );
}
