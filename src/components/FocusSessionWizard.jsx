import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ChevronLeft, Loader2, RefreshCw, GraduationCap, Brain, BookOpen, ClipboardList, Check, ArrowRight } from 'lucide-react';
import LecturePickerSheet from '@/components/LecturePickerSheet';

/**
 * FocusSessionWizard
 * ------------------
 * Replaces the old three-axis manual setup (Deep Study / Exam Sprint / Lecture
 * Review tabs  +  Pomodoro / Simple toggle  +  In-App / Paper modal) with a
 * short guided question flow. The user answers plain-language questions and the
 * wizard DERIVES the session type — the deep/sprint/review taxonomy never
 * appears in the UI.
 *
 * On finish it calls:
 *   onComplete({ classId, studyMode, studyType, lectureIds, examAssignmentId })
 * where studyMode ∈ deep|sprint|review and studyType ∈ in_app|manual — exactly
 * the values FocusMode already knows how to run.
 *
 * Props:
 *   initialClassId — pre-selected class (from a session or lecture context); if
 *                    absent, the wizard asks the user to pick a class first.
 *   initialLectureIds — pre-selected lectures (e.g. opened from a lecture page);
 *                    when present with a review goal, the lecture step is skipped.
 *   onComplete(config) — called with the derived config when the user is ready.
 *   onCancel() — called if the user backs all the way out.
 */
