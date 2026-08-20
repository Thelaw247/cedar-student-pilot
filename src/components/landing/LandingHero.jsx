import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, Mic2, Sparkles } from 'lucide-react';

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function TimelineRow({ time, title, meta, color, active }) {
  return (
    <div className="grid grid-cols-[58px_1fr] gap-3">
      <span className="pt-3 text-[11px] font-medium tabular-nums text-slate-400">{time}</span>
      <div className={`rounded-xl border px-3.5 py-3 ${active ? 'border-blue-200 bg-blue-50/80 shadow-sm' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start gap-3">
          <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{meta}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -left-10 top-24 hidden w-48 rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-xl shadow-blue-950/10 backdrop-blur-xl lg:block">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-4 w-4" /></div>
          <div>
            <p className="text-[11px] font-semibold text-slate-900">Lecture processed</p>
            <p className="text-[10px] text-slate-500">Vectors & equilibrium</p>
          </div>
        </div>
      </div>

      <div className="absolute -right-8 top-14 hidden w-52 rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-xl shadow-blue-950/10 backdrop-blur-xl lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">Exam coverage</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">Lectures 6–11</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full bg-[#2E66FF]" /></div>
      </div>

      <div className="absolute -right-3 bottom-14 hidden w-48 rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-xl shadow-blue-950/10 backdrop-blur-xl md:block">
        <div className="flex items-center gap-2 text-slate-900">
          <BookOpen className="h-4 w-4 text-[#2E66FF]" />
          <span className="text-[11px] font-semibold">Handbook updated</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Chapter 4 · Force systems</p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_90px_-28px_rgba(30,64,175,0.28)]">
        <div className="flex h-10 items-center gap-1.5 border-b border-slate-200 bg-slate-50/90 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="mx-auto h-5 w-48 rounded-md bg-white shadow-inner" />
        </div>
        <div className="grid min-h-[470px] grid-cols-1 md:grid-cols-[180px_1fr]">
          <aside className="hidden border-r border-slate-200 bg-slate-50/70 p-4 md:block">
            <div className="flex items-center gap-2 px-1 pb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2E66FF] text-white"><GraduationCap className="h-4 w-4" /></div>
              <div>
                <p className="text-xs font-semibold text-slate-950">Cedar</p>
                <p className="text-[9px] text-slate-400">Student Pilot</p>
              </div>
            </div>
            {[
              ['Today', CalendarDays, true],
              ['Classes', BookOpen, false],
              ['Study', Sparkles, false],
              ['Analytics', Clock3, false],
            ].map(([label, Icon, active]) => (
              <div key={label} className={`mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] font-medium ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
            ))}
          </aside>

          <main className="p-4 sm:p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400">Tuesday, September 22</p>
                <h3 className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-950 sm:text-2xl">Good morning, Alex</h3>
              </div>
              <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 sm:block">
                <p className="text-[10px] text-slate-400">Today</p>
                <p className="text-xs font-semibold text-slate-900">3 classes · 1 study block</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">Today’s schedule</p>
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">Add event</span>
                </div>
                <div className="space-y-2.5">
                  <TimelineRow time="9:30" title="PHYS 117" meta="Engineering Building · Room 2B01" color="#2E66FF" active />
                  <TimelineRow time="11:00" title="MATH 123" meta="Calculus II · Arts 134" color="#8B5CF6" />
                  <TimelineRow time="2:30" title="CHEM 112" meta="General Chemistry · Thorvaldson" color="#10B981" />
                  <TimelineRow time="7:00" title="Physics Midterm Review" meta="Lectures 6–11 · 45 min" color="#F59E0B" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Current class</p>
                    <Mic2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="mt-4 text-lg font-semibold tracking-[-0.02em]">PHYS 117</p>
                  <p className="mt-1 text-[11px] text-slate-400">Vectors & equilibrium</p>
                  <button type="button" className="mt-4 w-full rounded-xl bg-white py-2 text-xs font-semibold text-slate-950">Record lecture</button>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-900">Study progress</p>
                    <span className="text-xs font-semibold text-blue-600">68%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[68%] rounded-full bg-[#2E66FF]" /></div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-500">Physics midterm coverage is ready for review.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-32 sm:px-6 sm:pt-36 lg:pb-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] bg-[radial-gradient(circle_at_50%_18%,rgba(46,102,255,0.16),transparent_34%),linear-gradient(to_bottom,#f8fbff_0%,#ffffff_74%)]" />
      <motion.div initial="hidden" animate="visible" transition={{ staggerChildren: 0.08 }} className="mx-auto max-w-5xl text-center">
        <motion.p variants={reveal} transition={{ duration: 0.55 }} className="mx-auto inline-flex items-center rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-semibold tracking-[-0.01em] text-blue-700 shadow-sm backdrop-blur">
          The academic operating system for university
        </motion.p>
        <motion.h1 variants={reveal} transition={{ duration: 0.6 }} className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-bold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
          Make every class compound.
        </motion.h1>
        <motion.p variants={reveal} transition={{ duration: 0.6 }} className="mx-auto mt-6 max-w-2xl text-balance text-base leading-7 text-slate-600 sm:text-lg">
          Cedar keeps your lectures, class knowledge, test coverage, study tools, and schedule connected, so the work you do once keeps helping you all semester.
        </motion.p>
        <motion.div variants={reveal} transition={{ duration: 0.6 }} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E66FF] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-[#2459e8] sm:w-auto">
            Start building your semester <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#product" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto">
            See how Cedar works
          </a>
        </motion.div>
        <motion.div variants={reveal} transition={{ duration: 0.6 }} className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
          <span>Keep the lecture after it ends.</span>
          <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
          <span>Build from your actual class.</span>
          <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
          <span>Study exactly what your test covers.</span>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="mx-auto mt-14 max-w-6xl sm:mt-16">
        <ProductMockup />
      </motion.div>
    </section>
  );
}
