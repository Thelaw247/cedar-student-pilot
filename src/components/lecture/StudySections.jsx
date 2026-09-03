import React, { useState } from 'react';
import {
  Sparkles, ListTree, Lightbulb, Sigma, BookOpen, FlaskConical, AlertCircle, HelpCircle,
  ShieldCheck, ShieldAlert, ExternalLink, ChevronDown, TriangleAlert,
} from 'lucide-react';
import Widget from '@/components/ui/Widget';
import Formula from './Formula';
import AnchorButton from './AnchorButton';
import { resourceLinks, DIFFICULTY_LABEL, DIFFICULTY_CLASS } from './lectureStudy';

/**
 * The study page proper — every section built from `ai_enrichment`.
 *
 * Design rules these follow (the student research behind the redesign):
 *   skim first    — every section opens with something readable in one
 *                   glance (a heading, a one-liner, a chip row) and the
 *                   depth is one tap below it
 *   nothing lost  — everything the pass found is on the page; long lists
 *                   collapse, they never truncate
 *   provenance    — anything that came from the professor's own material
 *                   says so with a badge; anything from the transcript alone
 *                   says that too, so a student knows what to double-check
 *   linked        — concepts jump to the transcript and out to the web;
 *                   related concepts cross-link inside the page
 */

function SectionShell({ id, icon, title, meta, storageKey, children, defaultOpen = true }) {
  return (
    <Widget id={id} icon={icon} title={title} meta={meta} collapsible storageKey={storageKey} defaultOpen={defaultOpen} className="mb-4 scroll-mt-24" padded>
      <div className="pt-1">{children}</div>
    </Widget>
  );
}

function ProvenanceBadge({ item }) {
  if (item?.verified) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-500" title={item.material_quote ? `Matches the attached material: “${item.material_quote}”` : 'Matches the attached material'}>
        <ShieldCheck className="w-3 h-3" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-500" title="Taken from the recording only. Attach the professor's slides to verify it.">
      <ShieldAlert className="w-3 h-3" /> From recording
    </span>
  );
}

// ---------------------------------------------------------------------------

