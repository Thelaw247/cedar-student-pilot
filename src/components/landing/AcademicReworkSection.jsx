import React from 'react';
import { motion } from 'framer-motion';
import { Bot, CalendarDays, FileText, Mic2, NotebookPen, PanelTop } from 'lucide-react';

const tools = [
  { icon: Mic2, name: 'Recorder', detail: 'Has the lecture' },
  { icon: NotebookPen, name: 'Notes', detail: 'Has what you wrote' },
  { icon: FileText, name: 'Flashcards', detail: 'Has the cards you made' },
  { icon: CalendarDays, name: 'Calendar', detail: 'Has the time' },
  { icon: Bot, name: 'AI chat', detail: 'Has the current prompt' },
  { icon: PanelTop, name: 'Course portal', detail: 'Has the syllabus' },
];

export default function AcademicReworkSection() {
  return (
    <section className="overflow-hidden bg-slate-950 px-4 py-24 text-white sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6 }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">The work behind the work</p>
          <h2 className="mt-5 max-w-xl text-4xl font-bold leading-[1.04] tracking-[-0.05em] sm:text-5xl">You should not have to rebuild the same class five times.</h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
            A lecture becomes notes. Notes become a study guide. The guide becomes flashcards. The exam makes you decide which lectures matter. Then your planner needs the same context again.
          </p>
          <p className="mt-5 text-lg font-semibold tracking-[-0.02em] text-white">That is not disorganization. It is academic rework.</p>
        </motion.div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(46,102,255,0.25),transparent_58%)] blur-2xl" />
          <div className="relative grid gap-3 sm:grid-cols-2">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, x: index % 2 === 0 ? -14 : 14, y: 8 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blue-300"><tool.icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tool.name}</p>
                    <p className="text-[11px] text-slate-400">{tool.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="relative mt-4 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-blue-100">Your tools are good. They just do not know each other.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
