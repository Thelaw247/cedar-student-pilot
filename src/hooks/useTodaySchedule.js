import { useState, useEffect } from 'react';
import { fetchWithCache } from '@/hooks/useEntityData';
import { classMeetsOnDay, getClassTimesForDay } from '@/lib/classSchedule';
import { getCurrentClass, getNextClass } from '@/lib/currentClass';

function getDayOfWeek() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

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

  const todayClasses = classes
    .filter((c) => classMeetsOnDay(c, getDayOfWeek()))
    .map((c) => {
      const t = getClassTimesForDay(c, getDayOfWeek()) || {};
      return { ...c, start_time: t.start_time || c.start_time, end_time: t.end_time || c.end_time };
    })
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const current = getCurrentClass(todayClasses, now);
  const next = getNextClass(todayClasses, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const remaining = todayClasses.filter((c) => {
    const [eh, em] = (c.end_time || '').split(':').map(Number);
    return (eh * 60 + em) > nowMin;
  });

  return { loaded, todayClasses, current, next, remaining, now };
}
