import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, Check, Trash2, CalendarDays, Mic, ChevronDown, Filter } from 'lucide-react';
import Widget from '@/components/ui/Widget';
import EmptyState from '@/components/EmptyState';
import { useTodos, localToday } from '@/hooks/useTodos';
import { fetchWithCache } from '@/hooks/useEntityData';
import { classColor } from '@/lib/color';
import { TODO_KIND_LABEL } from '@/components/lecture/lectureStudy';

/**
 * The To-Do tab.
 *
 * One list, three sources of truth folded together: what professors assigned
 * in lectures (the enrichment pass writes those, tagged with the lecture),
 * what the student added on a lecture page, and what they add here. Grouped
 * the way a student actually triages — overdue, today, this week, later, no
 * date — with a per-class filter, and ticked items sliding into a folded
 * "Done" list rather than vanishing.
 */
const KINDS = ['task', 'read', 'practice', 'submit', 'review', 'prepare'];

export default function Todos() {
  const { todos, loaded, toggle, create, update, remove } = useTodos();
  const [classes, setClasses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState({ title: '', kind: 'task', due_date: '', class_id: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [semesters, lecs] = await Promise.all([
          fetchWithCache('Semester', 'filter', [{ is_active: true }]),
          fetchWithCache('Lecture', 'list', ['-date', 100]),
        ]);
        const cls = semesters.length > 0 ? await fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }]) : [];
        if (!cancelled) { setClasses(cls); setLectures(lecs); }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const lectureById = useMemo(() => new Map(lectures.map((l) => [l.id, l])), [lectures]);
  const today = localToday();
  const weekEnd = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);

  const filtered = todos.filter((t) => classFilter === 'all' || t.class_id === classFilter);
  const open = filtered.filter((t) => !t.done);
  const done = filtered.filter((t) => t.done).sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')));

  const groups = [
    { key: 'overdue', title: 'Overdue', tone: 'text-rose-600', items: open.filter((t) => t.due_date && t.due_date < today) },
    { key: 'today', title: 'Today', tone: 'text-primary', items: open.filter((t) => t.due_date === today) },
    { key: 'week', title: 'This week', tone: 'text-foreground', items: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= weekEnd) },
    { key: 'later', title: 'Later', tone: 'text-foreground', items: open.filter((t) => t.due_date && t.due_date > weekEnd) },
    { key: 'undated', title: 'No date yet', tone: 'text-muted-foreground', items: open.filter((t) => !t.due_date) },
  ].filter((g) => g.items.length > 0);
  for (const g of groups) g.items.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '') || (a.position - b.position) || String(b.created_at).localeCompare(String(a.created_at)));

  const add = async (e) => {
    e.preventDefault();
    if (!draft.title.trim() || adding) return;
    setAdding(true);
    try {
      await create({
        title: draft.title.trim(), kind: draft.kind, source: 'manual',
        due_date: draft.due_date || null, class_id: draft.class_id || null,
      });
      setDraft((d) => ({ ...d, title: '' }));
    } catch { /* hook rolled back; keep the draft */ }
    setAdding(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">To-do</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {open.length === 0 ? 'Nothing open.' : `${open.length} open`}{done.length ? ` · ${done.length} done` : ''} · lecture tasks are added here automatically
          </p>
        </div>
        {classes.length > 1 && (
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* Add */}
      <form onSubmit={add} className="rounded-xl border border-border bg-card shadow-1 p-3 mb-6">
        <div className="flex items-center gap-2">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Add a to-do… e.g. Finish problem set 2"
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <button type="submit" disabled={!draft.title.trim() || adding}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground">
            {KINDS.map((k) => <option key={k} value={k}>{TODO_KIND_LABEL[k]}</option>)}
          </select>
          <input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground" aria-label="Due date" />
          {classes.length > 0 && (
            <select value={draft.class_id} onChange={(e) => setDraft({ ...draft, class_id: e.target.value })} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground">
              <option value="">No class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </form>

      {loaded && open.length === 0 && done.length === 0 && (
        <EmptyState icon={ListChecks} title="Nothing to do yet" description="Record a lecture and the tasks your professor assigns land here on their own. Or add one above." action={undefined} />
      )}

      {groups.map((g) => (
        <Widget key={g.key} icon={g.key === 'today' ? CalendarDays : ListChecks} title={g.title} meta={`${g.items.length} item${g.items.length === 1 ? '' : 's'}`} className="mb-4" padded>
          <ul className="pt-1 divide-y divide-border">
            {g.items.map((t) => (
              <TodoRow key={t.id} todo={t} cls={classById.get(t.class_id)} lecture={lectureById.get(t.lecture_id)} tone={g.tone} today={today}
                onToggle={() => toggle(t)} onRemove={() => remove(t.id)} onUpdate={(patch) => update(t.id, patch)} />
            ))}
          </ul>
        </Widget>
      ))}

      {done.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}
            className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground py-2">
            <span>{done.length} done</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-standard ${showDone ? 'rotate-180' : ''}`} />
          </button>
          {showDone && (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              {done.map((t) => (
                <TodoRow key={t.id} todo={t} cls={classById.get(t.class_id)} lecture={lectureById.get(t.lecture_id)} today={today}
                  onToggle={() => toggle(t)} onRemove={() => remove(t.id)} onUpdate={(patch) => update(t.id, patch)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TodoRow({ todo, cls, lecture, tone = '', today, onToggle, onRemove, onUpdate }) {
  const [editingDate, setEditingDate] = useState(false);
  const overdue = !todo.done && todo.due_date && todo.due_date < today;
  return (
    <li className={`group flex items-start gap-3 py-2.5 ${todo.done ? 'opacity-60' : ''}`}>
      <button type="button" role="checkbox" aria-checked={todo.done} onClick={onToggle}
        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${todo.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary'}`}>
        {todo.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-foreground ${todo.done ? 'line-through' : ''}`}>{todo.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold uppercase tracking-wide">{TODO_KIND_LABEL[todo.kind] || 'Task'}</span>
          {cls && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: classColor(cls.color) }} />{cls.name}</span>}
          {lecture && (
            <Link to={`/lectures/${lecture.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Mic className="w-3 h-3" /> {lecture.ai_title || `Lecture ${lecture.date}`}
            </Link>
          )}
          {todo.detail && <span>{todo.detail}</span>}
          {editingDate ? (
            <input type="date" autoFocus defaultValue={todo.due_date || ''} onBlur={(e) => { setEditingDate(false); if ((e.target.value || null) !== (todo.due_date || null)) onUpdate({ due_date: e.target.value || null }); }}
              className="rounded border border-input bg-background px-1.5 py-0.5 text-[11px]" />
          ) : (
            <button type="button" onClick={() => setEditingDate(true)} className={`inline-flex items-center gap-1 hover:text-foreground ${overdue ? 'text-rose-600 font-medium' : tone}`}>
              <CalendarDays className="w-3 h-3" /> {todo.due_date ? formatDue(todo.due_date, today) : 'Set a date'}
            </button>
          )}
        </div>
      </div>
      <button type="button" onClick={onRemove} aria-label="Delete to-do"
        className="reveal-on-hover opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity mt-0.5">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function formatDue(date, today) {
  if (date === today) return 'Today';
  const d = new Date(`${date}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
