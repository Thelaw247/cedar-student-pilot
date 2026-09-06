import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { X, Check, Clock, Loader2 } from 'lucide-react';
import StudyTimer from '@/study/StudyTimer';
import { useStudySession } from '@/study/StudySessionContext';
import { studyPath } from '@/lib/studyScope';

/**
 * A project work session — the one sitting that is not "study these lectures".
 *
 * Everything else that used to live here has moved. The timer is
 * StudySessionProvider, above the router, so a session survives opening a
 * quiz. The tools are on the study page under one lecture picker. The wizard
 * that asked what kind of session this was and whether you wanted to study in
 * the app or on paper is deleted: the first two answers only ever set timer
 * lengths the running UI already exposes, and the third was a promise the app
 * then recorded as fact even when the student did the opposite.
 *
 * A project keeps its own screen because it is a different activity. It works
 * through a roadmap step, not a set of lectures; it has a rubric to tick off
 * rather than material to generate; and it ends by asking whether it needs
 * more time. None of that belongs on a page about lectures, and none of it
 * ever went through the wizard anyway.
 *
 * A non-project session opened here is not a redirect for tidiness — it is
 * where the session now happens, with its scope filled in from the row.
 */
export default function FocusMode() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const studySession = useStudySession();
  const [session, setSession] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [state, setState] = useState(sessionId ? 'loading' : 'redirect');

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await base44.entities.StudySession.get(sessionId);
        if (cancelled) return;
        if (s?.session_type !== 'project') { setState('redirect'); return; }
        setSession(s);
        const [c, a] = await Promise.all([
          s.class_id ? base44.entities.Class.get(s.class_id).catch(() => null) : null,
          s.assignment_id ? base44.entities.Assignment.get(s.assignment_id).catch(() => null) : null,
        ]);
        if (cancelled) return;
        setAssignment(a);
        studySession.adopt({ session: s, cls: c, assignment: a, classId: s.class_id, lectureIds: [] });
        setState('project');
      } catch {
        if (!cancelled) setState('redirect');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (state === 'redirect') {
    // Every other kind of sitting is the study page now, carrying its session.
    return <Navigate to={studyPath({ tab: 'now', sessionId: sessionId || '' })} replace />;
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  const stepIdx = session?.roadmap_step_index;
  const step = (stepIdx !== undefined && stepIdx !== null && stepIdx >= 0 && assignment?.roadmap?.[stepIdx]) || null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10 animate-fade-in relative">
      <button onClick={() => navigate('/study')} aria-label="Close"
        className="absolute top-6 left-6 w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10">
        <X className="w-5 h-5" />
      </button>

      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-6">Project work session</p>

      {/* Which step of the roadmap this sitting is for. */}
      {step ? (
        <div className="text-center mb-6 max-w-sm">
          <p className="text-[10px] text-primary font-semibold uppercase tracking-widest mb-1">
            Step {(stepIdx || 0) + 1} of {assignment?.roadmap?.length || 0}
          </p>
          <h3 className="font-heading text-lg font-semibold mb-1">{step.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Est. {step.estimated_minutes || 60} min
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">Additional project work session</p>
      )}

      {/* Rubric — carried on the assignment, so it is the same list whichever
          of its sessions you open. Ticking persists straight to it. */}
      {assignment?.rubric?.length > 0 && (
        <div className="text-left mb-6 w-full max-w-sm rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            {assignment.title} — rubric
          </p>
          <div className="space-y-1.5">
            {assignment.rubric.map((item, i) => (
              <button key={i} type="button"
                onClick={() => {
                  const updated = assignment.rubric.map((it, idx) => idx === i ? { ...it, done: !it.done } : it);
                  setAssignment({ ...assignment, rubric: updated });
                  base44.entities.Assignment.update(assignment.id, { rubric: updated }).catch(() => {});
                }}
                className="w-full flex items-start gap-2.5 text-left py-1 group">
                <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-primary border-primary' : 'border-input group-hover:border-primary/50'}`}>
                  {item.done && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                </span>
                <span className={`text-sm ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The same clock as the study page, in its full shape. Stopping runs
          the same save — record, coverage, fallback close — and a project
          session ends on its own question about whether it needs more time. */}
      <StudyTimer variant="full" className="w-full max-w-md" />
    </div>
  );
}
