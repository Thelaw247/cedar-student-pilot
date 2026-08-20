import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Brain, CalendarDays, Check, ChevronRight, CircleDollarSign, FileQuestion, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, Target } from 'lucide-react';

export function TestCoverageSection() {
  const [scope, setScope] = useState('Lectures 6–11');
  const scopes = ['Cumulative', 'Since last test', 'Lectures 6–11'];
  return (
    <section className="bg-slate-50 px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Exam prep</p>
          <h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">Study the test you are actually taking.</h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">Tell Cedar what the exam covers. Your study material starts from that exact part of the course.</p>
          <p className="mt-5 max-w-lg text-sm leading-6 text-slate-500">Instead of pasting notes into a fresh prompt, the coverage selector works from a class that already knows its lectures.</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">PHYS 117</p><p className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950">Midterm study set</p></div>
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-6 text-xs font-semibold text-slate-700">What does this exam cover?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {scopes.map((item) => (
              <button key={item} type="button" onClick={() => setScope(item)} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${scope === item ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{item}</button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Selected coverage</span><span className="text-[10px] text-blue-300">{scope}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[['34','Concepts'],['42','Practice'],['18','Flashcards']].map(([value,label]) => <div key={label} className="rounded-xl bg-white/[0.06] p-3 text-center"><p className="text-lg font-bold">{value}</p><p className="mt-0.5 text-[9px] text-slate-400">{label}</p></div>)}
            </div>
            <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E66FF] py-2.5 text-xs font-semibold text-white">Open study set <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function HandbookSection() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Class memory</p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">Your class builds its own handbook.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">Lectures should not stay isolated. As the semester grows, Cedar turns the class into a reference you can return to.</p>
            <div className="mt-8 flex items-center gap-3 text-xs font-semibold text-slate-500"><span>Week 2</span><span className="h-px flex-1 bg-slate-200" /><span>Week 8</span><span className="h-px flex-1 bg-slate-200" /><span className="text-blue-600">Week 12</span></div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }} className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#fbfaf7] shadow-xl shadow-slate-900/5">
            <div className="border-b border-stone-200 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm"><BookOpen className="h-4 w-4 text-blue-600" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">PHYS 117</p><p className="text-sm font-bold text-stone-900">Course handbook</p></div></div></div>
            <div className="grid min-h-[420px] sm:grid-cols-[180px_1fr]">
              <div className="hidden border-r border-stone-200 p-4 sm:block">
                {['1. Measurement','2. Vectors','3. Kinematics','4. Force systems','5. Equilibrium','6. Energy'].map((chapter, index) => <div key={chapter} className={`mb-1 rounded-lg px-3 py-2 text-[10px] font-medium ${index === 3 ? 'bg-white text-blue-700 shadow-sm' : 'text-stone-500'}`}>{chapter}</div>)}
              </div>
              <div className="p-6 sm:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">Chapter 4</p>
                <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-stone-950">Force systems</h3>
                <p className="mt-4 text-sm leading-6 text-stone-600">A force system describes the combined effect of multiple forces acting on a body. The course uses vector resolution and free-body diagrams to analyze those systems before introducing equilibrium conditions.</p>
                <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4"><p className="text-[10px] font-semibold text-stone-500">From your lectures</p><div className="mt-3 flex flex-wrap gap-2">{['Lecture 7','Lecture 8','Lecture 9'].map((lecture) => <span key={lecture} className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">{lecture}</span>)}</div></div>
                <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-stone-100 p-3"><p className="text-lg font-bold text-stone-900">16</p><p className="text-[9px] text-stone-500">Key concepts</p></div><div className="rounded-xl bg-stone-100 p-3"><p className="text-lg font-bold text-stone-900">5</p><p className="text-[9px] text-stone-500">Core formulas</p></div></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function StudySystemSection() {
  const cards = [
    { icon: Brain, title: 'Flashcards & practice', body: 'Turn class knowledge into recall without copying it into another app.' },
    { icon: FileQuestion, title: 'Lecture review', body: 'Test what you learned using the same lecture context.' },
    { icon: Target, title: 'Knowledge coverage', body: 'See what has been reviewed and what still needs attention.' },
    { icon: Sparkles, title: 'Focus sessions', body: 'Move from material to actual study without rebuilding the setup.' },
  ];
  return (
    <section id="study-system" className="bg-slate-950 px-4 py-24 text-white sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">Built-in study system</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Your study tools already know the class.</h2><p className="mt-5 text-base leading-7 text-slate-300">The handoff from “organize it” to “learn it” should not require another app.</p></div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {cards.map((card, index) => <motion.div key={card.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.45, delay: index * 0.05 }} className="rounded-[24px] border border-white/10 bg-white/[0.055] p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300"><card.icon className="h-5 w-5" /></div><h3 className="mt-5 text-xl font-bold tracking-[-0.03em]">{card.title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{card.body}</p></motion.div>)}
        </div>
      </div>
    </section>
  );
}

