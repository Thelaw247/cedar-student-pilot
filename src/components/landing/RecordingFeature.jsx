import React from 'react';
import { AlertCircle, BookOpen, FileText, Lightbulb, Mic, Pause, ShieldCheck, Tag } from 'lucide-react';

function OutputRow({ icon: Icon, title, children, tone = 'blue' }) {
  const toneClass = tone === 'amber' ? 'bg-amber-50 text-amber-400' : 'bg-primary/10 text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="mt-3 text-xs leading-5 text-muted-foreground">{children}</div>
    </div>
  );
}

export default function RecordingFeature() {
  return (
    <section id="recording" className="border-y border-border bg-muted px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tracking-[-0.07em] text-primary/25">01</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Lecture recording</p>
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">The class only happens once.</p>
              </div>
            </div>
            <h2 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-foreground sm:text-5xl">
              Record the lecture. Keep what your professor actually taught.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              With permission, start a recording from the class. When it ends, we keep the lecture with the course instead of leaving you with an audio file you have to sort out later.
            </p>
            <div className="mt-7 space-y-3 text-sm text-foreground/80">
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-primary" /><span>We ask you to confirm recording permission for the class first.</span></div>
              <div className="flex gap-3"><FileText className="mt-0.5 h-5 w-5 flex-none text-primary" /><span>The recording becomes a lecture record with transcript, summary, concepts, formulas, notes, and exam mentions.</span></div>
              <div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5 flex-none text-primary" /><span>That same lecture can later feed the class handbook, test coverage, flashcards, practice, and reviews.</span></div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.78fr_1.22fr]">
            <div className="rounded-[26px] border border-border bg-card p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">PHYS 117</p>
                  <p className="mt-1 text-sm font-bold text-foreground">Record Lecture</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-400"><ShieldCheck className="h-3 w-3" /> Permission confirmed</span>
              </div>

              <div className="mt-7 text-center">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
                  <span className="absolute inset-0 rounded-full border border-rose-500/30" />
                  <Mic className="h-9 w-9 text-rose-400" />
                </div>
                <p className="mt-5 text-3xl font-bold tabular-nums tracking-[-0.04em] text-foreground">38:17</p>
                <p className="mt-1 text-xs font-medium text-rose-400">Recording in progress</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <div className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground/80"><Pause className="h-3.5 w-3.5" /> Pause</div>
                <div className="rounded-xl bg-rose-600 py-2.5 text-center text-xs font-semibold text-white">Stop</div>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-muted p-3">
                <p className="text-[10px] font-semibold text-muted-foreground">Your notes &amp; cues</p>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Prof emphasized equilibrium equations and said free-body diagrams will be on the midterm.</p>
              </div>
              <p className="mt-3 text-center text-[10px] text-muted-foreground/80">Based on Praelecta&rsquo;s current recording screen</p>
            </div>

            <div className="rounded-[26px] border border-border bg-card p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.4)] sm:p-6">
              <div className="border-b border-border pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Saved lecture</p>
                <h3 className="mt-1 text-xl font-bold tracking-[-0.035em] text-foreground">Equilibrium &amp; free-body diagrams</h3>
                <p className="mt-1 text-xs text-muted-foreground">PHYS 117 · 38 min</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <OutputRow icon={FileText} title="Summary">
                  Resolve forces into components, draw a complete free-body diagram, then apply ΣF = 0 and ΣM = 0.
                </OutputRow>
                <OutputRow icon={Lightbulb} title="Key concepts">
                  <div className="flex flex-wrap gap-1.5"><span className="rounded-md bg-primary/10 px-2 py-1 text-primary">Equilibrium</span><span className="rounded-md bg-primary/10 px-2 py-1 text-primary">FBDs</span><span className="rounded-md bg-primary/10 px-2 py-1 text-primary">Moments</span></div>
                </OutputRow>
                <OutputRow icon={Tag} title="Formulas">
                  <div className="space-y-1 font-mono text-[11px]"><p>ΣFₓ = 0</p><p>ΣFᵧ = 0</p><p>ΣM = 0</p></div>
                </OutputRow>
                <OutputRow icon={AlertCircle} title="Exam mention" tone="amber">
                  Free-body diagrams and equilibrium equations were specifically flagged for the midterm.
                </OutputRow>
              </div>

              <div className="mt-3 rounded-xl border border-border bg-muted p-4">
                <p className="text-xs font-semibold text-foreground/85">Transcript</p>
                <p className="mt-2 line-clamp-4 text-[11px] leading-5 text-muted-foreground">“The first thing I want you to do on every equilibrium problem is isolate the body. Draw the forces you actually know are acting on it before you write a single equation…”</p>
              </div>
              <p className="mt-3 text-center text-[10px] text-muted-foreground/80">Structured from the same fields shown on Praelecta&rsquo;s lecture detail screen</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}