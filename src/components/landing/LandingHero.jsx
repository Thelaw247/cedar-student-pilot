import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, CalendarClock, ChevronRight, Mic, Target } from 'lucide-react';

const coreFeatures = [
{
  number: '01',
  icon: Mic,
  label: 'Lecture recording',
  title: 'Record the lecture.',
  body: 'Keep the class you actually sat through — not just the notes you managed to type.',
  href: '#recording'
},
{
  number: '02',
  icon: Target,
  label: 'Exact test coverage',
  title: 'Set what the test covers.',
  body: 'Choose the exact lectures you are responsible for before Praelecta builds anything to study.',
  href: '#test-coverage'
},
{
  number: '03',
  icon: CalendarClock,
  label: 'Study scheduling',
  title: 'Put the studying on your calendar.',
  body: 'Spread the work across the days before the test and fit it around the schedule you already have.',
  href: '#study-schedule'
},
{
  number: '04',
  icon: Brain,
  label: 'Study system',
  title: 'Know what to do when study time starts.',
  body: 'Use guided sessions, flashcards, quizzes, reviews, practice tests, study guides, focus tools, and progress tracking from the same class material.',
  href: '#study-system'
}];


export default function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:pb-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_50%_5%,rgba(46,102,255,0.13),transparent_42%)]" />
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-blue-600">The thought that hits mid-lecture</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">Afraid you missed something important?</h1>
          <p className="mx-auto mt-5 max-w-3xl text-balance text-base leading-7 text-slate-600 sm:text-lg">Praelecta records the lecture, so you never have to wonder what you missed, and then turns it into exactly what you need to study.

          </p>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-bold tracking-[-0.02em] text-slate-950 sm:text-xl">
            Nothing gets past Praelecta.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {coreFeatures.map((feature) =>
          <a
            key={feature.number}
            href={feature.href}
            className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_24px_65px_-32px_rgba(46,102,255,0.28)] sm:p-7">
            
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <feature.icon className="h-6 w-6" />
                </div>
                <span className="text-4xl font-black tracking-[-0.06em] text-slate-100 transition-colors group-hover:text-blue-100">{feature.number}</span>
              </div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">{feature.label}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-slate-950">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.body}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors group-hover:text-blue-600">
                See it in Praelecta <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </a>
          )}
        </div>

        <div className="mx-auto mt-8 max-w-5xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs font-semibold sm:text-sm">
            <span className="rounded-lg bg-white px-3 py-2 text-slate-500 shadow-sm">Lecture</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">Record it</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">Choose what&rsquo;s tested</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">Book the study</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">Run the study session</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <span className="rounded-lg bg-white px-3 py-2 text-slate-950 shadow-sm">Exam</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E66FF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2459e8] sm:w-auto">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#recording" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto">
            See the four features
          </a>
        </div>
      </div>
    </section>);

}