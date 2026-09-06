import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  DEFAULT_GOAL_MINUTES, DEFAULT_STUDY_MINUTES, DEFAULT_BREAK_MINUTES,
  goalMinutesFor, deriveStudyMode, deriveStudyType, formatClockSeconds,
} from '@/lib/studySession';
import { SEMANTIC } from '@/lib/color';

/**
 * The study session — the clock, and everything that happens when it stops.
 *
 * This is Focus Mode's engine, re-homed into a provider mounted once in
 * Layout, above the router. It is the same move RecordingContext made and for
 * the same reason: the state lived inside a page, so leaving the page killed
 * it. That was survivable while Focus Mode was a walled screen whose tools
 * were all overlays — you could not navigate away without meaning to.
 *
 * It stops being survivable the moment the tools live on the study page,
 * because three of them are routes. Pressing "Quiz me" would have ended the
 * session it was part of, silently, and the student would have found out at
 * the end when nothing was saved. So the clock sits above the router and the
 * page is only its handle.
 *
 * WHAT MUST NOT BREAK, and is therefore moved whole rather than rebuilt:
 *
 *   the StudyRecord write         the row Analytics is built from
 *   recordStudyCoverage           closes the session and marks its lectures
 *   the opened-lecture write-through   crash-proofing, per tool, as it happens
 *   the fallback close            if coverage fails, the session still closes
 *
 * Those four are the machinery that makes a finished session tick lectures
 * off. If they move badly nothing on screen says so — the freshness badges
 * simply stay grey — which is why they are copied across intact and their
 * ordering is asserted in the tests.
 */

const StudySessionContext = createContext(null);

/**
 * The clock ticks once a second, and almost nothing needs to know.
 *
 * One context would re-render every consumer on every tick — and the study
 * page is a consumer, so the lecture picker, the deadline cards and the whole
 * tool shelf would rebuild sixty times a minute for a number none of them
 * shows. Splitting the ticking values out means the page subscribes to the
 * session and only the two things that display a time subscribe to the time.
 */
const StudyTickContext = createContext(null);

export function useStudySession() {
  const ctx = useContext(StudySessionContext);
  if (!ctx) throw new Error('useStudySession must be used inside StudySessionProvider');
  return ctx;
}

/** The seconds, for the two components that render them. */
export function useStudyTick() {
  const ctx = useContext(StudyTickContext);
  if (!ctx) throw new Error('useStudyTick must be used inside StudySessionProvider');
  return ctx;
}

