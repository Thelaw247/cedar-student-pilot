import React from 'react';
import { RecorderCard } from '@/components/landing/RecordingFeature';
import { CoverageMock } from '@/components/landing/StudyToolProof';
import { ScheduleMock } from '@/components/landing/RealProductPreview';
import SectionCta from '@/components/landing/SectionCta';

/**
 * How it works: the three things a student does, each with the screen it
 * happens on. The screens are the same components the product uses
 * (RecorderCard, CoverageMock, ScheduleMock), on sample data, so the page
 * shows the product rather than describing it. Every step is a number, a
 * title under seven words and one line under twenty — the long version of
 * each is its feature page, linked from the grid below this section. The
 * text of every step starts at the top edge of its screen (items-start),
 * so the eye enters the number, the title and the picture on one line
 * instead of finding the words floating halfway down a tall card.
 */
const STEPS = [
  {
    number: '1',
    title: 'Record the lecture.',
    body: 'Press record when class starts. It runs for up to six hours and saves to your account.',
    visual: <RecorderCard />,
    narrow: true,
  },
  {
    number: '2',
    title: 'Tick what the test covers.',
    body: 'Every flashcard, practice question and review stays inside the lectures you ticked. Nothing off-syllabus.',
    visual: <CoverageMock compact />,
  },
  {
    number: '3',
    title: 'The studying books itself.',
    body: 'Give it the exam date. Sessions land around your classes and shifts. Included in the Scholar plan.',
    visual: <ScheduleMock compact />,
  },
];

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">How it works</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">Three steps, shown on the app itself.</p>
        </div>

        <ol className="mt-12 space-y-14 lg:space-y-20">
          {STEPS.map((step, index) => (
            <li key={step.number} className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
              <div className={`lg:pt-1 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Step {step.number} of {STEPS.length}</p>
                <h3 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{step.title}</h3>
                <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{step.body}</p>
              </div>
              <div className={`${index % 2 === 1 ? 'lg:order-1' : ''} ${step.narrow ? 'mx-auto w-full max-w-sm lg:mx-0 lg:max-w-md' : ''}`}>
                {step.visual}
              </div>
            </li>
          ))}
        </ol>

        <SectionCta className="mt-14" label="Record your first lecture free" />
      </div>
    </section>
  );
}