export function PlannerAndCompoundSection() {
  return (
    <>
      <section className="px-4 py-24 sm:px-6 lg:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Wednesday</p><p className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950">Study plan</p></div><CalendarDays className="h-5 w-5 text-blue-600" /></div>
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-950">Physics Midterm Review</p><p className="mt-1 text-[11px] text-slate-500">PHYS 117 · Lectures 6–11</p></div><span className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-blue-700">7:00 PM</span></div><div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500"><span>45 min</span><span>•</span><span>42 practice items</span><span>•</span><span>18 flashcards</span></div></div>
            <div className="mt-3 rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-800">Calculus problem set</p><p className="mt-1 text-[10px] text-slate-400">MATH 123 · Assignment 4</p></div>
          </div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Planning</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">Your calendar knows when. Cedar knows what.</h2><p className="mt-5 max-w-lg text-base leading-7 text-slate-600">The difference is not having another calendar. The difference is carrying the class, assignment, lecture range, and study material into the time you set aside.</p></div>
        </div>
      </section>

      <section className="overflow-hidden bg-blue-50/60 px-4 py-24 sm:px-6 lg:py-32">
        <div className="mx-auto max-w-6xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">The compounding class</p><h2 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">Your class should get more useful every week.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Cedar accumulates context, not just files.</p>
          <div className="mt-14 grid gap-4 md:grid-cols-4">{[
            ['Week 1','Schedule + first lecture','12%'],['Week 4','Lecture history + handbook','36%'],['Week 8','Coverage + study progress','67%'],['Week 12','Complete exam system','94%']
          ].map(([week,label,value],index) => <motion.div key={week} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.06 }} className="rounded-[22px] border border-blue-100 bg-white p-5 text-left shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">{week}</p><p className="mt-3 min-h-[40px] text-sm font-semibold text-slate-900">{label}</p><div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2E66FF]" style={{ width: value }} /></div><p className="mt-2 text-[10px] font-semibold text-slate-400">{value} built</p></motion.div>)}</div>
        </div>
      </section>
    </>
  );
}

