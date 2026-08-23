import { useState, useEffect } from 'react';
import { fetchWithCache } from '@/hooks/useEntityData';
import { classesOnDate } from '@/lib/classSchedule';
import { getCurrentClass, getNextClass } from '@/lib/currentClass';

/**
 * Today's schedule, shared by every piece of persistent chrome that needs it
 * (ClassStatusBar, DesktopRail). One fetch, one per-day enrichment pass, one
 * definition of "current"/"next" — so a compact header widget and a fuller
 * desktop panel can never quietly disagree with each other the way two
 * separately-written versions of this logic already have once in this app
 * (Home.jsx's todayClasses vs the older DailyProgressRing computation).
 */
export function useTodaySchedule() {
  const [classes, setClasses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

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

  const todayClasses = classesOnDate(classes, now);

  const current = getCurrentClass(todayClasses, now);
  const next = getNextClass(todayClasses, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const remaining = todayClasses.filter((c) => {
    const [eh, em] = (c.end_time || '').split(':').map(Number);
    return (eh * 60 + em) > nowMin;
  });

  return { loaded, todayClasses, current, next, remaining, now };
}
