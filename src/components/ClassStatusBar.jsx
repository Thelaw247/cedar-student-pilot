import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithCache } from '@/hooks/useEntityData';
import { classMeetsOnDay, getClassTimesForDay } from '@/lib/classSchedule';
import { getCurrentClass, getNextClass } from '@/lib/currentClass';
import { Mic, ChevronDown, GraduationCap, Check } from 'lucide-react';

function getDayOfWeek() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

/**
 * Persistent "what class am I in, and a Record button" widget. Mounted once
 * in Layout.jsx (mobile, sticky top of <main>) and once in Sidebar.jsx
 * (desktop) so it's reachable from every page — that's the whole point.
 *
 * Deliberately does NOT touch recording internals. Pressing Record navigates
 * to /classes/:id?record=1, which ClassDetail reads to auto-open its existing
 * RecordModal — same MediaRecorder code, same per-class consent gate, as
 * clicking Record from inside the class page itself. Duplicating that logic
 * here would be the fastest way to end up with two recorders that behave
 * differently.
 *
 * Fetches its own class/semester data via fetchWithCache, the same call every
 * other page already makes for the same entities — this normally resolves
 * from that shared cache rather than a fresh network request, so mounting it
 * globally does not meaningfully add load.
 */
export default function ClassStatusBar({ variant = 'mobile' }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const semesters = await fetchWithCache('Semester', 'filter', [{ is_active: true }]);
        if (!semesters.length) { if (!cancelled) setLoaded(true); return; }
        const cls = await fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }]);
        if (!cancelled) { setClasses(cls); setLoaded(true); }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Outside-click / escape close for the "not in this class?" picker.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pickerOpen]);

  // Same per-day enrichment Home.jsx uses — a class's time can differ by day,
  // and some classes don't meet every day at all.
  const todayClasses = classes
    .filter((c) => classMeetsOnDay(c, getDayOfWeek()))
    .map((c) => {
      const t = getClassTimesForDay(c, getDayOfWeek()) || {};
      return { ...c, start_time: t.start_time || c.start_time, end_time: t.end_time || c.end_time };
    });

  const current = getCurrentClass(todayClasses, now);
  const next = getNextClass(todayClasses, now);
  const otherToday = todayClasses.filter((c) => c.id !== current?.id);

  const startRecording = (classId) => {
    setPickerOpen(false);
    navigate(`/classes/${classId}?record=1`);
  };

  // Nothing to show: onboarding, no active semester, or a day with no classes
  // at all. Matches UpNextCard's own philosophy of collapsing rather than
  // showing an empty state no one asked for.
  if (!loaded || todayClasses.length === 0) return null;

  const isDesktop = variant === 'desktop';

  return (
    <div className={isDesktop ? 'px-4 pb-3' : 'sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border lg:hidden'}>
      <div className={isDesktop ? '' : 'px-4 py-2.5'}>
        <div className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${current ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
          {current && <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">
              {current ? current.name : next ? `Next: ${next.name}` : 'No more classes today'}
            </p>
            {current && <p className="text-[10px] text-muted-foreground">In progress · {current.room || 'recording available'}</p>}
          </div>
          {current && (
            <button
              onClick={() => startRecording(current.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              <Mic className="w-3.5 h-3.5" /> Record
            </button>
          )}
          <div className="relative flex-shrink-0" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen((v) => !v)}
              title="Not in this class? Record a different one"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {pickerOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-border bg-popover shadow-lg py-1.5 z-40">
                <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Not in this class? Record for:
                </p>
                {(current ? otherToday : todayClasses).length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No other classes today.</p>
                ) : (
                  (current ? otherToday : todayClasses).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => startRecording(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors"
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{c.name}</span>
                      {current?.id === c.id && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
