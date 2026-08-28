import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import { GraduationCap, Check, X, Loader2, Clock } from 'lucide-react';
import { getClassMeetingsForDate } from '@/lib/classSchedule';
import { classTint, classColor } from '@/lib/color';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Find recent past class session dates (up to 3 days back) where:
 * - The class was scheduled on that day
 * - The class end time has passed
 * Returns array of { classObj, date }
 */
function findPastUnconfirmedSessions(classes, lectures, attendance) {
  const now = new Date();
  const results = [];

  // Build lookup sets
  const lectureKeys = new Set();
  for (const l of lectures) {
    if (l.class_id && l.date) {
      lectureKeys.add(`${l.class_id}|${l.date}`);
    }
  }
  const attendanceKeys = new Set();
  for (const a of attendance) {
    if (a.class_id && a.date) {
      attendanceKeys.add(`${a.class_id}|${a.date}`);
    }
  }

  // Check the last 3 days (including today if class time has passed)
  for (let i = 1; i <= 3; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    for (const cls of classes) {
      const meetings = getClassMeetingsForDate(cls, dateStr);
      if (meetings.length === 0) continue;

      // For yesterday and earlier, the class has definitely ended
      const key = `${cls.id}|${dateStr}`;
      if (!lectureKeys.has(key) && !attendanceKeys.has(key)) {
        results.push({ classObj: { ...cls, start_time: meetings[0].start_time || cls.start_time }, date: dateStr });
      }
    }
  }

  // Also check today if class end time has passed
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const cls of classes) {
    const meetings = getClassMeetingsForDate(cls, todayStr);
    if (meetings.length === 0) continue;

    const latestEnd = meetings.map(m => m.end_time || cls.end_time || '').sort().at(-1);
    if (latestEnd) {
      const [h, m] = latestEnd.split(':').map(Number);
      if (nowMinutes <= h * 60 + m) continue;
    }

    const key = `${cls.id}|${todayStr}`;
    if (!lectureKeys.has(key) && !attendanceKeys.has(key)) {
      results.push({ classObj: { ...cls, start_time: meetings[0].start_time || cls.start_time }, date: todayStr });
    }
  }

  // Sort newest first
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

export default function AttendancePrompt() {
  const [pending, setPending] = useState([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const loadPending = useCallback(async () => {
    try {
      const semesters = await fetchWithCache('Semester', 'filter', [{ is_active: true }]);
      if (semesters.length === 0) return;

      const classes = await fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }]);
      if (classes.length === 0) return;

      // Fetch lectures and attendance for these classes
      const [allLectures, allAttendance] = await Promise.all([
        base44.entities.Lecture.list('-date', 200),
        base44.entities.ClassAttendance.list('-date', 200),
      ]);

      const sessions = findPastUnconfirmedSessions(classes, allLectures, allAttendance);
      setPending(sessions);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const current = pending[index];

  const handleResponse = async (attended) => {
    if (!current) return;
    setSubmitting(true);
    try {
      await base44.entities.ClassAttendance.create({
        class_id: current.classObj.id,
        date: current.date,
        attended,
        confirmed_at: new Date().toISOString(),
      });

      // If attended but didn't record, generate an AI-estimated summary
      if (attended) {
        try {
          await base44.functions.invoke('generateMissedLectureSummary', {
            class_id: current.classObj.id,
            date: current.date,
          });
        } catch (e) {
          console.error(e);
        }
      }

      setIndex(i => i + 1);
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleDismissAll = () => {
    setDismissed(true);
  };

  if (dismissed || !current) return null;

  const remaining = pending.length - index;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 glass p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl border border-border p-6 animate-fade-in text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: classTint(current.classObj.color) || 'hsl(var(--primary) / 0.1)', color: classColor(current.classObj.color) }}>
          <GraduationCap className="w-7 h-7" strokeWidth={1.5} />
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Attendance Check
        </p>
        <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
          {current.classObj.name}
        </h3>
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5" /> {formatDate(current.date)}
          {current.classObj.start_time && <span>• {current.classObj.start_time}</span>}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          You didn't check in for this class. Did you attend?
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => handleResponse(false)}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" /> No
          </button>
          <button
            onClick={() => handleResponse(true)}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Yes
          </button>
        </div>

        {remaining > 1 && (
          <button onClick={handleDismissAll}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {remaining - 1} more pending — dismiss all
          </button>
        )}
      </div>
    </div>
  );
}
