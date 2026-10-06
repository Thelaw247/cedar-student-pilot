import React, { useEffect, useMemo, useState } from 'react';
import { lectureTitle } from '@/lib/lectureTitle';
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
 *
 * What changed on 6 Oct 2026, and why:
 *   - The header no longer wraps its sentence into a twelve-character column
 *     beside the filter; the filter sits on its own line on a phone.
 *   - A line of progress ("1 of 3 done") once anything is done. Never a 0%
 *     bar: a list that is all still to do shows the list, not a reproach.
 *   - The add row is one input and one button. The date is a tap (Today,
 *     Tomorrow) rather than a mm/dd/yyyy box, with a real picker a tap
 *     further; the class is seeded from the filter in use.
 *   - The kind is shown only when it says something ("Reading", "Submit"),
 *     in sentence case; "TASK" in caps on every row said nothing six times.
 *   - A row in the Today group does not repeat "Today".
 */
const KINDS = ['task', 'read', 'practice', 'submit', 'review', 'prepare'];

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Todos() {
  const { todos, loaded, toggle, create, update, remove } = useTodos();
  const [classes, setClasses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
  // class_id null means "not chosen by hand", so the filter can decide it.
  const [draft, setDraft] = useState({ title: '', kind: 'task', due_date: '', class_id: null });
  // 'none' | 'today' | 'tomorrow' | 'pick': which date control is chosen.
  const [dueMode, setDueMode] = useState('none');
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
  const weekEnd = useMemo(() => addDays(today, 7), [today]);

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

  // The due date the draft resolves to. "Pick a date" uses the box's value.
  const draftDue = dueMode === 'today' ? today : dueMode === 'tomorrow' ? addDays(today, 1) : dueMode === 'pick' ? draft.due_date : '';
  // The class a new to-do gets: the one chosen in the row, else the one the
  // list is filtered to. A student looking at one class is adding to it.
  const draftClass = draft.class_id != null ? draft.class_id : (classFilter !== 'all' ? classFilter : '');

  const add = async (e) => {
    e.preventDefault();
    if (!draft.title.trim() || adding) return;
    setAdding(true);
    try {
      await create({
        title: draft.title.trim(), kind: draft.kind, source: 'manual',
        due_date: draftDue || null, class_id: draftClass || null,
      });
      setDraft((d) => ({ ...d, title: '' }));
    } catch { /* hook rolled back; keep the draft */ }
    setAdding(false);
  };

  const total = open.length + done.length;
  const overdueCount = open.filter((t) => t.due_date && t.due_date < today).length;
  // Open, overdue, done: the three numbers a student scans for, in that
  // order. Overdue is named because a late task a student has not noticed
  // is worse than one they have.
  const summary = total === 0
    ? 'Tasks your professors assign in lectures land here on their own.'
    : `${open.length} open${overdueCount ? ` · ${overdueCount} overdue` : ''}${done.length ? ` · ${done.length} done` : ''}`;

  const selectClass = 'rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground min-h-[36px]';
  const chipClass = (on) => `px-2.5 min-h-[36px] rounded-lg text-xs font-medium transition-colors duration-micro ${on ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold text-foreground">To-do</h1>
            <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">{summary}</p>
          </div>
          {classes.length > 1 && (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class" className={selectClass}>
                <option value="all">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {/* Progress, once there is some: the bar's length is the thing read
            at a glance, and a list half done pulls harder than one untouched. */}
        {done.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar"
              aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length} aria-label={`${done.length} of ${total} done`}>
              <span className="block h-full rounded-full bg-primary transition-all duration-standard ease-standard" style={{ width: `${Math.round((done.length / total) * 100)}%` }} />
            </span>
            <span className="text-xs font-medium text-foreground tabular-nums flex-shrink-0">
              {done.length === total ? 'All done' : `${done.length} of ${total} done`}
            </span>
          </div>
        )}
      </div>

      {/* Add */}
      <form onSubmit={add} className="rounded-xl border border-border bg-card shadow-1 p-3 mb-6">
        <div className="flex items-center gap-2">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="New to-do" placeholder="Add a to-do, like: finish problem set 2"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <button type="submit" disabled={!draft.title.trim() || adding}
            className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-micro disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {/* The date first, as a tap: most to-dos are for today or tomorrow,
            and a date box asks eight keystrokes for either. Kind and class
            share the next line. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2">
          <div role="radiogroup" aria-label="Due" className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
            {[['none', 'No date'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['pick', 'Pick a date']].map(([mode, label]) => (
              <button key={mode} type="button" role="radio" aria-checked={dueMode === mode} onClick={() => setDueMode(mode)} className={chipClass(dueMode === mode)}>
                {label}
              </button>
            ))}
          </div>
          {dueMode === 'pick' && (
            <input type="date" autoFocus value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} className={selectClass} aria-label="Due date" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1.5">
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} aria-label="To-do type" className={selectClass}>
            {KINDS.map((k) => <option key={k} value={k}>{TODO_KIND_LABEL[k]}</option>)}
          </select>
          {classes.length > 0 && (
            <select value={draftClass} onChange={(e) => setDraft({ ...draft, class_id: e.target.value })} aria-label="Class" className={selectClass}>
              <option value="">No class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </form>

      {loaded && open.length === 0 && done.length === 0 && (
        <EmptyState icon={ListChecks} title="Nothing to do yet" description="Record a lecture and the tasks your professor assigns land here on their own. Or add one above." action={undefined} />
      )}

      {loaded && open.length === 0 && done.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-5 text-center mb-4">
          <p className="text-sm font-medium text-foreground">Nothing open{classFilter !== 'all' ? ' in this class' : ''}.</p>
          <p className="text-xs text-muted-foreground mt-1">{done.length} done. Add the next thing above, or record a lecture and let it add its own.</p>
        </div>
      )}

      {groups.map((g) => (
        <Widget key={g.key} icon={g.key === 'today' ? CalendarDays : ListChecks} title={g.title} meta={`${g.items.length} item${g.items.length === 1 ? '' : 's'}`} className="mb-4" padded>
          <ul className="pt-1 divide-y divide-border">
            {g.items.map((t) => (
              <TodoRow key={t.id} todo={t} cls={classById.get(t.class_id)} lecture={lectureById.get(t.lecture_id)} tone={g.tone} today={today}
                hideDate={g.key === 'today'}
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

function TodoRow({ todo, cls, lecture, tone = '', today, hideDate = false, onToggle, onRemove, onUpdate }) {
  const [editingDate, setEditingDate] = useState(false);
  const overdue = !todo.done && todo.due_date && todo.due_date < today;
  const kindLabel = todo.kind && todo.kind !== 'task' ? TODO_KIND_LABEL[todo.kind] : null;
  return (
    <li className={`group flex items-start gap-3 py-2.5 ${todo.done ? 'opacity-60' : ''}`}>
      <button type="button" role="checkbox" aria-checked={todo.done} aria-label={`Mark "${todo.title}" done`} onClick={onToggle}
        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-micro ${todo.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background hover:border-primary'}`}>
        {todo.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-foreground ${todo.done ? 'line-through' : ''}`}>{todo.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
          {kindLabel && <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-medium text-foreground/80">{kindLabel}</span>}
          {cls && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: classColor(cls.color) }} />{cls.name}</span>}
          {lecture && (
            <Link to={`/lectures/${lecture.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Mic className="w-3 h-3" /> {lectureTitle(lecture)}
            </Link>
          )}
          {todo.detail && <span>{todo.detail}</span>}
          {editingDate ? (
            <input type="date" autoFocus aria-label="Due date" defaultValue={todo.due_date || ''} onBlur={(e) => { setEditingDate(false); if ((e.target.value || null) !== (todo.due_date || null)) onUpdate({ due_date: e.target.value || null }); }}
              className="rounded border border-input bg-background px-1.5 py-0.5 text-[11px]" />
          ) : (!hideDate || !todo.due_date) && (
            <button type="button" onClick={() => setEditingDate(true)} className={`inline-flex items-center gap-1 min-h-[28px] hover:text-foreground ${overdue ? 'text-rose-600 font-medium' : tone}`}>
              <CalendarDays className="w-3 h-3" /> {todo.due_date ? formatDue(todo.due_date, today) : 'Set a date'}
            </button>
          )}
        </div>
      </div>
      <button type="button" onClick={onRemove} aria-label="Delete to-do"
        className="reveal-on-hover opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity mt-0.5 p-2 -m-2">
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
