import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { saveRecording, getRecording, clearRecording } from '@/lib/recordingStore';
import { LECTURE_COMPLETE, LECTURE_PENDING } from '@/lib/lectureStatus';
import { useUpgrade } from '@/components/monetization/UpgradeContext';

/**
 * Global recording session (Design Blueprint §3, law 03).
 *
 * The recording ENGINE here — segment rotation, per-15s IndexedDB flush,
 * crash recovery, retrying uploads, orphan cleanup — is the exact code that
 * lived inside ClassDetail's RecordModal, re-homed verbatim into a provider
 * mounted once in Layout, above the router. That is the whole point: the
 * modal died on navigation, so recording walled off the entire app. The
 * provider survives navigation, so the student can browse lectures, check
 * the timetable, or review flashcards while the mic keeps running; the
 * floating RecordingIsland is the session's visible handle on every page.
 *
 * Nothing about the upload/processing contract changed: same segment limits,
 * same Lecture create with status 'pending', same 202-then-poll flow, same
 * 402 → upgrade sheet behavior.
 */

// Each segment must stay under the transcription provider's per-file limit
// (Groq's free tier: 25 MB). 32 kbps Opus keeps a 90-minute segment
// comfortably inside that; a lecture can run to the 6-hour ceiling by
// chaining segments behind the scenes.
const MAX_SEGMENT_BYTES = 24 * 1024 * 1024;
const RECORDING_AUDIO_BITS_PER_SECOND = 32_000;
const SEGMENT_ROTATE_SECONDS = 90 * 60;
const MAX_TOTAL_SECONDS = 6 * 60 * 60;
const MAX_UPLOAD_ATTEMPTS = 3;

// Poll the lecture row after the 202-accepted processing call.
//
// The terminal status is 'complete'. It is imported rather than typed here
// because it was once typed here, as 'completed', which is the vocabulary of
// assignments and study sessions and a value the lectures CHECK constraint
// rejects outright. The success branch was therefore unreachable: every save
// polled until it gave up, so a lecture that had finished in two minutes
// looked hung, and each retry created another lecture and charged again.
//
// The ceiling is generous because a six-hour recording legitimately takes a
// long time, and being impatient here is expensive: giving up early is what
// strands the local copy and invites the duplicate.
async function waitForLectureProcessing(lectureId) {
  const POLL_INTERVAL_MS = 3000;
  const MAX_WAIT_MS = 45 * 60 * 1000;
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let lecture;
    try {
      lecture = await base44.entities.Lecture.get(lectureId);
    } catch (e) {
      continue; // transient fetch failure — keep polling
    }
    if (lecture?.status === LECTURE_COMPLETE) return lecture;
    if (lecture?.status === LECTURE_PENDING) {
      throw new Error("Processing didn't finish. Your recording is saved — tap Save & Process to try again.");
    }
  }
  throw new Error('Processing is taking unusually long. Your recording is saved — please try again shortly.');
}

const RecordingContext = createContext(null);

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error('useRecording must be used inside <RecordingProvider>');
  return ctx;
}

