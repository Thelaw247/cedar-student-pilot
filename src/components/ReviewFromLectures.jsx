import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CalendarDays, CalendarRange, ListChecks, ArrowRight } from 'lucide-react';
import LectureScopePicker, { resolveScopeIds } from '@/components/LectureScopePicker';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import { Lock, BookOpenCheck } from 'lucide-react';

/**
 * ReviewFromLectures — entry points for reviewing lecture content: quick
 * today / this-week reviews, plus a scoped review over any selection of a
 * class's lectures (whole class or a chosen subset) that launches the review
 * runner with those ids.
 *
 * Props:
 *   initialClassId, initialLectureIds — optional pre-scoping (from deep links)
 */
export default function ReviewFromLectures({ initialClassId = '', initialLectureIds = null }) {
  const { allowed: reviewAllowed, requiredTierName: reviewTierName, lock: reviewLock } = useFeatureGate('lecture_review');
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClassId || '');
  const [lectures, setLectures] = useState([]);
  const [scopeIds, setScopeIds] = useState(initialLectureIds && initialLectureIds.length ? initialLectureIds : []);

  const loadLectures = useCallback(async (classId) => {
    if (!classId) { setLectures([]); return; }
    const lecs = await base44.entities.Lecture.filter({ class_id: classId }, 'date');
    setLectures(lecs);
  }, []);

  const load = useCallback(async () => {
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        const target = initialClassId || (cls.length > 0 ? cls[0].id : '');
        setSelectedClass(target);
        await loadLectures(target);
      }
    } catch (e) { console.error(e); }
  }, [initialClassId, loadLectures]);

  useEffect(() => { load(); }, [load]);

  const onPickClass = async (id) => {
    setSelectedClass(id);
    setScopeIds([]);
    await loadLectures(id);
  };

  const launchScopedReview = () => {
    const ids = resolveScopeIds(scopeIds, lectures);
    if (ids === null) { alert('Select at least one lecture, or choose Select all.'); return; }
    if (ids.length === 0) {
      // Whole class = every lecture in this class.
      navigate(`/lecture-review?ids=${lectures.map(l => l.id).join(',')}`);
    } else {
      navigate(`/lecture-review?ids=${ids.join(',')}`);
    }
  };

  // Below Student: one clear locked card instead of four dead entries — the
  // value copy stays visible, and the lock is one tap from the upgrade sheet.
  if (!reviewAllowed) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <BookOpenCheck className="w-5 h-5 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">AI lecture reviews</p>
          <p className="text-[11px] text-muted-foreground">Question-by-question reviews built from your own lectures, in teaching order. Unlocks with {reviewTierName}.</p>
        </div>
        <button onClick={reviewLock}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors flex-shrink-0">
          <Lock className="w-3.5 h-3.5" /> Upgrade to use
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Review questions follow the exact teaching flow — from what the professor covered first to last.</p>

      {/* Quick reviews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Link to="/lecture-review/today"
          className="rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Review Today's Lectures</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Every lecture from today in teaching order</p>
        </Link>
        <Link to="/lecture-review/week"
          className="rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
            <CalendarRange className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Review This Week</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All lectures from the past 7 days</p>
        </Link>
      </div>

      {/* Scoped review — choose class + which lectures */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-medium text-foreground">Review specific lectures</h3>
        </div>

        {classes.length > 1 && (
          <select value={selectedClass} onChange={e => onPickClass(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mb-3">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <LectureScopePicker lectures={lectures} selectedIds={scopeIds} onChange={setScopeIds} />

        <button onClick={launchScopedReview} disabled={lectures.length === 0}
          className="mt-3 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
          Start review <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
