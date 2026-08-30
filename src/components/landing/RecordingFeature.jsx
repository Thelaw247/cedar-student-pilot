import React from 'react';
import { AlertCircle, BookOpen, FileText, Lightbulb, Mic, Pause, ShieldCheck, Tag } from 'lucide-react';

function OutputRow({ icon: Icon, title, children, tone = 'blue' }) {
  const toneClass = tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-600">{children}</div>
    </div>
  );
}

export default function RecordingFeature() {
  return (
    <section id="recording" className="border-y border-slate-200 bg-slate-50 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tracking-[-0.07em] text-blue-100">01</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Lecture recording</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-500">The class only happens once.</p>
              </div>
            </div>
            <h2 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-slate-950 sm:text-5xl">
              Record the lecture. Keep what your professor actually taught.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              With permission, start a recording from the class. When it ends, Praelecta keeps the lecture with the course instead of leaving you with an audio file you have to sort out later.
            </p>
            <div className="mt-7 space-y-3 text-sm text-slate-700">
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-blue-600" /><span>Praelecta asks you to confirm recording permission for the class first.</span></div>
              <div className="flex gap-3"><FileText className="mt-0.5 h-5 w-5 flex-none text-blue-600" /><span>The recording becomes a lecture record with transcript, summary, concepts, formulas, notes, and exam mentions.</span></div>
              <div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5 flex-none text-blue-600" /><span>That same lecture can later feed the class handbook, test coverage, flashcards, practice, and reviews.</span></div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.78fr_1.22fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">PHYS 117</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">Record Lecture</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700"><ShieldCheck className="h-3 w-3" /> Permission confirmed</span>
              </div>

              <div className="mt-7 text-center">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
                  <span className="absolute inset-0 rounded-full border border-rose-100" />
                  <Mic className="h-9 w-9 text-rose-600" />
                </div>
                <p className="mt-5 text-3xl font-bold tabular-nums tracking-[-0.04em] text-slate-950">38:17</p>
                <p className="mt-1 text-xs font-medium text-rose-600">Recording in progress</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <div className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700"><Pause className="h-3.5 w-3.5" /> Pause</div>
                <div className="rounded-xl bg-rose-600 py-2.5 text-center text-xs font-semibold text-white">Stop</div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold text-slate-500">Your notes &amp; cues</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">Prof emphasized equilibrium equations and said free-body diagrams will be on the midterm.</p>
              </div>
              <p className="mt-3 text-center text-[10px] text-slate-400">Based on Praelecta&rsquo;s current recording screen</p>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.4)] sm:p-6">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">Saved lecture</p>
                <h3 className="mt-1 text-xl font-bold tracking-[-0.035em] text-slate-950">Equilibrium &amp; free-body diagrams</h3>
                <p className="mt-1 text-xs text-slate-500">PHYS 117 · 38 min</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <OutputRow icon={FileText} title="Summary">
                  Resolve forces into components, draw a complete free-body diagram, then apply ΣF = 0 and ΣM = 0.
                </OutputRow>
                <OutputRow icon={Lightbulb} title="Key concepts">
                  <div className="flex flex-wrap gap-1.5"><span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">Equilibrium</span><span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">FBDs</span><span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">Moments</span></div>
                </OutputRow>
                <OutputRow icon={Tag} title="Formulas">
                  <div className="space-y-1 font-mono text-[11px]"><p>ΣFₓ = 0</p><p>ΣFᵧ = 0</p><p>ΣM = 0</p></div>
                </OutputRow>
                <OutputRow icon={AlertCircle} title="Exam mention" tone="amber">
                  Free-body diagrams and equilibrium equations were specifically flagged for the midterm.
                </OutputRow>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-800">Transcript</p>
                <p className="mt-2 line-clamp-4 text-[11px] leading-5 text-slate-500">“The first thing I want you to do on every equilibrium problem is isolate the body. Draw the forces you actually know are acting on it before you write a single equation…”</p>
              </div>
              <p className="mt-3 text-center text-[10px] text-slate-400">Structured from the same fields shown on Praelecta&rsquo;s lecture detail screen</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}