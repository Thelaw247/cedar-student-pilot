import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, BookOpen, FileText, List, AlertCircle, Clipboard } from 'lucide-react';

export default function ManualStudyGuide({ classId, studyMode, lectureIds, assignmentId, onClose, onLoad }) {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const params = { class_id: classId };
        if (lectureIds && lectureIds.length > 0) params.lecture_ids = lectureIds;
        if (assignmentId) params.assignment_id = assignmentId;
        const res = await base44.functions.invoke('generateClassHandbook', params);
        if (res.data?.error) throw new Error(res.data.error);
        setGuide(res.data);
        if (onLoad && res.data.chapters) onLoad(res.data.chapters.length);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    };
    load();
  }, [classId, studyMode]);

  const modeTitle = {
    deep: 'Deep Study Guide',
    sprint: 'Exam Sprint Study Guide',
    review: 'Lecture Review Guide',
  }[studyMode] || 'Study Guide';

  const modeDesc = {
    deep: 'All class material compiled for comprehensive review. Work through each topic systematically.',
    sprint: 'Focus on the topics most likely to appear on your exam. Review in priority order.',
    review: 'Selected lecture material to review. Follow the chronological teaching flow.',
  }[studyMode] || 'Study guide for your session.';

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-1">Building Your Study Guide</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">Compiling material for your manual study session...</p>
      </div>
    );
  }

  if (error || !guide || guide.chapters?.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <BookOpen className="w-10 h-10 text-muted-foreground mb-4" strokeWidth={1.5} />
        <h3 className="font-heading text-lg font-semibold mb-1">No Study Material Available</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">{error || guide?.message || 'Record and process lectures first.'}</p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Close</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Clipboard className="w-3.5 h-3.5" /> Print
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-8 pb-6 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{modeTitle}</p>
          <h1 className="font-heading text-2xl font-bold mb-1" style={{ color: guide.class_color }}>{guide.title}</h1>
          {guide.instructor && <p className="text-sm text-muted-foreground">by Prof. {guide.instructor}</p>}
          <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">{modeDesc}</p>
        </div>

        {/* Study timeline */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <List className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Study Timeline ({guide.chapters.length} topics)</h3>
          </div>
          <div className="space-y-2">
            {guide.chapters.map((ch, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{ch.title}</p>
                  <p className="text-xs text-muted-foreground">{ch.lecture_date} • {ch.concepts?.length || 0} concepts</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full material */}
        <div className="space-y-6 mb-6">
          {guide.chapters.map((ch, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Topic {i + 1}</p>
              <h3 className="font-heading text-lg font-bold mb-1">{ch.title}</h3>
              <p className="text-xs text-muted-foreground mb-4">{ch.lecture_date}</p>

              {ch.summary && <p className="text-sm text-foreground leading-relaxed mb-4">{ch.summary}</p>}

              {ch.concepts?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Concepts to Review</p>
                  <ul className="space-y-1">
                    {ch.concepts.map((c, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ch.definitions?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Definitions</p>
                  <div className="space-y-1.5">
                    {ch.definitions.map((d, j) => (
                      <div key={j} className="text-sm">
                        <span className="font-medium text-foreground">{d.term}</span>
                        <span className="text-muted-foreground"> — {d.definition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ch.formulas?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Formulas</p>
                  <div className="space-y-1.5">
                    {ch.formulas.map((f, j) => (
                      <div key={j} className="px-3 py-2 rounded-lg bg-muted font-mono text-sm">{f}</div>
                    ))}
                  </div>
                </div>
              )}

              {ch.exam_mentions?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">⚠ Exam Mentions</p>
                  <ul className="space-y-1">
                    {ch.exam_mentions.map((m, j) => (
                      <li key={j} className="text-xs text-amber-700 dark:text-amber-500">{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          Done — Back to Timer
        </button>
      </div>
    </div>
  );
}