export function ComparisonSection() {
  const rows = [
    ['Persistent classes', true, 'Varies', false],
    ['Lecture history stays connected', true, 'Often single-output', false],
    ['Test coverage tied to lectures', true, 'Varies', false],
    ['Living class handbook', true, 'Varies', false],
    ['Study tools share source material', true, 'Usually manual handoff', false],
    ['Planner linked to class context', true, false, true],
    ['One system from lecture to exam', true, false, false],
  ];
  const cell = (value) => value === true ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : value === false ? <span className="text-slate-300">—</span> : <span className="text-[10px] text-slate-500">{value}</span>;
  return (
    <section className="px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Why Cedar</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">The difference is shared context.</h2><p className="mt-5 text-base leading-7 text-slate-600">Single-purpose tools can be excellent at one job. Cedar is built around keeping the class connected between jobs.</p></div>
        <div className="mt-12 overflow-x-auto rounded-[24px] border border-slate-200"><table className="w-full min-w-[720px] border-collapse bg-white text-left"><thead><tr className="border-b border-slate-200 bg-slate-50"><th className="p-4 text-xs font-semibold text-slate-500">Capability</th><th className="p-4 text-center text-xs font-bold text-blue-700">Cedar Student Pilot</th><th className="p-4 text-center text-xs font-semibold text-slate-500">Single-purpose AI / notes</th><th className="p-4 text-center text-xs font-semibold text-slate-500">Separate productivity apps</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-b border-slate-100 last:border-0"><td className="p-4 text-sm font-medium text-slate-800">{row[0]}</td><td className="p-4 text-center">{cell(row[1])}</td><td className="p-4 text-center">{cell(row[2])}</td><td className="p-4 text-center">{cell(row[3])}</td></tr>)}</tbody></table></div><p className="mt-3 text-center text-[10px] text-slate-400">Capabilities vary by product and plan. Comparison describes general workflow differences, not every competing product.</p></div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    ['01','Build your semester.','Import or enter your classes and schedule.'],
    ['02','Capture the class.','Record permitted lectures and keep them attached to the right course.'],
    ['03','Let the class build.','Lecture records feed your handbook, coverage, and study system.'],
    ['04','Study what matters.','Choose the class or exam scope and use the tools already connected to it.'],
  ];
  return <section id="how-it-works" className="bg-slate-50 px-4 py-24 sm:px-6 lg:py-32"><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">How it works</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">Build it once. Keep the context.</h2><div className="mt-12 grid gap-4 md:grid-cols-4">{steps.map(([number,title,body]) => <div key={number} className="rounded-[22px] border border-slate-200 bg-white p-5"><span className="text-xs font-bold text-blue-600">{number}</span><h3 className="mt-8 text-lg font-bold tracking-[-0.03em] text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p></div>)}</div></div></section>;
}

export function TrustPricingFinal() {
  return (
    <>
      <section className="px-4 py-24 sm:px-6 lg:py-32"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2"><div className="rounded-[28px] border border-slate-200 bg-white p-7 sm:p-8"><ShieldCheck className="h-6 w-6 text-blue-600" /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Trust and control</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.045em] text-slate-950">Your class. Your control.</h2><div className="mt-6 space-y-4 text-sm leading-6 text-slate-600">{['Recording requires you to confirm permission.','You choose what to record and what to study.','Credits and usage stay visible.','Privacy information stays publicly accessible.'].map((item) => <div key={item} className="flex gap-3"><LockKeyhole className="mt-1 h-4 w-4 flex-none text-slate-400" /><span>{item}</span></div>)}</div></div><div id="pricing" className="rounded-[28px] bg-slate-950 p-7 text-white sm:p-8"><CircleDollarSign className="h-6 w-6 text-blue-400" /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">Pricing</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.045em]">A plan for the way you study.</h2><p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Start free. Move up when you need more lecture processing, study generation, and class capacity.</p><div className="mt-7 flex flex-wrap gap-2">{['Free','Student','Scholar','Unlimited'].map((plan,index) => <span key={plan} className={`rounded-xl px-3 py-2 text-xs font-semibold ${index === 1 ? 'bg-[#2E66FF] text-white' : 'bg-white/[0.08] text-slate-300'}`}>{plan}</span>)}</div><Link to="/register" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-white">Start free <ArrowRight className="h-4 w-4" /></Link></div></div></section>
      <section className="px-4 pb-24 pt-10 sm:px-6 lg:pb-32"><div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#2E66FF] px-6 py-16 text-center text-white shadow-2xl shadow-blue-600/20 sm:px-10 sm:py-20"><RotateCcw className="mx-auto h-6 w-6 text-blue-100" /><h2 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Your classes should keep working for you.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-blue-100">From the first lecture to the final exam, Cedar keeps the context together so you can spend less time rebuilding and more time learning.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">Start building your semester <ArrowRight className="h-4 w-4" /></Link><Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15">Sign in</Link></div></div></section>
    </>
  );
}
