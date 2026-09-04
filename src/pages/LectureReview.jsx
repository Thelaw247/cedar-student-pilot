import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Loader2, Check, ListChecks, ArrowRight, RotateCcw, Lock, BookOpen } from 'lucide-react';
import { useUpgrade } from '@/components/monetization/UpgradeContext';
import { featureMinTierName } from '@/lib/tiers';
import QuizReview, { ChoiceOptions, scoreQuiz } from '@/components/quiz/QuizReview';
import ReviewModeChooser from '@/components/ReviewModeChooser';
import HandbookReader from '@/components/HandbookReader';

// The student's local calendar day. Lectures carry the local date they were
// recorded on, so a UTC day would drop an evening lecture the moment UTC
// rolls past midnight. Shared by the quiz payload and the handbook scope so
// the two can never disagree about what "this week" means.
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function LectureReview() {
  const { openUpgrade } = useUpgrade();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = params.scope || 'today';
  const lectureId = params.lectureId;
  // An arbitrary set of lectures can be passed as ?ids=a,b,c (from the scope
  // picker). Takes precedence over scope/single-lecture.
  const idsParam = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  // Quiz or handbook. Absent means the student has not been asked yet; the
  // answer lives in the URL so it survives a reload and can be deep-linked.
  const mode = searchParams.get('mode');
  const chooseMode = (next) => {
    const sp = new URLSearchParams(searchParams);
    if (next) sp.set('mode', next); else sp.delete('mode');
    setSearchParams(sp, { replace: true });
  };

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);

  // Every question is multiple choice and graded locally (see
  // server/lib/quizQuestions.js) — there is no written-answer grading step.
  const finishReview = () => setShowResult(true);

  useEffect(() => {
    // Nothing is generated — and nothing is charged — until the student has
    // said which kind of review they want.
    if (mode !== 'quiz') { setLoading(false); return; }
    const run = async () => {
      setLoading(true);
      try {
        let payload = {};
        if (idsParam.length > 0) {
          payload = { lecture_ids: idsParam };
        } else if (lectureId) {
          payload = { lecture_ids: [lectureId] };
        } else {
          // Send the student's LOCAL calendar day so "today"/"this week" match
          // the dates lectures were recorded on, rather than the server's UTC
          // day (which rolls over an evening lecture into "yesterday").
          payload = { scope, local_date: localDay() };
        }
        const res = await base44.functions.invoke('generateLectureReview', payload);
        setData(res.data);
      } catch (e) {
        // A 402 isn't a failure — it's the tier gate. Show the lock, never
        // a dead-end error (law: the paywall is never an error message).
        if (e?.response?.status === 402) {
          setData({ locked: true, message: e?.response?.data?.message });
        } else {
          setData({ error: e?.response?.data?.error === 'insufficient_credits' ? (e?.response?.data?.message || 'Not enough credits for this review.') : 'Could not generate the review. Check your connection and try again.' });
        }
      }
      setLoading(false);
    };
    run();
  }, [mode, scope, lectureId, searchParams.get('ids')]);

  // --- Handbook branch -----------------------------------------------------
  // A handbook is built per class (generateClassHandbook takes a class_id), so
  // a scope spanning several classes cannot open one handbook. Resolve which
  // classes the scope actually covers, then open straight into it when there
  // is only one and ask which otherwise.
  const [hbClasses, setHbClasses] = useState(null);
  const [hbPick, setHbPick] = useState(null);
  const [hbError, setHbError] = useState(null);

  const resolveHandbookScope = useCallback(async () => {
    try {
      let lecs;
      if (idsParam.length > 0) lecs = await Promise.all(idsParam.map((id) => base44.entities.Lecture.get(id)));
      else if (lectureId) lecs = [await base44.entities.Lecture.get(lectureId)];
      else {
        const today = localDay();
        const from = scope === 'week' ? localDay(new Date(Date.now() - 7 * 86400000)) : today;
        const recent = await base44.entities.Lecture.list('-date', 200);
        lecs = recent.filter((l) => l.date && l.date >= from && l.date <= today);
      }
      const byClass = new Map();
      for (const l of lecs.filter(Boolean)) {
        if (!l.class_id) continue;
        if (!byClass.has(l.class_id)) byClass.set(l.class_id, []);
        byClass.get(l.class_id).push(l.id);
      }
      const resolved = await Promise.all([...byClass.entries()].map(async ([classId, lectureIds]) => {
        let name = 'This class';
        try { name = (await base44.entities.Class.get(classId))?.name || name; } catch { /* a deleted class keeps the fallback */ }
        return { classId, name, lectureIds };
      }));
      setHbClasses(resolved);
      if (resolved.length === 1) setHbPick(resolved[0]);
    } catch (e) {
      console.error(e);
      setHbError('Could not work out which lectures to build the handbook from.');
    }
  }, [idsParam.join(','), lectureId, scope]);

  useEffect(() => {
    if (mode === 'handbook' && hbClasses === null && !hbError) resolveHandbookScope();
  }, [mode, hbClasses, hbError, resolveHandbookScope]);

  if (!mode) {
    const windowLabel = idsParam.length > 0 || lectureId
      ? `${idsParam.length > 1 ? `${idsParam.length} lectures` : 'This lecture'}`
      : scope === 'week' ? 'Your lectures from the past 7 days' : "Today's lectures";
    return <ReviewModeChooser subtitle={windowLabel} onSelect={chooseMode} />;
  }

  if (mode === 'handbook') {
    if (hbError) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <p className="text-sm text-destructive">{hbError}</p>
          <Link to="/planner" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Back to Study</Link>
        </div>
      );
    }
    if (hbPick) {
      return (
        <HandbookReader
          classId={hbPick.classId}
          lectureIds={hbPick.lectureIds}
          onClose={() => navigate('/planner')}
        />
      );
    }
    if (hbClasses === null) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Working out which lectures to include...</p>
        </div>
      );
    }
    if (hbClasses.length === 0) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No processed lectures in this window yet.</p>
          <Link to="/planner" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Back to Study</Link>
        </div>
      );
    }
    // More than one class in scope: a handbook belongs to a class, so ask.
    return (
      <div className="max-w-md mx-auto px-4 py-10 animate-fade-in">
        <button type="button" onClick={() => { setHbClasses(null); setHbPick(null); chooseMode(''); }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="font-heading text-xl font-bold text-foreground mb-1">Which class?</h1>
        <p className="text-sm text-muted-foreground mb-6">A handbook covers one class at a time. These have lectures in this window.</p>
        <div className="space-y-2">
          {hbClasses.map((c) => (
            <button key={c.classId} type="button" onClick={() => setHbPick(c)}
              className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:shadow-2 transition-all duration-micro flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">{c.name}</span>
                <span className="block text-xs text-muted-foreground">{c.lectureIds.length} lecture{c.lectureIds.length !== 1 ? 's' : ''}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Generating review questions following your professor's teaching flow...</p>
      </div>
    );
  }

  if (data?.locked) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="font-heading text-xl font-bold text-foreground mb-2">AI lecture reviews</h1>
        <p className="text-sm text-muted-foreground mb-1">
          Question-by-question reviews built from your own lectures, in your professor&rsquo;s teaching order.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Unlocks with the {featureMinTierName('lecture_review')} plan. {data.message || ''}
        </p>
        <button type="button" onClick={() => openUpgrade({ source: 'feature-lock', feature: 'lecture_review' })}
          className="w-full py-3 rounded-button bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-micro">
          See plans
        </button>
        <Link to="/planner" className="text-sm text-muted-foreground hover:text-foreground mt-3 inline-block">Back to Study</Link>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-destructive">{data.error}</p>
        <Link to="/planner" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Back to Study</Link>
      </div>
    );
  }

  if (!data?.review_questions?.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <ListChecks className="w-10 h-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">{data?.message || 'No lecture content available for review yet.'}</p>
        <Link to="/planner" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Back to Study</Link>
      </div>
    );
  }

  const questions = data.review_questions;
  const teachingFlow = data.teaching_flow || [];
  const current = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  const { correct: score, pct } = scoreQuiz(questions, answers);

  // Results screen
  if (showResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-primary" strokeWidth={2} />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-1">Review Complete</h1>
          <p className="text-muted-foreground text-sm">You answered {score} out of {questions.length} correctly</p>
          <p className="text-2xl font-bold text-primary mt-2">{pct}%</p>
        </div>

        {/* What was missed comes first; correct answers fold away. */}
        <QuizReview questions={questions} answers={answers} className="mb-6" />

        {/* Teaching flow recap */}
        {teachingFlow.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" /> Teaching Flow Covered
            </h3>
            <div className="space-y-2">
              {teachingFlow.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-foreground">{item.topic}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setAnswers({}); setShowResult(false); setCurrentIdx(0); }}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Retry
          </button>
          <Link to="/planner" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
            Done
          </Link>
        </div>
      </div>
    );
  }

  // Question screen
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to="/planner" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Back
      </Link>

      {/* Progress + teaching flow indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </p>
          {current.flow_position && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase ${
              current.flow_position === 'start' ? 'bg-blue-500/10 text-blue-600' :
              current.flow_position === 'end' ? 'bg-purple-500/10 text-purple-600' :
              'bg-amber-500/10 text-amber-600'
            }`}>
              {current.flow_position} of lecture{current.lecture_index ? ` ${current.lecture_index}` : ''}
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-standard" style={{ width: `${((currentIdx) / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <p className="text-sm font-medium text-foreground mb-4">{current.question}</p>

        <ChoiceOptions question={current} value={answers[currentIdx]} onChange={(opt) => setAnswers({ ...answers, [currentIdx]: opt })} compact />
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {currentIdx > 0 && (
          <button onClick={() => setCurrentIdx(currentIdx - 1)} className="px-4 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
            Back
          </button>
        )}
        {isLast ? (
          <button
            onClick={finishReview}
            disabled={!answers[currentIdx]}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Finish Review
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx(currentIdx + 1)}
            disabled={!answers[currentIdx]}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}