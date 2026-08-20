import React from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, Layers3, Target } from 'lucide-react';

const pillars = [
  {
    icon: BookOpenCheck,
    label: 'Capture the class',
    headline: 'Keep the lecture after it ends.',
    body: 'Turn a permitted lecture into a class record you can search, review, and keep connected to the course it came from.',
    visual: (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">PHYS 117 · Lecture 8</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">Processed</span></div>
        <p className="mt-4 text-sm font-semibold text-slate-950">Vectors & equilibrium</p>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full rounded bg-slate-100" />
          <div className="h-2 w-11/12 rounded bg-slate-100" />
          <div className="h-2 w-4/5 rounded bg-slate-100" />
        </div>
      </div>
    ),
  },
  {
    icon: Layers3,
    label: 'Build the course',
    headline: 'Your class gets more useful every week.',
    body: 'Lecture history, handbook material, coverage, assignments, and study progress accumulate around one persistent class.',
    visual: (
      <div className="grid grid-cols-3 gap-2">
        {[['Week 2', '24%'], ['Week 8', '61%'], ['Week 12', '92%']].map(([week, value], index) => (
          <div key={week} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{week}</p>
            <div className="mt-4 h-14 rounded-xl bg-slate-50 p-2">
              <div className="space-y-1.5">
                {Array.from({ length: index + 2 }).map((_, row) => <div key={row} className="h-1.5 rounded-full bg-blue-100" style={{ width: `${74 - row * 9}%` }} />)}
              </div>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Target,
    label: 'Study what matters',
    headline: 'Study from the course you actually took.',
    body: 'Choose the part of the course an exam covers, then use study tools that already share that lecture context.',
    visual: (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Physics midterm</p>
        <div className="mt-3 flex items-center gap-1.5">
          {['L6','L7','L8','L9','L10','L11'].map((item) => <span key={item} className="rounded-lg bg-blue-50 px-2 py-1.5 text-[9px] font-semibold text-blue-700">{item}</span>)}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2.5 text-white"><span className="text-[10px] font-medium">Study set ready</span><span className="text-[10px] text-slate-400">42 items</span></div>
      </div>
    ),
  },
];

export default function ThreePillars() {
  return (
    <section id="product" className="px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">One system</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-slate-950 sm:text-4xl">Your whole semester, with the context intact.</h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {pillars.map((pillar, index) => (
            <motion.article
              key={pillar.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55, delay: index * 0.06 }}
              className="rounded-[26px] border border-slate-200 bg-slate-50/65 p-5 sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><pillar.icon className="h-5 w-5" /></div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{pillar.label}</p>
              <h3 className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-950">{pillar.headline}</h3>
              <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{pillar.body}</p>
              <div className="mt-6">{pillar.visual}</div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