export function StudySessionProvider({ children }) {
  // --- what is being studied ---------------------------------------------
  const [session, setSession] = useState(null);      // StudySession row, or null for ad-hoc
  const [cls, setCls] = useState(null);
  const [assignment, setAssignment] = useState(null); // for the sprint/exam flavour
  const [classId, setClassId] = useState(null);
  const [lectureIds, setLectureIds] = useState([]);
  const [goalMinutes, setGoalMinutes] = useState(DEFAULT_GOAL_MINUTES);

  // --- the clock ----------------------------------------------------------
  const [mode, setMode] = useState('pomodoro');
  const [phase, setPhase] = useState('idle');
  const [studySeconds, setStudySeconds] = useState(0);
  const [intervalSecondsLeft, setIntervalSecondsLeft] = useState(0);
  const [pomodoroPhase, setPomodoroPhase] = useState('study');
  const [cycles, setCycles] = useState(0);
  const [studyMinutes, setStudyMinutes] = useState(DEFAULT_STUDY_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- what happened, for the record --------------------------------------
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [lecturesCovered, setLecturesCovered] = useState(0);
  const [totalLectures, setTotalLectures] = useState(0);
  // Which lectures this session actually opened, as opposed to which ones it
  // was booked to cover. Only these get marked reviewed when it ends —
  // booking an hour on four lectures and opening two is two lectures studied,
  // and a checklist that says otherwise is worse than no checklist.
  const [openedLectureIds, setOpenedLectureIds] = useState([]);
  const openedRef = useRef([]);
  // Set the moment a tool inside the app is used. The wizard used to ask this
  // in advance and believe the answer.
  const usedInAppRef = useRef(false);

  // Refs for the timer tick (avoid stale closures)
  const phaseRef = useRef('idle');
  const studySecondsRef = useRef(0);
  const intervalLeftRef = useRef(0);
  const modeRef = useRef('pomodoro');
  const awaitingConfirmRef = useRef(false);
  const studyMinutesRef = useRef(DEFAULT_STUDY_MINUTES);
  const breakMinutesRef = useRef(DEFAULT_BREAK_MINUTES);
  const sessionIdRef = useRef(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { studySecondsRef.current = studySeconds; }, [studySeconds]);
  useEffect(() => { intervalLeftRef.current = intervalSecondsLeft; }, [intervalSecondsLeft]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { awaitingConfirmRef.current = awaitingConfirm; }, [awaitingConfirm]);
  useEffect(() => { studyMinutesRef.current = studyMinutes; }, [studyMinutes]);
  useEffect(() => { breakMinutesRef.current = breakMinutes; }, [breakMinutes]);

  const sessionId = session?.id || null;
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  const goalSeconds = goalMinutes * 60;
  const goalProgress = Math.min(studySeconds / goalSeconds, 1);
  const isProjectSession = session?.session_type === 'project';

  const speak = useCallback((text) => {
    window.dispatchEvent(new CustomEvent('cedar-speak', { detail: { text } }));
  }, []);

  const askVoice = useCallback((question) => new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('cedar-voice-prompt', {
      detail: { question, onResponse: (response) => resolve(response) },
    }));
    setTimeout(() => resolve('timeout'), 15000);
  }), []);

  // --- timer tick (moved verbatim) ----------------------------------------
  useEffect(() => {
    if (phase !== 'studying' && phase !== 'break') return;

    const interval = setInterval(() => {
      if (awaitingConfirmRef.current) return;

      if (phaseRef.current === 'studying') {
        const newStudySeconds = studySecondsRef.current + 1;
        studySecondsRef.current = newStudySeconds;
        setStudySeconds(newStudySeconds);

        if (newStudySeconds >= goalSeconds) {
          setPhase('complete');
          speak(`Congratulations! You have completed ${goalMinutes} minutes of study time. Great work today.`);
          return;
        }

        if (modeRef.current === 'pomodoro') {
          const newIntervalLeft = intervalLeftRef.current - 1;
          intervalLeftRef.current = newIntervalLeft;
          setIntervalSecondsLeft(newIntervalLeft);

          if (newIntervalLeft <= 0) {
            awaitingConfirmRef.current = true;
            setAwaitingConfirm(true);
            setPhase('ended');
          }
        }
      } else if (phaseRef.current === 'break' && modeRef.current === 'pomodoro') {
        const newIntervalLeft = intervalLeftRef.current - 1;
        intervalLeftRef.current = newIntervalLeft;
        setIntervalSecondsLeft(newIntervalLeft);

        if (newIntervalLeft <= 0) {
          setPomodoroPhase('study');
          setPhase('studying');
          const secs = studyMinutesRef.current * 60;
          intervalLeftRef.current = secs;
          setIntervalSecondsLeft(secs);
          setCycles((c) => c + 1);
          speak('Break is over. Starting your next study interval.');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, goalSeconds, goalMinutes, speak]);

  const takeBreak = useCallback(() => {
    setAwaitingConfirm(false);
    awaitingConfirmRef.current = false;
    setPomodoroPhase('break');
    setPhase('break');
    const secs = breakMinutesRef.current * 60;
    intervalLeftRef.current = secs;
    setIntervalSecondsLeft(secs);
    speak(`Taking a ${breakMinutesRef.current} minute break.`);
  }, [speak]);

  const keepGoing = useCallback(() => {
    setAwaitingConfirm(false);
    awaitingConfirmRef.current = false;
    setPomodoroPhase('study');
    setPhase('studying');
    const secs = studyMinutesRef.current * 60;
    intervalLeftRef.current = secs;
    setIntervalSecondsLeft(secs);
    setCycles((c) => c + 1);
    speak('Keeping going. You have got this.');
  }, [speak]);

  // Interval end: ask by voice, and the modal offers the same two answers.
  useEffect(() => {
    if (!awaitingConfirm || phase !== 'ended') return;
    let cancelled = false;
    (async () => {
      speak(`You just completed a ${studyMinutesRef.current} minute study interval. Do you want to take a break or keep going?`);
      const response = await askVoice('break or keep going');
      if (cancelled || !awaitingConfirmRef.current) return;
      if (String(response || '').includes('break')) takeBreak(); else keepGoing();
    })();
    return () => { cancelled = true; };
  }, [awaitingConfirm, phase, speak, askVoice, takeBreak, keepGoing]);

  // --- starting ------------------------------------------------------------

  /**
   * Adopt what is being studied, without starting the clock.
   *
   * Opening a booked session should not start a timer the student has not
   * pressed — Focus Mode never did, and a clock that starts itself is a clock
   * that records time nobody spent. This primes the scope, the goal and the
   * labels; `start()` is a separate, deliberate act.
   */
  const adopt = useCallback((next) => {
    // A running session is not replaced, and the caller is told so — pointing
    // the pickers at a second session's lectures while the first one is still
    // counting would file them against the wrong sitting.
    if (phaseRef.current !== 'idle') return false;
    const nextSession = next.session || null;
    setSession(nextSession);
    setCls(next.cls || null);
    setAssignment(next.assignment || null);
    setClassId(next.classId || nextSession?.class_id || null);
    setLectureIds(Array.isArray(next.lectureIds) ? next.lectureIds : []);
    setGoalMinutes(next.goalMinutes || goalMinutesFor(nextSession));
    openedRef.current = Array.isArray(nextSession?.opened_lecture_ids) ? nextSession.opened_lecture_ids : [];
    setOpenedLectureIds(openedRef.current);
    return true;
  }, []);

  const start = useCallback(() => {
    if (mode === 'pomodoro') {
      setPomodoroPhase('study');
      const secs = studyMinutesRef.current * 60;
      intervalLeftRef.current = secs;
      setIntervalSecondsLeft(secs);
    }
    setPhase('studying');
    speak(mode === 'pomodoro' ? `Starting a ${studyMinutesRef.current} minute study interval.` : 'Starting your study session.');
  }, [mode, speak]);

  const pause = useCallback(() => { setPhase('paused'); speak('Timer paused.'); }, [speak]);
  const resume = useCallback(() => { setPhase('studying'); }, []);

  // Switch mode — preserves accumulated study time.
  //
  // The reads go through refs rather than a setMode updater: an updater is
  // called twice under StrictMode, and these are side effects, so the interval
  // would be recomputed against a value it had already moved past.
  const changeMode = useCallback((newMode) => {
    if (modeRef.current === newMode) return;
    if (phaseRef.current === 'break') setPhase('studying');
    // Carry the elapsed time into the countdown: the interval picks up where
    // the accumulated study time falls inside the current cycle instead of
    // restarting. Switching views must never look like it lost the clock —
    // studySeconds is the one source of truth and is never reset here.
    if (newMode === 'pomodoro' && (phaseRef.current === 'studying' || phaseRef.current === 'paused')) {
      setPomodoroPhase('study');
      const cycle = studyMinutesRef.current * 60;
      const secs = cycle - (studySecondsRef.current % cycle);
      intervalLeftRef.current = secs;
      setIntervalSecondsLeft(secs);
    }
    modeRef.current = newMode;
    setMode(newMode);
  }, []);

  /**
   * A tool reports the lectures it just put in front of the student.
   *
   * Written through to the session as it happens rather than accumulated for
   * the end: a browser that dies forty minutes in should not cost a student
   * the record of what they read. The union is computed against a ref because
   * three tools can report within the same tick and state would only see the
   * value each of them started from.
   */
  const markOpened = useCallback(async (ids) => {
    usedInAppRef.current = true;
    const incoming = (Array.isArray(ids) ? ids : []).filter(Boolean);
    if (incoming.length === 0) return;
    const merged = [...new Set([...openedRef.current, ...incoming])];
    if (merged.length === openedRef.current.length) return;
    openedRef.current = merged;
    setOpenedLectureIds(merged);
    const id = sessionIdRef.current;
    if (!id) return; // Ad-hoc session: nothing to write it to.
    try {
      await base44.entities.StudySession.update(id, { opened_lecture_ids: merged });
    } catch (e) {
      // The list is still in memory and still goes up with the session at the
      // end; only the crash-proofing was lost.
      console.error('Could not record opened lectures:', e);
    }
  }, []);

  /** A tool was used in the app, whether or not it named lectures. */
  const markInApp = useCallback(() => { usedInAppRef.current = true; }, []);

  const recordQuiz = useCallback((result) => {
    setQuizResult(result);
    setLecturesCovered(result?.lecturesCovered || 0);
    setTotalLectures(result?.totalLectures || 0);
  }, []);

  const reset = useCallback(() => {
    setSession(null); setCls(null); setAssignment(null);
    setClassId(null); setLectureIds([]);
    setGoalMinutes(DEFAULT_GOAL_MINUTES);
    setPhase('idle'); setStudySeconds(0); setIntervalSecondsLeft(0);
    setPomodoroPhase('study'); setCycles(0);
    setAwaitingConfirm(false); awaitingConfirmRef.current = false;
    setSavedRecordId(null); setQuizResult(null);
    setLecturesCovered(0); setTotalLectures(0);
    setOpenedLectureIds([]); openedRef.current = [];
    usedInAppRef.current = false;
    studySecondsRef.current = 0; intervalLeftRef.current = 0;
    setShowMusic(false);
  }, []);

  /**
   * Stop and save. The order here is the contract.
   *
   * 1. StudyRecord — the row Analytics is built from, and the one write whose
   *    failure the student is told about.
   * 2. recordStudyCoverage — closes the session AND marks its lectures, in one
   *    server-side transaction. Its own try: coverage is bookkeeping, and a
   *    student who just studied for an hour must not be told their session
   *    failed to save because a ledger write did.
   * 3. the fallback close — if coverage fails, the session still has to leave
   *    the planner. This is the write that used to be here on its own.
   */
  const stop = useCallback(async () => {
    if (studySecondsRef.current < 1) { reset(); return { ok: true, saved: false }; }
    setSaving(true);
    try {
      const record = await base44.entities.StudyRecord.create({
        duration_seconds: studySecondsRef.current,
        date: new Date().toISOString().split('T')[0],
        class_id: session?.class_id || classId || null,
        mode,
        cycles_completed: cycles,
        goal_minutes: goalMinutes,
        study_type: deriveStudyType(usedInAppRef.current),
        study_mode: deriveStudyMode(session, assignment),
        lectures_covered: lecturesCovered,
        total_lectures: totalLectures,
        quiz_score: quizResult?.pct,
        quiz_questions_count: quizResult?.total,
        topics_reviewed: lectureIds.length > 0 ? lectureIds : undefined,
      });
      setSavedRecordId(record.id);

      const coverageClassId = session?.class_id || classId || null;
      const id = sessionIdRef.current;
      if (id || (coverageClassId && openedRef.current.length > 0)) {
        try {
          await base44.functions.invoke('recordStudyCoverage', {
            session_id: id || null,
            class_id: coverageClassId,
            lecture_ids: openedRef.current,
          });
        } catch (e) {
          console.error('Could not record study coverage:', e);
          if (session && session.status === 'scheduled') {
            try {
              await base44.entities.StudySession.update(session.id, { status: 'completed' });
            } catch { /* the planner will still show it as due; nothing else is lost */ }
          }
        }
      }
      setPhase(isProjectSession ? 'project_end' : 'review_prompt');
      setSaving(false);
      return { ok: true, saved: true, recordId: record.id, isProjectSession };
    } catch (e) {
      setSaving(false);
      return { ok: false, saved: false, error: 'Could not save your session. Please try again.' };
    }
  }, [session, classId, mode, cycles, goalMinutes, lecturesCovered, totalLectures, quizResult, lectureIds, assignment, isProjectSession, reset]);

  // Voice commands, unchanged in meaning: start / pause / resume / break / end.
  useEffect(() => {
    const handler = (e) => {
      const action = e?.detail?.action;
      if (action === 'start' && phaseRef.current === 'idle') start();
      else if (action === 'pause' && phaseRef.current === 'studying') pause();
      else if (action === 'resume' && phaseRef.current === 'paused') resume();
      else if (action === 'break' && phaseRef.current === 'studying' && modeRef.current === 'pomodoro') takeBreak();
      else if (action === 'end') stop();
    };
    window.addEventListener('cedar-pomodoro', handler);
    return () => window.removeEventListener('cedar-pomodoro', handler);
  }, [start, pause, resume, takeBreak, stop]);

  // --- derived display -----------------------------------------------------
  const running = phase === 'studying' || phase === 'paused' || phase === 'break' || phase === 'ended' || phase === 'complete';
  const intervalTotal = (pomodoroPhase === 'break' ? breakMinutes : studyMinutes) * 60;
  const intervalProgress = intervalTotal > 0 ? 1 - Math.max(0, intervalSecondsLeft) / intervalTotal : 0;
  const ringProgress = mode === 'pomodoro' ? intervalProgress : goalProgress;
  const ringColor = phase === 'break' ? SEMANTIC.good : phase === 'complete' ? SEMANTIC.warn : 'hsl(var(--primary))';
  const displayTime = mode === 'pomodoro' ? formatClockSeconds(intervalSecondsLeft) : formatClockSeconds(studySeconds);
  const phaseLabel = {
    idle: 'Ready to study',
    studying: mode === 'pomodoro' ? (pomodoroPhase === 'break' ? 'On break' : 'Studying') : 'Studying',
    paused: 'Paused',
    break: 'On break',
    ended: 'Interval complete',
    complete: 'Goal complete',
    review_prompt: 'Saved',
    project_end: 'Saved',
  }[phase] || '';

  // Everything that does NOT change once a second. Memoised so the study page
  // is not rebuilt by the clock.
  const value = useMemo(() => ({
    // what
    session, sessionId, cls, assignment, classId, lectureIds, isProjectSession,
    // clock, minus the seconds
    mode, phase, running, pomodoroPhase, cycles, studyMinutes, breakMinutes,
    awaitingConfirm, goalMinutes, ringColor, phaseLabel, saving,
    // results
    savedRecordId, quizResult, lecturesCovered, totalLectures, openedLectureIds,
    // controls
    adopt, start, pause, resume, stop, reset,
    setMode: changeMode, setStudyMinutes, setBreakMinutes, setGoalMinutes,
    takeBreak, keepGoing, markOpened, markInApp, recordQuiz,
    showMusic, setShowMusic,
  }), [
    session, sessionId, cls, assignment, classId, lectureIds, isProjectSession,
    mode, phase, running, pomodoroPhase, cycles, studyMinutes, breakMinutes,
    awaitingConfirm, goalMinutes, ringColor, phaseLabel, saving,
    savedRecordId, quizResult, lecturesCovered, totalLectures, openedLectureIds,
    adopt, start, pause, resume, stop, reset, changeMode,
    takeBreak, keepGoing, markOpened, markInApp, recordQuiz, showMusic,
  ]);

  const tick = useMemo(() => ({
    studySeconds, intervalSecondsLeft, displayTime, goalProgress, ringProgress,
  }), [studySeconds, intervalSecondsLeft, displayTime, goalProgress, ringProgress]);

  return (
    <StudySessionContext.Provider value={value}>
      <StudyTickContext.Provider value={tick}>{children}</StudyTickContext.Provider>
    </StudySessionContext.Provider>
  );
}

export default StudySessionProvider;