export default function FocusSessionWizard({ initialClassId = null, initialLectureIds = [], onComplete, onCancel }) {
  // Steps: 'class' → 'goal' → ('lectures' | 'exam' | skip) → 'method'
  // If we were opened straight from a lecture (lectures pre-seeded), the goal is
  // already known (review those lectures) — skip ahead to the method question.
  const seededFromLecture = initialClassId && initialLectureIds.length > 0;
  const [step, setStep] = useState(
    seededFromLecture ? 'method' : (initialClassId ? 'goal' : 'class')
  );
  const [classId, setClassId] = useState(initialClassId);
  const [cls, setCls] = useState(null);
  const [goal, setGoal] = useState(seededFromLecture ? 'review' : null); // 'review' | 'sprint' | 'deep'
  const [lectureIds, setLectureIds] = useState(initialLectureIds);
  const [examAssignmentId, setExamAssignmentId] = useState(null);

  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(!initialClassId);
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);

  // Load classes for the class-picker step
  useEffect(() => {
    if (initialClassId) return;
    (async () => {
      try {
        const semesters = await base44.entities.Semester.filter({ is_active: true });
        if (semesters.length > 0) {
          const cs = await base44.entities.Class.filter({ semester_id: semesters[0].id });
          setClasses(cs);
        }
      } catch (e) { /* silent */ }
      setLoadingClasses(false);
    })();
  }, [initialClassId]);

  // Load the class object once we have an id
  useEffect(() => {
    if (!classId) return;
    base44.entities.Class.get(classId).then(setCls).catch(() => {});
  }, [classId]);

  // When the goal becomes 'sprint', load upcoming exams/quizzes for the class
  useEffect(() => {
    if (goal !== 'sprint' || !classId) return;
    setLoadingExams(true);
    (async () => {
      try {
        const asgns = await base44.entities.Assignment.filter({ class_id: classId }, 'due_date');
        const today = new Date().toISOString().split('T')[0];
        const upcoming = asgns.filter(a => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= today);
        setExams(upcoming);
      } catch (e) { setExams([]); }
      setLoadingExams(false);
    })();
  }, [goal, classId]);

  const pickGoal = (g) => {
    setGoal(g);
    if (g === 'review') {
      // If lectures were pre-selected (opened from a lecture), skip the picker.
      setStep(lectureIds.length > 0 ? 'method' : 'lectures');
    } else if (g === 'sprint') {
      setStep('exam');
    } else {
      setStep('method'); // deep study — no material step
    }
  };

  const finish = (studyType) => {
    onComplete({
      classId,
      studyMode: goal,
      studyType,
      lectureIds,
      examAssignmentId,
    });
  };

  const goBack = () => {
    if (step === 'goal') { initialClassId ? onCancel() : setStep('class'); }
    else if (step === 'lectures' || step === 'exam') { setGoal(null); setStep('goal'); }
    else if (step === 'method') {
      if (goal === 'review') setStep(initialLectureIds.length > 0 ? 'goal' : 'lectures');
      else if (goal === 'sprint') setStep('exam');
      else setStep('goal');
    }
    else onCancel();
  };

  // The lecture picker is its own full sheet; render it directly for that step.
  if (step === 'lectures') {
    return (
      <LecturePickerSheet
        classId={classId}
        cls={cls}
        onStart={(ids) => {
          setLectureIds(ids);
          setStep('method');
        }}
        onClose={goBack}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 glass p-0 sm:p-4" onClick={onCancel}>
      <div
        className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with back + cancel */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: choose class */}
        {step === 'class' && (
          <div>
            <h3 className="font-heading text-lg font-semibold mb-1">Which class?</h3>
            <p className="text-sm text-muted-foreground mb-5">Pick the class you want to focus on.</p>
            {loadingClasses ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : classes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No classes yet. Add a class first.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {classes.map(c => (
                  <button key={c.id}
                    onClick={() => { setClassId(c.id); setCls(c); setStep('goal'); }}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all text-left">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: (c.color || '#3B82F6') + '20', color: c.color || '#3B82F6' }}>
                      <GraduationCap className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: choose goal */}
        {step === 'goal' && (
          <div>
            <h3 className="font-heading text-lg font-semibold mb-1">What do you want to get done?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {cls?.name ? `For ${cls.name}.` : ''} I'll set up the rest for you.
            </p>
            <div className="space-y-3">
              <GoalOption
                icon={RefreshCw} tint="primary"
                title="Review recent lectures"
                desc="Refresh what you've already covered so it sticks. Best for staying on top of the material."
                onClick={() => pickGoal('review')}
              />
              <GoalOption
                icon={ClipboardList} tint="rose"
                title="Prep for an exam or quiz"
                desc="Focus on everything a specific test covers, in a tighter, faster rhythm."
                onClick={() => pickGoal('sprint')}
              />
              <GoalOption
                icon={Brain} tint="amber"
                title="Study this class in depth"
                desc="A longer, deeper session to really work through the material."
                onClick={() => pickGoal('deep')}
              />
            </div>
          </div>
        )}

        {/* Step: choose exam (sprint goal) */}
        {step === 'exam' && (
          <div>
            <h3 className="font-heading text-lg font-semibold mb-1">Which test are you prepping for?</h3>
            <p className="text-sm text-muted-foreground mb-5">I'll focus the session on what it covers.</p>
            {loadingExams ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {exams.map(ex => {
                  const selected = examAssignmentId === ex.id;
                  return (
                    <button key={ex.id}
                      onClick={() => setExamAssignmentId(ex.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 transition-all text-left ${
                        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      }`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-primary bg-primary' : 'border-border'}`}>
                        {selected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ex.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{ex.type} • due {ex.due_date}</p>
                      </div>
                    </button>
                  );
                })}
                {/* Always allow prepping without a specific exam on file */}
                <button
                  onClick={() => setExamAssignmentId(null)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 transition-all text-left ${
                    examAssignmentId === null ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  }`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${examAssignmentId === null ? 'border-primary bg-primary' : 'border-border'}`}>
                    {examAssignmentId === null && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {exams.length > 0 ? 'None of these — general exam prep' : 'General exam prep'}
                  </span>
                </button>
                <button
                  onClick={() => setStep('method')}
                  className="w-full mt-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: choose method (in-app vs paper) */}
        {step === 'method' && (
          <div>
            <h3 className="font-heading text-lg font-semibold mb-1">How do you want to study?</h3>
            <p className="text-sm text-muted-foreground mb-5">Either way, the timer tracks your session.</p>
            <div className="space-y-3">
              <GoalOption
                icon={Brain} tint="primary"
                title="In the app"
                desc="Read through the material and test yourself with quizzes as you go."
                onClick={() => finish('in_app')}
              />
              <GoalOption
                icon={BookOpen} tint="amber"
                title="On paper"
                desc="I'll build you a study guide with the topics to review away from the screen."
                onClick={() => finish('manual')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GoalOption({ icon: Icon, title, desc, onClick, tint = 'primary' }) {
  const tints = {
    primary: 'bg-primary/10 text-primary group-hover:bg-primary/20',
    rose: 'bg-rose-500/10 text-rose-600 group-hover:bg-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20',
  };
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all text-left group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${tints[tint]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
    </button>
  );
}
