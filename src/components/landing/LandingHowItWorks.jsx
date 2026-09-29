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
 * each is its feature page, linked from the grid below this section.
 */
const STEPS = [
  {
    number: '1',
    title: 'Record the lecture.',
    body: 'Press record when class starts. Up to six hours, in the browser or the desktop app. Then just listen.',
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
    body: 'Give it the exam date. Sessions land in real gaps around your classes, shifts and deadlines, and you show up.',
    visual: <ScheduleMock compact />,
  },
];

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">How it works</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">Three things you do. Everything else comes from them.</p>
        </div>

        <ol className="mt-14 space-y-16 lg:space-y-24">
          {STEPS.map((step, index) => (
            <li key={step.number} className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">{step.number}</span>
                <h3 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{step.title}</h3>
                <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{step.body}</p>
              </div>
              <div className={`${index % 2 === 1 ? 'lg:order-1' : ''} ${step.narrow ? 'mx-auto w-full max-w-sm lg:max-w-md' : ''}`}>
                {step.visual}
              </div>
            </li>
          ))}
        </ol>

        <SectionCta className="mt-16" label="Start free" />
      </div>
    </section>
  );
}
