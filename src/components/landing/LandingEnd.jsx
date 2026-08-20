import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, Brain, FileText, Headphones, RotateCcw, ShieldCheck } from 'lucide-react';

const supportRows = [
  {
    icon: FileText,
    from: 'Because Cedar has the lecture',
    title: 'you also get the transcript, summary, concepts, formulas, notes, exam mentions, and class handbook.',
  },
  {
    icon: Brain,
    from: 'Because Cedar knows the test coverage',
    title: 'flashcards, practice questions, lecture reviews, and study material can use that same portion of the course.',
  },
  {
    icon: Headphones,
    from: 'Because Cedar booked the study',
    title: 'you can open the session, use the focus timer, rebook it when life changes, and track what you actually completed.',
  },
];

export default function LandingEnd() {
  return (
    <>
      <section className="px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-blue-600">The rest comes with the workflow</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Three core jobs. Everything else connects underneath them.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Cedar does not ask you to maintain a separate system for every feature. The useful extras come from the lecture, the test scope, and the study sessions you already set up.</p>
          </div>

          <div className="mx-auto mt-10 max-w-4xl divide-y divide-slate-200 overflow-hidden rounded-[26px] border border-slate-200 bg-white">
            {supportRows.map((row) => (
              <div key={row.from} className="grid gap-4 p-5 sm:grid-cols-[48px_1fr] sm:items-start sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><row.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">{row.from}</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-slate-900">{row.title}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-lg bg-slate-50 px-3 py-2"><BookOpen className="mr-1.5 inline h-3.5 w-3.5 text-blue-600" />Class handbook</span>
            <span className="rounded-lg bg-slate-50 px-3 py-2"><RotateCcw className="mr-1.5 inline h-3.5 w-3.5 text-blue-600" />Rebook sessions</span>
            <span className="rounded-lg bg-slate-50 px-3 py-2"><BarChart3 className="mr-1.5 inline h-3.5 w-3.5 text-blue-600" />Progress &amp; analytics</span>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-slate-200 bg-slate-50 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_.9fr] lg:items-stretch">
          <div className="rounded-[26px] border border-slate-200 bg-white p-7 sm:p-8">
            <p className="text-sm font-semibold text-blue-600">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950">Start free. Pay for more processing when you need it.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Cedar has Free, Student, Scholar, and Unlimited plans. The paid tiers increase how much lecture processing and study generation you can use.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Free', 'Student', 'Scholar', 'Unlimited'].map((plan) => (
                <span key={plan} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{plan}</span>
              ))}
            </div>
            <Link to="/register" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">Start free <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="rounded-[26px] bg-slate-950 p-7 text-white sm:p-8">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em]">Your recording starts with permission.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Cedar asks you to confirm that you have permission before recording a class. You decide what gets recorded, which lectures a test covers, and which study sessions you use.</p>
            <Link to="/privacy" className="mt-6 inline-flex text-sm font-semibold text-blue-300 hover:text-white">Read the privacy policy</Link>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 pb-24 sm:px-6 lg:pb-28">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-[#2E66FF] px-6 py-14 text-center text-white sm:px-10 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100">Lecture → test → study</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Keep the class. Know what matters. Make time to study it.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">That is the job Cedar is built to do from the first lecture to the final exam.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}