export function RecordingProvider({ children }) {
  const { openUpgrade } = useUpgrade();

  // cls: { id, name, color } for the class being recorded. null = no session.
  const [cls, setCls] = useState(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploadingSegment, setUploadingSegment] = useState(false);
  const [savedSegmentCount, setSavedSegmentCount] = useState(0);
  const [readyToSave, setReadyToSave] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reviewLectureId, setReviewLectureId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [pendingLectureId, setPendingLectureId] = useState(null);
  const [liveNotes, setLiveNotes] = useState('');
  const [recordingLimitReached, setRecordingLimitReached] = useState(false);
  // Seeded by recoverSession() when RecordModal finds a crashed session.
  // The blob lives in a ref so saveAndProcess can run in the same tick as
  // recoverSession (before React state flushes); state mirrors it for the UI.
  const [recoveredBlob, setRecoveredBlob] = useState(null);
  const recoveredBlobRef = useRef(null);
  // Mirrors pendingLectureId so saveAndProcess can read it in the same tick
  // as recoverSession, and so a recovered session inherits the lecture the
  // previous attempt already created instead of creating a second one.
  const pendingLectureIdRef = useRef(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]); // chunks for the segment currently being captured
  const secondsRef = useRef(0); // total elapsed seconds across every segment
  const segmentSecondsRef = useRef(0); // elapsed seconds in the current segment only
  const uploadedPartsRef = useRef([]); // r2:// refs already uploaded, in order
  const rotatingRef = useRef(false); // guards timer + manual stop racing
  const pausedRef = useRef(false);
  const recordingRef = useRef(false);
  const clsRef = useRef(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { clsRef.current = cls; }, [cls]);

  // A session exists whenever there is anything the island should show.
  const active = !!cls && (recording || readyToSave || processing || uploadingSegment || !!saveError || !!reviewLectureId || !!recoveredBlob);

  // Leaving the site mid-recording would kill the mic — warn first. IndexedDB
  // still has the audio, so this is a guardrail, not a data-loss cliff.
  useEffect(() => {
    if (!recording) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [recording]);

  // Best-effort delete of segments uploaded to R2 but never linked to a
  // Lecture row — otherwise abandoning a recording would leak objects.
  const deleteOrphanedParts = async (refs) => {
    if (!refs?.length || !base44.files?.delete) return;
    await Promise.all(refs.map((ref) => base44.files.delete(ref).catch((err) => {
      console.error('Could not clean up an orphaned recording segment', err);
    })));
  };

  const uploadSegmentWithRetry = async (blob) => {
    if (blob.size > MAX_SEGMENT_BYTES) {
      throw new Error('A recording segment exceeded the safe upload size. Please try recording again.');
    }
    let lastError;
    for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
      try {
        const audioFile = new File([blob], `lecture-${Date.now()}-part${uploadedPartsRef.current.length + 1}.webm`, { type: 'audio/webm' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: audioFile, purpose: 'recording' });
        return file_url;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_UPLOAD_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastError || new Error('Could not upload the recording segment.');
  };

  // Starts capturing a new segment on the already-open microphone stream.
  const startSegment = () => {
    const stream = streamRef.current;
    const options = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND }
      : { audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND };
    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      // Some older WebKit versions reject bitrate options even though the
      // MIME type is supported. Browser default still passes the size check.
      recorder = new MediaRecorder(stream);
    }
    chunksRef.current = [];
    segmentSecondsRef.current = 0;
    // Every ~15s: append the slice and flush the segment-so-far to IndexedDB
    // (tagged with segments already safely uploaded), so a crash loses at
    // most ~15s and uploaded segments are never re-recorded.
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        saveRecording(clsRef.current?.id, blob, {
          seconds: secondsRef.current,
          timestamp: Date.now(),
          parts: uploadedPartsRef.current,
        });
      }
    };
    // A phone browser can stop the recorder out from under us: the tab is
    // backgrounded, the OS reclaims the microphone, a call comes in. Nothing
    // used to notice — the clock kept counting and the pill kept saying
    // "recording" while no audio was arriving, and the student only found out
    // when they stopped. Treat it as the end of the recording and move to
    // "ready to save" so the audio captured so far is offered immediately.
    //
    // stopCurrentSegment installs its own onstop for deliberate stops, so
    // reaching this handler means the recorder ended on its own.
    recorder.onstop = () => {
      if (recordingRef.current && !rotatingRef.current) handleUnexpectedStop();
    };
    recorder.onerror = () => {
      if (recordingRef.current && !rotatingRef.current) handleUnexpectedStop();
    };
    recorder.start(15000);
    recorderRef.current = recorder;
  };

  // The recording ended without us asking. Finalize what we have and say so.
  const handleUnexpectedStop = () => {
    setSaveError('Recording stopped — your phone or browser interrupted it. Everything up to that point is safe. Tap Save & process to keep it.');
    finalizeRecording({ interrupted: true });
  };

  // Stops the current segment's recorder, resolving with its Blob. Callers
  // decide whether to upload or start the next segment.
  const stopCurrentSegment = () => new Promise((resolve) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      return;
    }
    recorder.onstop = () => {
      resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
    };
    if (pausedRef.current) { try { recorder.resume(); } catch (e) { /* already running */ } }
    try { recorder.requestData(); } catch (e) { /* best-effort flush */ }
    try { recorder.stop(); } catch (e) { resolve(new Blob(chunksRef.current, { type: 'audio/webm' })); }
  });

  // 90-minute boundary: finalize + upload the finished segment in the
  // background and immediately keep capturing on the same open mic stream.
  const rotateSegment = async () => {
    if (rotatingRef.current || !recordingRef.current) return;
    rotatingRef.current = true;
    try {
      const blob = await stopCurrentSegment();
      startSegment(); // never wait on the upload
      const ref = await uploadSegmentWithRetry(blob);
      uploadedPartsRef.current = [...uploadedPartsRef.current, ref];
      setSavedSegmentCount(uploadedPartsRef.current.length);
      const currentBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await saveRecording(clsRef.current?.id, currentBlob, {
        seconds: secondsRef.current,
        timestamp: Date.now(),
        parts: uploadedPartsRef.current,
      });
    } catch (e) {
      // Segment could not be saved after retries — stop rather than risk
      // losing more audio. The blob is preserved locally for a manual retry.
      try { recorderRef.current?.stop(); } catch (err) { /* already stopped */ }
      setRecording(false);
      setPaused(false);
      setSaveError('A recording segment could not be uploaded. Check your connection, then try saving again — your audio is safe on this device.');
      setReadyToSave(true);
    } finally {
      rotatingRef.current = false;
    }
  };

  // Finalizes the whole recording: stop, upload the last segment, move to
  // "ready to save". Used by manual Stop and by the 6-hour ceiling.
  const finalizeRecording = async ({ hitAbsoluteLimit = false, interrupted = false } = {}) => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;
    setRecording(false);
    setPaused(false);
    if (hitAbsoluteLimit) setRecordingLimitReached(true);
    setUploadingSegment(true);
    try {
      const blob = await stopCurrentSegment();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (blob.size > 0) {
        const ref = await uploadSegmentWithRetry(blob);
        uploadedPartsRef.current = [...uploadedPartsRef.current, ref];
        setSavedSegmentCount(uploadedPartsRef.current.length);
      }
      await saveRecording(clsRef.current?.id, new Blob([], { type: 'audio/webm' }), {
        seconds: secondsRef.current,
        timestamp: Date.now(),
        parts: uploadedPartsRef.current,
        lectureId: pendingLectureIdRef.current,
      });
      setReadyToSave(true);
    } catch (e) {
      setSaveError('Could not finish uploading the last part of this recording. Your audio is safe on this device — try saving again.');
      setReadyToSave(true);
    }
    setUploadingSegment(false);
    rotatingRef.current = false;
  };

  // The 1-second clock. Lives here so it never dies on navigation.
  useEffect(() => {
    let interval;
    if (recording && !paused) {
      interval = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          segmentSecondsRef.current += 1;
          if (next >= MAX_TOTAL_SECONDS) {
            finalizeRecording({ hitAbsoluteLimit: true });
          } else if (segmentSecondsRef.current >= SEGMENT_ROTATE_SECONDS) {
            rotateSegment();
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, paused]);

  /** Begin a new session for a class. Consent is confirmed by the caller
   *  (RecordModal's gate) before this runs — same order as before. */
  const start = useCallback(async (classInfo) => {
    if (recordingRef.current) return false; // one session at a time
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setCls({ id: classInfo.id, name: classInfo.name, color: classInfo.color });
      clsRef.current = { id: classInfo.id, name: classInfo.name, color: classInfo.color };
      streamRef.current = stream;
      uploadedPartsRef.current = [];
      setSavedSegmentCount(0);
      setRecoveredBlob(null);
      recoveredBlobRef.current = null;
      setReadyToSave(false);
      setRecordingLimitReached(false);
      setSaveError('');
      setPendingLectureId(null);
      pendingLectureIdRef.current = null;
      setReviewLectureId(null);
      setLiveNotes('');
      setSeconds(0);
      secondsRef.current = 0;
      startSegment();
      setRecording(true);
      setPaused(false);
      return true;
    } catch (e) {
      return false; // caller shows the microphone-permission message
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    if (!recorderRef.current) return;
    if (pausedRef.current) {
      try { recorderRef.current.resume(); } catch (e) { /* already running */ }
      setPaused(false);
    } else {
      // Flush so the durable copy is current at the pause point.
      try { recorderRef.current.requestData(); } catch (e) { /* best-effort */ }
      try { recorderRef.current.pause(); } catch (e) { /* unsupported */ }
      setPaused(true);
    }
  }, []);

  const stop = useCallback(() => { finalizeRecording(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Seed a crashed session found in IndexedDB so it can be saved from the
   *  island. Called by RecordModal when it finds recoverable audio. */
  const recoverSession = useCallback((classInfo, rec) => {
    if (recordingRef.current) return;
    const parts = Array.isArray(rec.parts) ? rec.parts : [];
    setCls({ id: classInfo.id, name: classInfo.name, color: classInfo.color });
    clsRef.current = { id: classInfo.id, name: classInfo.name, color: classInfo.color };
    uploadedPartsRef.current = parts;
    setSavedSegmentCount(parts.length);
    recoveredBlobRef.current = rec.blob && rec.blob.size > 0 ? rec.blob : null;
    setRecoveredBlob(rec.blob && rec.blob.size > 0 ? rec.blob : null);
    // Reuse the lecture the interrupted attempt already created. This is the
    // difference between a retry and a duplicate.
    pendingLectureIdRef.current = rec.lectureId || null;
    setPendingLectureId(rec.lectureId || null);
    setSeconds(rec.seconds || 0);
    secondsRef.current = rec.seconds || 0;
    setReadyToSave(true);
  }, []);

  const saveAndProcess = useCallback(async () => {
    const activeCls = clsRef.current;
    if (!activeCls) return;
    setProcessing(true);
    setSaveError('');
    try {
      // Crash recovery: the recovered blob is the one segment that had not
      // finished uploading. Upload it now, appended after the parts that
      // made it before the crash; clearing the ref right after guarantees a
      // later retry never re-uploads it.
      const pendingRecovered = recoveredBlobRef.current;
      if (pendingRecovered && pendingRecovered.size > 0) {
        const ref = await uploadSegmentWithRetry(pendingRecovered);
        uploadedPartsRef.current = [...uploadedPartsRef.current, ref];
        setSavedSegmentCount(uploadedPartsRef.current.length);
        recoveredBlobRef.current = null;
        setRecoveredBlob(null);
      }

      const parts = uploadedPartsRef.current;
      if (!parts.length) throw new Error('The recording is empty. Please record it again.');

      const durationSeconds = secondsRef.current || 0;

      // Estimated-cost preflight; the backend independently verifies real
      // media duration before any AI call.
      await base44.functions.invoke('processLectureRecording', {
        action: 'preflight',
        duration_seconds: durationSeconds,
      });

      // pendingLectureId can be a tick behind (recoverSession seeds both in
      // the same render), so the ref is the source of truth here.
      let lectureId = pendingLectureIdRef.current || pendingLectureId;

      // The server may have finished while the client wasn't watching — a
      // refresh, a closed tab, a dead poll. Ask before doing anything
      // expensive; re-processing would charge for work already paid for.
      if (lectureId) {
        try {
          const existing = await base44.entities.Lecture.get(lectureId);
          if (existing?.status === LECTURE_COMPLETE) {
            await clearRecording(activeCls.id);
            uploadedPartsRef.current = [];
            setSavedSegmentCount(0);
            recoveredBlobRef.current = null;
            setRecoveredBlob(null);
            setPendingLectureId(null);
            pendingLectureIdRef.current = null;
            setProcessing(false);
            setReadyToSave(false);
            setReviewLectureId(lectureId);
            window.dispatchEvent(new Event('cedar-data-changed'));
            return;
          }
        } catch (e) {
          // Can't reach it (deleted, offline) — fall through and process.
        }
      }

      if (!lectureId) {
        const today = new Date().toISOString().split('T')[0];
        const lecture = await base44.entities.Lecture.create({
          class_id: activeCls.id,
          date: today,
          recording_url: parts[0],
          recording_parts: parts.length > 1 ? parts : null,
          duration_seconds: durationSeconds,
          // 'pending' — the server flips to 'processing' when it claims the
          // work (a 'processing' create looked like an in-flight run).
          status: 'pending',
        });
        lectureId = lecture.id;
        setPendingLectureId(lectureId);
        pendingLectureIdRef.current = lectureId;
        // Write the id next to the audio before doing anything else. If the
        // student closes the tab one second from now, the next attempt finds
        // this lecture and resumes it instead of creating another.
        await saveRecording(activeCls.id, new Blob([], { type: 'audio/webm' }), {
          seconds: durationSeconds,
          timestamp: Date.now(),
          parts,
          lectureId,
        });
      }

      await base44.functions.invoke('processLectureRecording', { lecture_id: lectureId });
      await waitForLectureProcessing(lectureId);

      if (liveNotes.trim()) {
        try {
          await base44.entities.Note.create({
            lecture_id: lectureId,
            class_id: activeCls.id,
            content: liveNotes.trim(),
          });
        } catch (e) { /* non-fatal: the recording itself is safely saved */ }
      }
      await clearRecording(activeCls.id);
      uploadedPartsRef.current = [];
      setSavedSegmentCount(0);
      setPendingLectureId(null);
      pendingLectureIdRef.current = null;
      setProcessing(false);
      setReadyToSave(false);
      setReviewLectureId(lectureId);
      // Any page showing lectures refreshes (Home, ClassDetail, planner).
      window.dispatchEvent(new Event('cedar-data-changed'));
      return;
    } catch (e) {
      // Keep the durable copy, uploaded parts, and pending lecture id so a
      // retry never re-uploads or double-creates.
      if (e?.response?.status === 402) {
        openUpgrade({ source: 'out-of-credits' });
        setSaveError(e?.response?.data?.message || 'You are out of credits. Your recording is saved on this device.');
      } else {
        const detail = e?.response?.data?.message || e?.response?.data?.error || e?.message;
        setSaveError(detail || 'Check your connection and try again.');
      }
    }
    setProcessing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLectureId, liveNotes, openUpgrade]);

  const discard = useCallback(async () => {
    const activeCls = clsRef.current;
    const orphans = [...uploadedPartsRef.current];
    if (activeCls) await clearRecording(activeCls.id);
    uploadedPartsRef.current = [];
    setSavedSegmentCount(0);
    setReadyToSave(false);
    setSeconds(0);
    secondsRef.current = 0;
    setSaveError('');
    setRecoveredBlob(null);
    recoveredBlobRef.current = null;
    setPendingLectureId(null);
    pendingLectureIdRef.current = null;
    setLiveNotes('');
    setCls(null);
    clsRef.current = null;
    await deleteOrphanedParts(orphans);
  }, []);

  /** Called when the post-processing review prompt is done: session over. */
  const dismissReview = useCallback(() => {
    setReviewLectureId(null);
    setCls(null);
    clsRef.current = null;
    setSeconds(0);
    secondsRef.current = 0;
    setSavedSegmentCount(0);
    setLiveNotes('');
    setSaveError('');
    setReadyToSave(false);
  }, []);

  const value = {
    active,
    cls,
    recording,
    paused,
    seconds,
    uploadingSegment,
    savedSegmentCount,
    readyToSave,
    processing,
    reviewLectureId,
    saveError,
    liveNotes,
    recordingLimitReached,
    recoveredBlob,
    start,
    togglePause,
    stop,
    saveAndProcess,
    discard,
    dismissReview,
    recoverSession,
    setLiveNotes,
  };

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

/** Look up a crashed session for a class without touching provider state. */
export async function findRecoverableRecording(classId) {
  const rec = await getRecording(classId);
  if (!rec) return null;
  const parts = Array.isArray(rec.parts) ? rec.parts : [];
  if ((!rec.blob || rec.blob.size === 0) && parts.length === 0) return null;
  return { ...rec, parts, lectureId: rec.lectureId || null };
}