export function OverviewSection({ lecture, enrichment }) {
  const takeaways = enrichment?.key_takeaways || [];
  return (
    <SectionShell id="sec-overview" icon={Sparkles} title="Overview" storageKey="lec-summary"
      meta={enrichment?.one_liner || undefined}>
      {enrichment?.one_liner && (
        <p className="text-base font-medium text-foreground leading-snug mb-3">{enrichment.one_liner}</p>
      )}
      {lecture.ai_summary && (
        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{lecture.ai_summary}</p>
      )}
      {takeaways.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Remember these</p>
          <ol className="space-y-1.5">
            {takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </SectionShell>
  );
}

export function OutlineSection({ outline, onJump }) {
  if (!outline?.length) return null;
  return (
    <SectionShell id="sec-outline" icon={ListTree} title="Lecture outline" storageKey="lec-outline"
      meta={`${outline.length} sections, in the order they were taught`}>
      <ol className="relative border-l border-border ml-2.5 space-y-5">
        {outline.map((s, i) => (
          <li key={i} className="pl-5">
            <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">{i + 1}. {s.heading}</h4>
              <AnchorButton item={s} onJump={onJump} label="Listen here" className="flex-shrink-0" />
            </div>
            <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{s.summary}</p>
            {s.key_points?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {s.key_points.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-[13px] text-foreground/85">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />{p}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function ConceptCard({ concept, onJump, onSelectRelated, highlighted }) {
  const [open, setOpen] = useState(false);
  const links = resourceLinks(concept);
  return (
    <div id={`concept-${slug(concept.name)}`} className={`rounded-xl border p-4 transition-colors scroll-mt-28 ${highlighted ? 'border-primary bg-primary/[0.04]' : 'border-border bg-card'}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground">{concept.name}</h4>
            <p className={`text-[13px] text-foreground/80 mt-1 leading-relaxed ${open ? '' : 'line-clamp-2'}`}>{concept.explanation}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${DIFFICULTY_CLASS[concept.difficulty] || DIFFICULTY_CLASS.core}`}>
              {DIFFICULTY_LABEL[concept.difficulty] || 'Core'}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-standard ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {concept.why_it_matters && (
            <p className="text-[13px] text-foreground/85"><span className="font-medium text-foreground">Why it matters: </span>{concept.why_it_matters}</p>
          )}
          {concept.related?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Related:</span>
              {concept.related.map((r) => (
                <button key={r} type="button" onClick={() => onSelectRelated?.(r)}
                  className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                  {r}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            <AnchorButton item={concept} onJump={onJump} />
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3 h-3" /> {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function ConceptsSection({ concepts, legacyConcepts, onJump }) {
  const [highlight, setHighlight] = useState(null);
  if (!concepts?.length) {
    if (!legacyConcepts?.length) return null;
    return (
      <SectionShell id="sec-concepts" icon={Lightbulb} title="Key concepts" storageKey="lec-concepts" meta={`${legacyConcepts.length} concepts`}>
        <div className="flex flex-wrap gap-2">
          {legacyConcepts.map((c, i) => <span key={i} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{c}</span>)}
        </div>
      </SectionShell>
    );
  }
  const core = concepts.filter((c) => c.difficulty === 'core').length;
  const selectRelated = (name) => {
    setHighlight(name);
    const el = document.getElementById(`concept-${slug(name)}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlight(null), 2500);
  };
  return (
    <SectionShell id="sec-concepts" icon={Lightbulb} title="Concepts" storageKey="lec-concepts"
      meta={`${concepts.length} concepts · ${core} core · tap one to expand, jump to the recording, or read more`}>
      <div className="space-y-2.5">
        {concepts.map((c, i) => (
          <ConceptCard key={i} concept={c} onJump={onJump} onSelectRelated={selectRelated} highlighted={highlight === c.name} />
        ))}
      </div>
    </SectionShell>
  );
}

export function FormulasSection({ formulas, legacyFormulas, hasMaterials, onJump }) {
  const list = formulas?.length ? formulas : null;
  if (!list && !legacyFormulas?.length) return null;
  const verified = (list || []).filter((f) => f.verified).length;
  const meta = list
    ? `${list.length} formula${list.length === 1 ? '' : 's'}${hasMaterials ? ` · ${verified} verified against your materials` : ' · attach the slides to verify them'}`
    : `${legacyFormulas.length} formulas`;
  return (
    <SectionShell id="sec-formulas" icon={Sigma} title="Formulas" storageKey="lec-formulas" meta={meta}>
      {!list ? (
        <div className="space-y-1.5">
          {legacyFormulas.map((f, i) => <div key={i} className="px-3 py-2 rounded-lg bg-muted font-mono text-sm">{f}</div>)}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((f, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground">{f.name}</h4>
                <ProvenanceBadge item={f} />
              </div>
              <div className="rounded-lg bg-muted/60 px-3 py-2 my-2">
                <Formula expression={f.expression} />
              </div>
              {f.meaning && <p className="text-[13px] text-foreground/85 leading-relaxed">{f.meaning}</p>}
              {f.variables?.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  {f.variables.map((v, j) => (
                    <React.Fragment key={j}>
                      <dt className="font-mono font-semibold text-foreground">{v.symbol}</dt>
                      <dd className="text-foreground/80">{v.meaning}{v.unit ? <span className="text-muted-foreground"> · {v.unit}</span> : null}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}
              {f.when_to_use && (
                <p className="text-[12px] text-muted-foreground mt-3"><span className="font-medium text-foreground/80">Use it when: </span>{f.when_to_use}</p>
              )}
              <div className="mt-2"><AnchorButton item={f} onJump={onJump} /></div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

export function DefinitionsSection({ definitions, legacyDefinitions, onJump }) {
  const list = definitions?.length ? definitions : (legacyDefinitions || []).map((d) => ({ term: d.term, definition: d.definition, legacy: true }));
  if (!list.length) return null;
  return (
    <SectionShell id="sec-definitions" icon={BookOpen} title="Definitions" storageKey="lec-defs" meta={`${list.length} terms`}>
      <dl className="divide-y divide-border">
        {list.map((d, i) => (
          <div key={i} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <dt className="text-sm font-semibold text-foreground">{d.term}</dt>
              {!d.legacy && <ProvenanceBadge item={d} />}
            </div>
            <dd className="text-[13px] text-foreground/80 mt-0.5 leading-relaxed">{d.definition}</dd>
            {!d.legacy && <AnchorButton item={d} onJump={onJump} className="mt-1" />}
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}

export function ExamplesSection({ examples, onJump }) {
  if (!examples?.length) return null;
  return (
    <SectionShell id="sec-examples" icon={FlaskConical} title="Worked examples" storageKey="lec-examples" meta={`${examples.length} from the lecture`}>
      <div className="space-y-3">
        {examples.map((e, i) => <ExampleCard key={i} example={e} onJump={onJump} />)}
      </div>
    </SectionShell>
  );
}

function ExampleCard({ example, onJump }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-sm font-semibold text-foreground">{example.title}</h4>
      <p className="text-[13px] text-foreground/85 mt-1 leading-relaxed whitespace-pre-line">{example.problem}</p>
      {(example.steps?.length > 0 || example.answer) && (
        <button type="button" onClick={() => setReveal((v) => !v)} className="mt-2 text-[11px] font-medium text-primary hover:underline">
          {reveal ? 'Hide the solution' : 'Try it first, then show the solution'}
        </button>
      )}
      {reveal && (
        <div className="mt-2 animate-fade-in">
          {example.steps?.length > 0 && (
            <ol className="space-y-1.5">
              {example.steps.map((s, j) => (
                <li key={j} className="flex items-start gap-2.5 text-[13px] text-foreground/85">
                  <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
                  <span className="whitespace-pre-line">{s}</span>
                </li>
              ))}
            </ol>
          )}
          {example.answer && (
            <p className="mt-2 text-[13px] rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2"><span className="font-semibold text-emerald-700 dark:text-emerald-500">Answer: </span>{example.answer}</p>
          )}
        </div>
      )}
      <div className="mt-2"><AnchorButton item={example} onJump={onJump} /></div>
    </div>
  );
}

const IMPORTANCE_CLASS = {
  high: 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400',
  medium: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-500',
  low: 'border-border bg-muted/40 text-foreground/80',
};

export function ExamRadarSection({ radar, legacyMentions, onJump }) {
  const list = radar?.length ? radar : (legacyMentions || []).map((m) => ({ note: m, importance: 'medium', legacy: true }));
  if (!list.length) return null;
  const high = list.filter((x) => x.importance === 'high').length;
  return (
    <SectionShell id="sec-exam" icon={AlertCircle} title="Exam radar" storageKey="lec-exams"
      meta={high ? `${list.length} notes · ${high} flagged high priority` : `${list.length} notes about assessment`}>
      <div className="space-y-2">
        {list.map((x, i) => (
          <div key={i} className={`rounded-lg border px-3 py-2.5 ${IMPORTANCE_CLASS[x.importance] || IMPORTANCE_CLASS.medium}`}>
            <div className="flex items-start gap-2">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] leading-relaxed">{x.note}</p>
                {!x.legacy && <AnchorButton item={x} onJump={onJump} className="mt-1" />}
              </div>
              <span className="text-[10px] font-semibold uppercase flex-shrink-0">{x.importance}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function InsightsSection({ misconceptions, questions }) {
  if (!misconceptions?.length && !questions?.length) return null;
  return (
    <SectionShell id="sec-insights" icon={HelpCircle} title="Watch out & ask" storageKey="lec-insights" defaultOpen={false}
      meta={[misconceptions?.length ? `${misconceptions.length} common mistakes` : null, questions?.length ? `${questions.length} questions to ask` : null].filter(Boolean).join(' · ')}>
      {misconceptions?.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Easy to get wrong</p>
          <ul className="space-y-1.5">
            {misconceptions.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/85"><span className="text-rose-500 mt-0.5">✗</span>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {questions?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Worth asking your prof or TA</p>
          <ul className="space-y-1.5">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/85"><HelpCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />{q}</li>
            ))}
          </ul>
        </div>
      )}
    </SectionShell>
  );
}
