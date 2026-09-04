import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, Check, Trash2, ArrowRight } from 'lucide-react';
import Widget from '@/components/ui/Widget';
import { useTodos } from '@/hooks/useTodos';
import { TODO_KIND_LABEL } from './lectureStudy';

/**
 * The checklist for one lecture: what the professor assigned (source
 * 'lecture', written by the enrichment pass) plus anything the student adds
 * here. The same rows appear in the To-Do tab; ticking one here ticks it
 * there. Older lectures without an enrichment still show their flat
 * ai_action_items so nothing that used to be visible disappears.
 */
export default function LectureTodos({ lecture, legacyActionItems }) {
  const { todos, loaded, toggle, create, remove } = useTodos({ lecture_id: lecture.id });
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const showLegacy = loaded && todos.length === 0 && legacyActionItems?.length > 0;

  const add = async (e) => {
    e.preventDefault();
    if (!draft.trim() || adding) return;
    setAdding(true);
    try {
      await create({ title: draft.trim(), lecture_id: lecture.id, class_id: lecture.class_id, source: 'manual' });
      setDraft('');
    } catch { /* the hook rolled the list back; the draft stays for a retry */ }
    setAdding(false);
  };

  if (!showLegacy && loaded && todos.length === 0 && !lecture.enriched_at) return null;

  return (
    <Widget id="sec-todos" icon={ListChecks} title="To-do from this lecture" collapsible storageKey="lec-actions"
      meta={todos.length ? `${open.length} open · ${done.length} done` : showLegacy ? `${legacyActionItems.length} action items` : 'Nothing assigned yet — add your own'}
      action={<Link to="/todos" onClick={(e) => e.stopPropagation()} className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1">All to-dos <ArrowRight className="w-3 h-3" /></Link>}
      className="mb-4 scroll-mt-24" padded>
      <div className="pt-1">
        {showLegacy && (
          <ul className="space-y-1.5 mb-3">
            {legacyActionItems.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />{a}
              </li>
            ))}
          </ul>
        )}
        {[...open, ...done].length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {[...open, ...done].map((t) => (
              <li key={t.id} className={`group flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/50 ${t.done ? 'opacity-60' : ''}`}>
                <button type="button" role="checkbox" aria-checked={t.done} onClick={() => toggle(t)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${t.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary'}`}>
                  {t.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm text-foreground ${t.done ? 'line-through' : ''}`}>{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {TODO_KIND_LABEL[t.kind] || 'Task'}
                    {t.detail ? ` · ${t.detail}` : ''}
                    {t.due_date ? ` · due ${t.due_date}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => remove(t.id)} aria-label="Delete to-do"
                  className="reveal-on-hover opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex items-center gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a to-do for this lecture…"
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <button type="submit" disabled={!draft.trim() || adding}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>
      </div>
    </Widget>
  );
}
