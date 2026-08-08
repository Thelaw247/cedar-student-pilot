import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Clock, TrendingUp, Calendar, Brain, BarChart3, Headphones, Loader2, GraduationCap, Target, BookOpen, AlertCircle, Award, Check, X } from 'lucide-react';
import KnowledgeCoverageSection from '@/components/KnowledgeCoverageSection';
import { computeClassProficiency, pairCoverageWithLectures, aggregateProficiency } from '@/lib/conceptDecay';

export default function Analytics() {
  const [records, setRecords] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [classes, setClasses] = useState([]);
  const [lectures, setLectures] = useState([]);
  // KnowledgeCoverage is loaded here rather than inside KnowledgeCoverageSection
  // so the proficiency rings and the per-class breakdown below them are computed
  // from the exact same rows. Previously they read different data sources, which
  // is how the ring could show 100% while the class below it read 15%.
  const [coverage, setCoverage] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [recs, revs] = await Promise.all([
        base44.entities.StudyRecord.list('-date', 200),
        base44.entities.StudySessionReview.list('-created_date', 100),
      ]);
      setRecords(recs);
      setReviews(revs);
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        const allLectures = [];
        const allCoverage = [];
        for (const c of cls) {
          const [lecs, cov] = await Promise.all([
            base44.entities.Lecture.filter({ class_id: c.id }),
            base44.entities.KnowledgeCoverage.filter({ class_id: c.id }),
          ]);
          allLectures.push(...lecs);
          allCoverage.push(...cov);
        }
        setLectures(allLectures);
        setCoverage(allCoverage);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  // Which class the Knowledge & Proficiency section is scoped to.
  // null = all classes (aggregate across every review session).
  const [selectedClassId, setSelectedClassId] = useState(null);

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

  const attendedLectures = lectures.filter(l => !l.is_missed).length;
  const missedLectures = lectures.filter(l => l.is_missed).length;
  const attendanceRate = lectures.length > 0 ? Math.round((attendedLectures / lectures.length) * 100) : 0;

  // Calculate totals
  const todayStr = new Date().toLocaleDateString('en-CA');
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toLocaleDateString('en-CA');

  const todaySeconds = records.filter(r => r.date === todayStr).reduce((s, r) => s + r.duration_seconds, 0);
  const weekSeconds = records.filter(r => r.date >= weekAgoStr).reduce((s, r) => s + r.duration_seconds, 0);
  const totalSeconds = records.reduce((s, r) => s + r.duration_seconds, 0);

  // Bar chart data (last 7 days)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA');
    const seconds = records.filter(r => r.date === dateStr).reduce((s, r) => s + r.duration_seconds, 0);
    days.push({
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: Math.round(seconds / 60),
      isToday: dateStr === todayStr,
    });
  }

  // Streak calculation
  let streak = 0;
  const sortedDates = [...new Set(records.map(r => r.date))].sort().reverse();
  if (sortedDates.length > 0) {
    const today = new Date();
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date();
      expected.setDate(today.getDate() - i);
      if (sortedDates[i] === expected.toLocaleDateString('en-CA')) streak++;
      else break;
    }
  }

  // Goal achievements
  const goalMet = records.filter(r => r.duration_seconds >= (r.goal_minutes || 90) * 60).length;

  // Review-based analytics. Scores are meant to be 0-100; clamp defensively so
  // a bad/out-of-range record can never render an impossible value (e.g. a ring
  // showing 100% while individual reviews read 67 and 15).
  const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

  // Every class the student added is selectable, whether or not it has data
  // yet — a class with nothing recorded shows an honest empty state rather
  // than being silently missing from the filter.
  const effectiveClassId = selectedClassId && classes.some(c => c.id === selectedClassId)
    ? selectedClassId
    : null;

  const lecturesByClass = useMemo(() => {
    const map = {};
    for (const l of lectures) {
      (map[l.class_id] = map[l.class_id] || []).push(l);
    }
    return map;
  }, [lectures]);

  // Decay-aware proficiency per class — the SAME computation the per-class
  // breakdown below uses, so the ring and the list can never disagree.
  // `null` means the class has no knowledge-coverage data at all.
  const proficiencyByClass = useMemo(() => {
    const out = {};
    for (const c of classes) {
      const rows = coverage.filter(k => k.class_id === c.id);
      if (rows.length === 0) { out[c.id] = null; continue; }
      const classLectures = lecturesByClass[c.id] || [];
      const result = computeClassProficiency(pairCoverageWithLectures(rows, classLectures), classLectures);
      out[c.id] = {
        ...result,
        conceptsSeen: new Set(rows.flatMap(r => r.concepts_seen || [])).size,
      };
    }
    return out;
  }, [classes, coverage, lecturesByClass]);

  // Scope the review set to the selected class (or all reviews when aggregate).
  const scopedReviews = effectiveClassId
    ? reviews.filter(r => r.class_id === effectiveClassId)
    : reviews;

  const latestReviews = scopedReviews.slice(0, 50);

  // Proficiency = retained knowledge, decayed by how long ago it was reviewed.
  // Sourced from KnowledgeCoverage, NOT from the raw StudySessionReview score,
  // which is a snapshot of how one sitting went and never ages.
  const scopedClassIds = effectiveClassId ? [effectiveClassId] : classes.map(c => c.id);
  const avgProficiency = aggregateProficiency(scopedClassIds.map(id => proficiencyByClass[id]));

  const avgInDepth = latestReviews.length > 0
    ? clampPct(latestReviews.reduce((s, r) => s + clampPct(r.in_depth_score), 0) / latestReviews.length)
    : null;

  // Course coverage: average the most recent review of each class in scope.
  // Taking a single global latest review meant one arbitrary class's number was
  // presented as the overall figure.
  const latestCoverage = useMemo(() => {
    const perClassLatest = [];
    for (const id of scopedClassIds) {
      // reviews arrive newest-first, so the first match is that class's latest.
      const latest = reviews.find(r => r.class_id === id);
      if (latest) perClassLatest.push(clampPct(latest.coverage_percentage));
    }
    if (perClassLatest.length === 0) return null;
    return clampPct(perClassLatest.reduce((s, v) => s + v, 0) / perClassLatest.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, effectiveClassId, classes]);

  // Does the current scope have anything at all to show?
  const hasAnyData = avgProficiency !== null || latestReviews.length > 0;

  // Overall knowledge growth data (cumulative coverage over reviews)
  const growthData = [...latestReviews].reverse().map((r, idx) => ({
    session: idx + 1,
    coverage: clampPct(r.coverage_percentage),
    proficiency: clampPct(r.proficiency_score),
  }));

  const selectedClass = effectiveClassId ? classMap[effectiveClassId] : null;
  const scopeLabel = selectedClass ? selectedClass.name : 'All classes';

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  if (records.length === 0 && reviews.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <h1 className="font-heading text-xl sm:text-2xl font-bold mb-2">Analytics</h1>
        <p className="text-sm text-muted-foreground mb-8">Track your study time, knowledge coverage, and proficiency.</p>
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-1">No study sessions recorded yet.</p>
          <p className="text-xs text-muted-foreground">Start a focus session to see your analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <h1 className="font-heading text-xl sm:text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm text-muted-foreground mb-8">Track your study time, knowledge coverage, and proficiency.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={Clock} label="Today" value={formatDuration(todaySeconds)} color="text-primary" />
        <StatCard icon={TrendingUp} label="This Week" value={formatDuration(weekSeconds)} color="text-emerald-600" />
        <StatCard icon={BarChart3} label="All Time" value={formatDuration(totalSeconds)} color="text-amber-600" />
      </div>

      {/* Streak & goals */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Current Streak</span>
          </div>
          <p className="font-heading text-2xl font-bold">{streak} {streak === 1 ? 'day' : 'days'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-muted-foreground">Goals Met</span>
          </div>
          <p className="font-heading text-2xl font-bold">{goalMet}</p>
        </div>
      </div>

      {/* Lecture Attendance */}
      {lectures.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Attendance</span>
            </div>
            <p className="font-heading text-2xl font-bold">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground">{attendedLectures}/{lectures.length} lectures</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">Attended</span>
            </div>
            <p className="font-heading text-2xl font-bold">{attendedLectures}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <X className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-medium text-muted-foreground">Missed</span>
            </div>
            <p className="font-heading text-2xl font-bold">{missedLectures}</p>
          </div>
        </div>
      )}

      {/* Knowledge & Proficiency Section. Shown when there is either review
          data or knowledge-coverage data — a class can have real proficiency
          from lecture reviews without ever having a StudySessionReview. */}
      {(reviews.length > 0 || coverage.length > 0) && (
        <>
          <div className="flex items-center gap-2 mb-3 mt-8">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">Knowledge & Proficiency</h2>
          </div>

          {/* Per-class filter — scope the rings and growth chart to one class,
              or view the aggregate across every class. Every class the student
              added is listed, so none is silently missing. */}
          {classes.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
              <button
                onClick={() => setSelectedClassId(null)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  effectiveClassId === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                All classes
              </button>
              {classes.map(c => {
                const active = effectiveClassId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClassId(c.id)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'text-primary-foreground border-transparent'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    }`}
                    style={active ? { backgroundColor: c.color || '#3B82F6' } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : (c.color || '#3B82F6') }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {!hasAnyData ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center mb-4">
              <Brain className="w-6 h-6 text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">No study or review data for {scopeLabel} yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Complete a review session for this class to start tracking proficiency.</p>
            </div>
          ) : (
            <>
              {/* Score cards. Proficiency is decay-adjusted retained knowledge;
                  coverage and in-depth come from review sessions, so they read
                  “—” rather than 0% when a class hasn't been reviewed yet. */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <ScoreRingCard icon={Target} label="Proficiency" value={avgProficiency} color="#3B82F6" />
                <ScoreRingCard icon={BookOpen} label="Course Coverage" value={latestCoverage} color="#10B981" />
                <ScoreRingCard icon={Award} label="In-Depth" value={avgInDepth} color="#F59E0B" />
              </div>

              {/* Knowledge growth chart */}
              {growthData.length > 1 && (
                <div className="rounded-xl border border-border bg-card p-5 mb-4">
                  <h3 className="text-sm font-semibold mb-1">Knowledge Growth Over Sessions</h3>
                  <p className="text-xs text-muted-foreground mb-4">Coverage and proficiency across review sessions{selectedClass ? ` — ${selectedClass.name}` : ''}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={growthData}>
                      <XAxis dataKey="session" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(v, name) => [`${v}%`, name === 'coverage' ? 'Coverage' : 'Proficiency']}
                        labelFormatter={(l) => `Session ${l}`}
                      />
                      <Bar dataKey="coverage" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="proficiency" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {/* Per-class knowledge coverage — fed the same rows the rings above
              were computed from, so the numbers always agree. */}
          <KnowledgeCoverageSection
            classes={classes}
            coverage={coverage}
            lecturesByClass={lecturesByClass}
            onReload={loadAll}
          />
        </>
      )}

      {/* Weekly chart */}
      <div className="rounded-xl border border-border bg-card p-5 mb-8 mt-8">
        <h3 className="text-sm font-semibold mb-4">Last 7 Days Study Time</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={days}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(v) => [`${v} min`, 'Studied']}
            />
            <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
              {days.map((entry, i) => (
                <Cell key={i} fill={entry.isToday ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent review sessions */}
      {reviews.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3">Review Sessions</h3>
          <div className="space-y-2">
            {reviews.slice(0, 10).map(r => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {classMap[r.class_id]?.name || 'Review Session'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.review_questions?.length || 0} questions • {r.ai_interactions?.length || 0} AI interactions
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{clampPct(r.overall_score)}%</p>
                  <p className="text-[10px] text-muted-foreground">overall</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Study Sessions</h3>
        <div className="space-y-2">
          {records.slice(0, 15).map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${r.study_type === 'in_app' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                {r.study_type === 'in_app' ? <Brain className="w-4 h-4 text-primary" /> : <BookOpen className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.class_id ? (classMap[r.class_id]?.name || 'Study Session') : 'Study Session'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {r.study_mode && ` • ${r.study_mode === 'deep' ? 'Deep Study' : r.study_mode === 'sprint' ? 'Exam Sprint' : 'Lecture Review'}`}
                  {r.study_type && ` • ${r.study_type === 'in_app' ? 'In-App' : 'Manual'}`}
                </p>
                {r.lectures_covered > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {r.lectures_covered}/{r.total_lectures || r.lectures_covered} lectures covered
                    {r.quiz_score != null && ` • Quiz: ${r.quiz_score}%`}
                  </p>
                )}
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatDuration(r.duration_seconds)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className={`w-4 h-4 mb-2 ${color}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold">{value}</p>
    </div>
  );
}

function ScoreRingCard({ icon: Icon, label, value, color }) {
  // `null`/undefined means "no data", which is not the same as 0% — render an
  // empty ring and a dash so an unmeasured metric never reads as a bad score.
  const hasValue = value !== null && value !== undefined;
  const pct = hasValue ? Math.max(0, Math.min(100, Math.round(Number(value) || 0))) : 0;
  const data = [
    { name: 'Filled', value: pct, fill: color },
    { name: 'Remaining', value: 100 - pct, fill: 'hsl(var(--muted))' },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center">
      <Icon className="w-4 h-4 mb-2" style={{ color }} />
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="62%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          {hasValue
            ? <span className="font-heading text-xs font-bold" style={{ color }}>{pct}%</span>
            : <span className="font-heading text-xs font-bold text-muted-foreground">—</span>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
