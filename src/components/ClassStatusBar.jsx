import React, { useState, useEffect, useRef } from 'react';
import { useTodaySchedule } from '@/hooks/useTodaySchedule';
import { useQuickRecord } from '@/recording/useQuickRecord';
import { Mic, ChevronDown, GraduationCap, Check } from 'lucide-react';

/**
 * Persistent "what class am I in, and a Record button" widget. Mounted once
 * in Layout.jsx (mobile, sticky top of <main>) and once in Sidebar.jsx
 * (desktop) so it is reachable from every page.
 *
 * Deliberately does NOT touch recording internals; useQuickRecord starts the
 * session, so there is exactly one recorder in the app.
 *
 * The picker lists EVERY class in the semester, not just today's. Recording
 * is the thing this app exists to do, and the old version could only offer
 * classes the timetable expected today, so a rescheduled seminar, a guest
 * lecture, a make-up class, or a student who has not entered a timetable at
 * all had no way to start one from the chrome. Worse, the whole bar hid
 * itself on a day with nothing scheduled, which is exactly the day you are
 * most likely to be recording something unscheduled.
 *
 * The panel is anchored to the bar (left-0 right-0), not to the chevron.
 * Anchored to the chevron with right-0, a fixed-width panel opened leftwards
 * out of the sidebar and off the screen.
 */
export default function ClassStatusBar({ variant = 'mobile' }) {
  const { loaded, classes, todayClasses, current, next } = useTodaySchedule();
  const { startForClass, startingId, recordingActive } = useQuickRecord();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pickerOpen]);

  const startRecording = (cls) => {
    setPickerOpen(false);
    startForClass(cls);
  };

  if (!loaded || classes.length === 0) return null;

  const isDesktop = variant === 'desktop';
  const todayIds = new Set(todayClasses.map((c) => c.id));
  const scheduledToday = todayClasses.filter((c) => c.id !== current?.id);
  const everythingElse = classes.filter((c) => !todayIds.has(c.id) && c.id !== current?.id);

  // The headline earns its space: name the class when we know it, otherwise
  // invite the tap. "No more classes today" was a dead end - true, and no
  // help, on the one control whose job is to start a recording.
  const headline = current ? current.name : next ? `Next: ${next.name}` : 'Pick a class to record';

  const Item = ({ c }) => (
    <button
      role="menuitem"
      onClick={() => startRecording(c)}
      disabled={recordingActive || startingId === c.id}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <GraduationCap className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="truncate flex-1">{c.name}</span>
      {startingId === c.id && <span className="text-[10px] text-muted-foreground">Starting…</span>}
      {current?.id === c.id && <Check className="w-3.5 h-3.5 text-primary" />}
    </button>
  );

  const Group = ({ label, items }) => (items.length === 0 ? null : (
    <>
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {items.map((c) => <Item key={c.id} c={c} />)}
    </>
  ));

  return (
    <div className={isDesktop ? 'px-4 pb-3' : 'sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border lg:hidden'}>
      <div className={isDesktop ? '' : 'px-4 py-2.5'}>
        {/* relative lives here so the panel spans the bar and cannot overflow */}
        <div className="relative" ref={pickerRef}>
          <div className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${current ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
            {current && <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{headline}</p>
              {current && <p className="text-[10px] text-muted-foreground">In progress · {current.room || 'recording available'}</p>}
            </div>
            {current && !recordingActive && (
              <button
                onClick={() => startRecording(current)}
                disabled={startingId === current.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-60"
              >
                <Mic className="w-3.5 h-3.5" /> {startingId === current.id ? 'Starting…' : 'Record'}
              </button>
            )}
            <button
              onClick={() => setPickerOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              title="Record a different class"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {pickerOpen && (
            <div
              role="menu"
              className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover shadow-lg py-1.5 z-40"
            >
              {recordingActive && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border mb-1">
                  A recording is already running. Finish or discard it from the recording pill first.
                </p>
              )}
              <Group label={current ? 'Also scheduled today' : 'Today'} items={scheduledToday} />
              <Group label={scheduledToday.length ? 'Other classes' : 'Your classes'} items={everythingElse} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
