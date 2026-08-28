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
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Cedar has Free, Student, Scholar, and Unlimited plans. The paid tiers increase how much lecture processing and study generation you can use — and every plan can be paid <span className="font-semibold text-slate-900">by the semester</span>, one bill that matches your term. No other study app does that.</p>
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

      <section className="relative isolate overflow-hidden bg-slate-50 px-4 pb-24 sm:px-6 lg:pb-28">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 -z-10 overflow-hidden">
          <div className="absolute left-[2%] top-[10%] h-72 w-72 rounded-full bg-[#2E66FF]/48 blur-[82px]" />
          <div className="absolute left-[31%] top-[38%] h-56 w-56 rounded-full bg-blue-500/38 blur-[78px]" />
          <div className="absolute right-[4%] top-[4%] h-72 w-72 rounded-full bg-sky-400/42 blur-[88px]" />
          <div className="absolute bottom-[-18%] left-[47%] h-80 w-80 rounded-full bg-indigo-500/38 blur-[105px]" />
          <div className="absolute right-[23%] bottom-[3%] h-48 w-48 rounded-full bg-[#2E66FF]/30 blur-[70px]" />
        </div>

        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(239,246,255,0.43)_44%,rgba(219,234,254,0.38))] px-6 py-14 text-center shadow-[0_34px_95px_-38px_rgba(30,64,175,0.52),inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-1px_0_rgba(255,255,255,0.24)] backdrop-blur-[34px] backdrop-saturate-[195%] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_2%,rgba(255,255,255,0.78),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(96,165,250,0.20),transparent_34%),radial-gradient(circle_at_58%_100%,rgba(46,102,255,0.18),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="pointer-events-none absolute left-[8%] top-[-22%] h-44 w-[42%] rotate-[-8deg] rounded-[50%] bg-white/24 blur-3xl" />
          <div className="pointer-events-none absolute right-[2%] bottom-[-16%] h-44 w-[34%] rotate-[14deg] rounded-[50%] bg-blue-300/16 blur-3xl" />

          <div className="relative z-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-700/90">Lecture → test → study</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-[-0.04em] text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] sm:text-4xl">Keep the class. Know what matters. Make time to study it.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-700 sm:text-base">That is the job Cedar is built to do from the first lecture to the final exam.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/45 bg-[#2E66FF]/90 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_-18px_rgba(46,102,255,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-[#2E66FF]">Start free <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/login" className="inline-flex items-center justify-center rounded-2xl border border-white/65 bg-white/34 px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_10px_28px_-20px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.88)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/52">Sign in</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}