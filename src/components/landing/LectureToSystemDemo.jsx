import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, BrainCircuit, CalendarClock, CheckCircle2, FileQuestion, Layers3, Mic2, NotebookTabs, Sparkles, Target } from 'lucide-react';

const outputs = [
  { icon: NotebookTabs, label: 'Lecture record', detail: 'Transcript, concepts, formulas' },
  { icon: BookOpen, label: 'Class handbook', detail: 'Adds to the course reference' },
  { icon: Target, label: 'Test coverage', detail: 'Understands where this lecture belongs' },
  { icon: Sparkles, label: 'Study guide', detail: 'Uses the selected course scope' },
  { icon: BrainCircuit, label: 'Flashcards', detail: 'Build recall from class context' },
  { icon: FileQuestion, label: 'Practice', detail: 'Questions from the same source material' },
  { icon: CheckCircle2, label: 'Review', detail: 'Test what you actually learned' },
  { icon: CalendarClock, label: 'Study plan', detail: 'Carry the class into scheduled work' },
];

export default function LectureToSystemDemo() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">One source. More value.</p>
          <h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">One lecture. Still useful months later.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Capture it once. Keep using the context across the rest of the course.</p>
        </div>

        <div className="relative mt-16 grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.55 }} className="relative">
            <div className="absolute -inset-6 -z-10 rounded-full bg-blue-100/80 blur-3xl" />
            <div className="rounded-[28px] border border-blue-200 bg-white p-5 shadow-2xl shadow-blue-950/10 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E66FF] text-white"><Mic2 className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">PHYS 117 · Lecture 8</p>
                    <p className="mt-0.5 text-base font-bold tracking-[-0.02em] text-slate-950">Vectors & equilibrium</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Processed</span>
              </div>
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-slate-400">Lecture record</span><span className="text-[10px] font-semibold text-slate-600">78 min</span></div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Key ideas</p>
                <div className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
                  <p>• Resolving force vectors into components</p>
                  <p>• Conditions required for equilibrium</p>
                  <p>• Free-body diagram conventions</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['12','Concepts'],['7','Terms'],['4','Formulas']].map(([value,label]) => (
                  <div key={label} className="rounded-xl border border-slate-200 px-2 py-3"><p className="text-sm font-bold text-slate-950">{value}</p><p className="mt-0.5 text-[9px] text-slate-400">{label}</p></div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2">
            {outputs.map((output, index) => (
              <motion.div
                key={output.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.45, delay: index * 0.045 }}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-600"><output.icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{output.label}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{output.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            <div className="sm:col-span-2 rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-400" /><p className="text-sm font-semibold">The context stays attached.</p></div>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">These are not eight unrelated generations. They are different ways of using the same class knowledge over time.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
