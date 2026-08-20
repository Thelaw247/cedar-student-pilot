import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarClock, FileText, ShieldCheck, Target } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Lecture records',
    body: 'Keep the recording, transcript, summary, concepts, formulas, notes, and exam mentions attached to the class.',
  },
  {
    icon: BookOpen,
    title: 'Class handbook',
    body: 'Turn processed lectures into a class reference you can come back to instead of reopening weeks of separate files.',
  },
  {
    icon: Target,
    title: 'Exam coverage',
    body: 'Choose the lectures an exam covers, then build study material from that exact part of the course.',
  },
  {
    icon: CalendarClock,
    title: 'Study planning',
    body: 'Keep exams, assignments, and study sessions on the same semester schedule as your classes.',
  },
];

export default function LandingEnd() {
  return (
    <>
      <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-blue-600">What stays in Cedar</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Everything stays with the class it came from.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">That is the main difference. You do not keep rebuilding the same course in a new app every time you need something different.</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_.9fr] lg:items-stretch">
          <div className="rounded-[26px] border border-slate-200 bg-white p-7 sm:p-8">
            <p className="text-sm font-semibold text-blue-600">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950">Start free. Upgrade when you use more.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Cedar has Free, Student, Scholar, and Unlimited plans. Paid plans add more lecture processing and study-generation capacity.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Free', 'Student', 'Scholar', 'Unlimited'].map((plan) => (
                <span key={plan} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{plan}</span>
              ))}
            </div>
            <Link to="/register" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">Start free <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="rounded-[26px] bg-slate-950 p-7 text-white sm:p-8">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em]">Record only when you have permission.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Cedar asks you to confirm that you have permission before recording a class. You choose what you record and what you study.</p>
            <Link to="/privacy" className="mt-6 inline-flex text-sm font-semibold text-blue-300 hover:text-white">Read the privacy policy</Link>
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:pb-28">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-[#2E66FF] px-6 py-14 text-center text-white sm:px-10 sm:py-16">
          <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Set up the semester once. Keep using it until the final.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Classes, lecture records, exam coverage, study tools, and your schedule can all stay in the same place.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
