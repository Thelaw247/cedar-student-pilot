import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, BookOpen, AlertCircle, CheckCircle2, Circle, ChevronRight, ChevronDown, Brain } from 'lucide-react';
import SessionReview from '@/components/SessionReview';

export default function KnowledgeCoverageSection({ classes }) {
  const [coverage, setCoverage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState(null);
  const [reviewLecture, setReviewLecture] = useState(null);

  const reloadCoverage = async () => {
    try {
      const allCoverage = [];
      for (const c of classes) {
        const cov = await base44.entities.KnowledgeCoverage.filter({ class_id: c.id });
        allCoverage.push(...cov);
      }
      setCoverage(allCoverage);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await reloadCoverage();
      setLoading(false);
    })();
  }, [classes]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  if (coverage.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center mb-8">
        <BookOpen className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Complete a review session to see knowledge coverage breakdown.</p>
      </div>
    );
  }

  // Group by class
  const byClass = {};
  for (const c of classes) {
    byClass[c.id] = { class: c, lectures: coverage.filter(k => k.class_id === c.id) };
  }

  const classEntries = Object.values(byClass).filter(e => e.lectures.length > 0);

  return (
    <div className="space-y-2 mb-8">
      {classEntries.map(({ class: cls, lectures }) => {
        const totalSeen = [...new Set(lectures.flatMap(l => l.concepts_seen || []))].length;
        const totalMastered = [...new Set(lectures.flatMap(l => l.concepts_mastered || []))].length;
        const proficiency = totalSeen > 0 ? Math.round((totalMastered / totalSeen) * 100) : 0;
        const isExpanded = expandedClass === cls.id;

        return (
          <div key={cls.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-1 h-10 rounded-full" style={{ backgroundColor: cls.color || '#3B82F6' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cls.name}</p>
                <p className="text-xs text-muted-foreground">{totalMastered}/{totalSeen} concepts mastered</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums" style={{ color: cls.color }}>{proficiency}%</p>
                <p className="text-[10px] text-muted-foreground">proficient</p>
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-2">
                {lectures.map(l => {
                  const seen = l.concepts_seen || [];
                  const mastered = l.concepts_mastered || [];
                  const gaps = seen.filter(c => !mastered.includes(c));
                  const lecProf = seen.length > 0 ? Math.round((mastered.length / seen.length) * 100) : 0;

                  return (
                    <div key={l.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lecProf >= 70 ? '#10B981' : lecProf >= 40 ? '#F59E0B' : '#EF4444' }} />
                          <span className="text-xs font-medium">Lecture Session</span>
                          {l.last_reviewed_date && (
                            <span className="text-[10px] text-muted-foreground">• Reviewed {l.last_reviewed_date}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReviewLecture({ lecture_id: l.lecture_id, class_id: l.class_id })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                          >
                            <Brain className="w-3 h-3" /> Review
                          </button>
                          <span className="text-xs font-bold tabular-nums">{lecProf}%</span>
                        </div>
                      </div>

                      {/* Concepts */}
                      <div className="flex flex-wrap gap-1.5">
                        {seen.map(concept => {
                          const isMastered = mastered.includes(concept);
                          return (
                            <span key={concept}
                              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md ${
                                isMastered
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              }`}>
                              {isMastered ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                              {concept}
                            </span>
                          );
                        })}
                        {seen.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">No concepts tracked yet</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${lecProf}%`, backgroundColor: lecProf >= 70 ? '#10B981' : lecProf >= 40 ? '#F59E0B' : '#EF4444' }} />
                      </div>

                      {gaps.length > 0 && (
                        <p className="text-[10px] text-rose-600 mt-2">
                          {gaps.length} concept{gaps.length !== 1 ? 's' : ''} need review
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {reviewLecture && (
        <SessionReview
          classId={reviewLecture.class_id}
          lectureId={reviewLecture.lecture_id}
          className={classes.find(c => c.id === reviewLecture.class_id)?.name}
          onClose={() => { setReviewLecture(null); reloadCoverage(); }}
        />
      )}
    </div>
  );
}