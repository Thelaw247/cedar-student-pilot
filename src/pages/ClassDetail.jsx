import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Plus, GraduationCap, Clock, MapPin, Mic, FileText, Loader2, Calendar, AlertCircle, Brain, Headphones, Pencil, AlertTriangle, Search, X, BookOpen, FolderPlus, Pause, Play, Shield, Mail, Check, Archive, RotateCcw, CheckCircle2 } from 'lucide-react';
import EditClassModal from '@/components/EditClassModal';
import ProjectAssignmentModal from '@/components/ProjectAssignmentModal';
import AssignmentEditModal from '@/components/AssignmentEditModal';
import WeekGroupedLectures from '@/components/WeekGroupedLectures';
import ExamPredictionCard from '@/components/ExamPredictionCard';
import HandbookReader from '@/components/HandbookReader';
import PostRecordingReviewPrompt from '@/components/PostRecordingReviewPrompt';
import { saveRecording, getRecording, clearRecording } from '@/lib/recordingStore';
import { getSetting } from '@/lib/settings';

export default function ClassDetail() {
  const { classId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cls, setCls] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tab can arrive via URL (?tab=assignments), e.g. from the "What Matters
  // Today" priority card — falls back to 'lectures' exactly as before when
  // no query param is present, so normal in-app navigation is unaffected.
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'lectures');
  const [showEdit, setShowEdit] = useState(false);
  // Deep-linked assignment to scroll to / highlight once the Assignments tab
  // is showing (also from the "What Matters Today" priority card).
  const highlightAssignmentId = searchParams.get('assignmentId') || null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const c = await base44.entities.Class.get(classId);
      setCls(c);
      const [lecs, asgns, covs] = await Promise.all([
        base44.entities.Lecture.filter({ class_id: classId }, '-date'),
        base44.entities.Assignment.filter({ class_id: classId }, 'due_date'),
        base44.entities.KnowledgeCoverage.filter({ class_id: classId }),
      ]);
      setLectures(lecs);
      setAssignments(asgns);
      setCoverage(covs);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [classId]);

  useEffect(() => { loadData(); }, [loadData]);

  const changeTab = (t) => {
    setTab(t);
    // Once the person navigates manually, drop the deep-link params so they
    // don't stick around (e.g. re-highlighting after switching away and back).
    if (searchParams.get('tab') || searchParams.get('assignmentId')) {
      searchParams.delete('tab');
      searchParams.delete('assignmentId');
      setSearchParams(searchParams, { replace: true });
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;
  if (!cls) return <div className="p-6 text-center text-muted-foreground">Class not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to="/classes" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Classes
      </Link>

      {/* Class header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: (cls.color || '#3B82F6') + '20', color: cls.color || '#3B82F6' }}>
          <GraduationCap className="w-7 h-7" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          {cls.course_code && <p className="text-xs font-semibold text-primary mb-0.5">{cls.course_code}</p>}
          <h1 className="font-heading text-xl sm:text-2xl font-bold">{cls.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            {cls.instructor && <span>{cls.instructor}</span>}
            {cls.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cls.room}</span>}
            {cls.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{cls.start_time}–{cls.end_time}</span>}
            {cls.days_of_week && <span>{cls.days_of_week.join(', ')}</span>}
          </div>
        </div>
        <button onClick={() => setShowEdit(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-hide">
        {['lectures', 'assignments', 'handbook', 'study'].map(t => (
          <button key={t} onClick={() => changeTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'study' ? 'Practice' : t}
          </button>
        ))}
      </div>

      {tab === 'lectures' && (
        <LectureTab lectures={lectures} coverage={coverage} classId={classId} cls={cls} onUpdate={loadData} autoRecord={searchParams.get('record') === '1'} onAutoRecordConsumed={() => { searchParams.delete('record'); setSearchParams(searchParams, { replace: true }); }} />
      )}
      {tab === 'assignments' && (
        <AssignmentTab assignments={assignments} classId={classId} cls={cls} onUpdate={loadData} highlightAssignmentId={highlightAssignmentId} />
      )}
      {tab === 'handbook' && (
        <HandbookTab cls={cls} lectures={lectures} />
      )}
      {tab === 'study' && (
        <div>
          <ExamPredictionCard classId={classId} />
          <StudyTab classId={classId} cls={cls} lectures={lectures} onUpdate={loadData} />
        </div>
      )}

      {showEdit && (
        <EditClassModal classData={cls} semesterId={cls.semester_id} onClose={() => { setShowEdit(false); loadData(); }} />
      )}
    </div>
  );
}

function LectureTab({ lectures, coverage, classId, cls, onUpdate, autoRecord, onAutoRecordConsumed }) {
  // ?record=1 is how ClassStatusBar (the persistent header widget) starts a
  // recording from anywhere in the app: it navigates here rather than
  // duplicating RecordModal's MediaRecorder + consent-gate logic. This opens
  // the SAME modal a manual click on "Record" opens — no separate code path.
  const [showRecord, setShowRecord] = useState(!!autoRecord);
  useEffect(() => {
    if (autoRecord) onAutoRecordConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [searchQuery, setSearchQuery] = useState('');

  // Build coverage map: lectureId → coverage record
  const coverageMap = (() => {
    const map = {};
    for (const c of coverage) {
      if (c.lecture_id) map[c.lecture_id] = c;
    }
    return map;
  })();

  const filteredLectures = (() => {
    if (!searchQuery.trim()) return lectures;
    const q = searchQuery.toLowerCase();
    const instructor = cls?.instructor || '';
    return lectures.filter(l => {
      const fields = [
        l.ai_title || '',
        l.ai_summary || '',
        l.transcript || '',
        (l.ai_concepts || []).join(' '),
        (l.ai_vocabulary || []).join(' '),
        l.date || '',
        l.actual_instructor || '',
        instructor,
      ];
      return fields.some(f => f.toLowerCase().includes(q));
    });
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{lectures.length} lecture{lectures.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Mic className="w-4 h-4" /> Record
        </button>
      </div>

      {/* Search within class lectures */}
      {lectures.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search lectures, topics, transcripts, instructors..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              {filteredLectures.length} match{filteredLectures.length !== 1 ? 'es' : ''} for "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {lectures.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Mic className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No lectures recorded yet.</p>
          <button onClick={() => setShowRecord(true)} className="text-sm text-primary font-medium mt-2 hover:underline">Record your first lecture</button>
        </div>
      ) : filteredLectures.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Search className="w-6 h-6 text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No lectures match "{searchQuery}"</p>
        </div>
      ) : (
        <WeekGroupedLectures
          lectures={filteredLectures}
          coverageMap={coverageMap}
          allClassLectures={lectures}
          cls={cls}
          defaultInstructor={cls?.instructor}
          onUpdate={onUpdate}
          searchQuery={searchQuery}
        />
      )}

      {showRecord && <RecordModal classId={classId} cls={cls} onClose={() => { setShowRecord(false); onUpdate(); }} />}
    </div>
  );
}

// Lecture processing is asynchronous: the server acknowledges with 202 and
// transcribes/analyzes in the background (a long lecture takes minutes —
// longer than a browser reliably holds one request open). Poll the lecture
// row until it leaves 'processing'. 'complete' resolves; 'pending' means the
// server hit an error and released the recording for another attempt.
const PROCESS_POLL_MS = 5000;
const PROCESS_POLL_LIMIT_MS = 45 * 60 * 1000; // generous ceiling for multi-hour recordings

async function waitForLectureProcessing(lectureId) {
  const deadline = Date.now() + PROCESS_POLL_LIMIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, PROCESS_POLL_MS));
    let lecture = null;
    try {
      lecture = await base44.entities.Lecture.get(lectureId);
    } catch {
      continue; // transient network hiccup — keep polling
    }
    if (lecture?.status === 'complete') return lecture;
    if (lecture?.status && lecture.status !== 'processing') {
      throw new Error("Processing didn't finish. Your recording is saved — tap Save & Process to try again.");
    }
  }
  throw new Error('Processing is taking unusually long. Your recording is saved — please try again shortly.');
}

function RecordModal({ classId, cls, onClose }) {
  // Each segment must stay under the transcription provider's per-file limit
  // (Groq's free tier: 25 MB). 32 kbps Opus keeps a 90-minute segment
  // comfortably inside that, so segments rotate at 90 minutes; a lecture can
  // now run up to the 6-hour absolute ceiling by chaining several segments
  // behind the scenes instead of being cut off at 90 minutes.
  const MAX_SEGMENT_BYTES = 24 * 1024 * 1024;
  const RECORDING_AUDIO_BITS_PER_SECOND = 32_000;
  const SEGMENT_ROTATE_SECONDS = 90 * 60;
  const MAX_TOTAL_SECONDS = 6 * 60 * 60;
  const MAX_UPLOAD_ATTEMPTS = 3;

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploadingSegment, setUploadingSegment] = useState(false);
  const [savedSegmentCount, setSavedSegmentCount] = useState(0);
  const [readyToSave, setReadyToSave] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(null);
  const [reviewLectureId, setReviewLectureId] = useState(null);
  const [recoveredBlob, setRecoveredBlob] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [pendingLectureId, setPendingLectureId] = useState(null);
  const [liveNotes, setLiveNotes] = useState('');
  const [recordingLimitReached, setRecordingLimitReached] = useState(false);

  // Recording-consent gate. Every Canadian university policy requires a student
  // to have the instructor's permission before recording a lecture. We hold a
  // one-time, per-class attestation on the Class record so the student confirms
  // this once per course, not every session. `consentConfirmed` starts true if
  // the class already has consent on file.
  const [consentConfirmed, setConsentConfirmed] = useState(!!cls?.recording_consent_confirmed);
  const [consentChecked, setConsentChecked] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  const confirmConsent = async () => {
    setSavingConsent(true);
    try {
      // Persist the attestation with a dated timestamp so there's a record the
      // student confirmed permission for this specific class.
      await base44.entities.Class.update(classId, {
        recording_consent_confirmed: true,
        recording_consent_date: new Date().toISOString().split('T')[0],
      });
      setConsentConfirmed(true);
    } catch (e) {
      // Non-fatal: allow the session to proceed even if the flag didn't persist,
      // since the student has still actively attested here.
      setConsentConfirmed(true);
    }
    setSavingConsent(false);
  };

  const emailInstructorForPermission = () => {
    const className = cls?.name || 'your class';
    const subject = encodeURIComponent(`Permission to record lectures — ${className}`);
    const body = encodeURIComponent(
      `Hi Professor ${cls?.instructor || ''},\n\n` +
      `I'd like to ask for your permission to make audio recordings of your ${className} lectures for my own personal study use only. ` +
      `The recordings would stay private to me and would not be shared with anyone else or posted anywhere.\n\n` +
      `Please let me know if that's alright with you, or if you have any conditions I should follow.\n\n` +
      `Thank you very much,\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Live refs for the recorder callbacks (avoid stale closures).
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]); // chunks for the segment currently being captured
  const secondsRef = useRef(0); // total elapsed seconds across every segment
  const segmentSecondsRef = useRef(0); // elapsed seconds in the current segment only
  const uploadedPartsRef = useRef([]); // r2:// refs already uploaded, in order
  const pendingFinalBlobRef = useRef(null); // the last-recorded, not-yet-uploaded segment
  const rotatingRef = useRef(false); // guards against double-rotation from timer + manual stop racing

  // Crash recovery: on mount, look for a durably-persisted recording with REAL
  // audio (IndexedDB), not just leftover metadata. If found, we can recover the
  // actual audio (plus any segments already uploaded before the crash) rather
  // than only logging a missed lecture.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = await getRecording(classId);
      if (!cancelled && rec) {
        const parts = Array.isArray(rec.parts) ? rec.parts : [];
        setRecoveryAvailable({ seconds: rec.seconds || 0, timestamp: rec.timestamp, parts });
        setRecoveredBlob(rec.blob);
        uploadedPartsRef.current = parts;
        setSavedSegmentCount(parts.length);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  // Best-effort delete of segments already uploaded to R2 but not (yet) linked
  // to any Lecture row — otherwise progressive per-segment upload would leak
  // orphaned objects whenever a recording in progress is abandoned.
  const deleteOrphanedParts = async (refs) => {
    if (!refs?.length || !base44.files?.delete) return;
    await Promise.all(refs.map((ref) => base44.files.delete(ref).catch((err) => {
      console.error('Could not clean up an orphaned recording segment', err);
    })));
  };

  const clearRecovery = async () => {
    const orphans = recoveryAvailable?.parts || [];
    await clearRecording(classId);
    setRecoveryAvailable(null);
    setRecoveredBlob(null);
    uploadedPartsRef.current = [];
    setSavedSegmentCount(0);
    await deleteOrphanedParts(orphans);
  };

  // Upload one finished segment, retrying transient failures. Throws if every
  // attempt fails so the caller can stop the recording and offer a retry
  // rather than silently losing the segment.
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
      // MIME type itself is supported. Continue with the browser default;
      // the per-segment size check still prevents an unprocessable upload.
      recorder = new MediaRecorder(stream);
    }
    chunksRef.current = [];
    segmentSecondsRef.current = 0;
    // Fires roughly every 15s because of the timeslice below. Each event we
    // append the new slice and flush the segment-so-far to IndexedDB (tagged
    // with the segments already safely uploaded), so a crash loses at most
    // ~15s of the current segment, and previously uploaded segments are never
    // re-recorded.
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        saveRecording(classId, blob, {
          seconds: secondsRef.current,
          timestamp: Date.now(),
          parts: uploadedPartsRef.current,
        });
      }
    };
    recorder.start(15000);
    recorderRef.current = recorder;
  };

  useEffect(() => {
    let interval;
    // Only tick while actively recording (not while paused).
    if (recording && !paused) {
      interval = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          segmentSecondsRef.current += 1;
          if (next >= MAX_TOTAL_SECONDS) {
            // Absolute ceiling reached — finalize everything, no more segments.
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      uploadedPartsRef.current = [];
      setSavedSegmentCount(0);
      setRecoveredBlob(null);
      setRecoveryAvailable(null);
      setReadyToSave(false);
      setRecordingLimitReached(false);
      setSeconds(0);
      secondsRef.current = 0;
      startSegment();
      setRecording(true);
      setPaused(false);
    } catch (e) {
      alert('Could not access microphone. Please grant permission.');
    }
  };

  // Pause / resume without finalizing the current segment. MediaRecorder keeps
  // the captured audio; we just stop the clock and the mic from accumulating.
  const togglePause = () => {
    if (!recorderRef.current) return;
    if (paused) {
      try { recorderRef.current.resume(); } catch (e) {}
      setPaused(false);
    } else {
      // Flush what we have so the durable copy is current at the pause point.
      try { recorderRef.current.requestData(); } catch (e) {}
      try { recorderRef.current.pause(); } catch (e) {}
      setPaused(true);
    }
  };

  // Stops the current segment's recorder and resolves once its audio Blob is
  // ready. Does not itself upload or start a new segment — callers decide.
  const stopCurrentSegment = () => new Promise((resolve) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      return;
    }
    recorder.onstop = () => {
      resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
    };
    if (paused) { try { recorder.resume(); } catch (e) {} }
    try { recorder.requestData(); } catch (e) {}
    try { recorder.stop(); } catch (e) { resolve(new Blob(chunksRef.current, { type: 'audio/webm' })); }
  });

  // Rotates to a new segment mid-recording (90-minute boundary): finalizes and
  // uploads the just-finished segment in the background, then immediately
  // starts capturing the next one on the same open mic stream so nothing is
  // missed while the upload is in flight.
  const rotateSegment = async () => {
    if (rotatingRef.current || !recording) return;
    rotatingRef.current = true;
    try {
      const blob = await stopCurrentSegment();
      startSegment(); // keep capturing immediately, don't wait on the upload
      const ref = await uploadSegmentWithRetry(blob);
      uploadedPartsRef.current = [...uploadedPartsRef.current, ref];
      setSavedSegmentCount(uploadedPartsRef.current.length);
      // Update the durable copy so a crash after this point recovers with
      // this segment already marked uploaded, never re-uploading it.
      const currentBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await saveRecording(classId, currentBlob, {
        seconds: secondsRef.current,
        timestamp: Date.now(),
        parts: uploadedPartsRef.current,
      });
    } catch (e) {
      // Could not save this segment after retries — stop the recording
      // entirely rather than risk losing more audio; the failed segment's
      // blob is preserved locally and offered for a manual retry via the
      // regular save flow.
      pendingFinalBlobRef.current = null;
      try { recorderRef.current?.stop(); } catch (err) {}
      setRecording(false);
      setPaused(false);
      setSaveError('A recording segment could not be uploaded. Check your connection, then try saving again — your audio is safe on this device.');
      setReadyToSave(true);
    } finally {
      rotatingRef.current = false;
    }
  };

  // Finalizes the whole recording: stops the current segment, uploads it, and
  // moves to the "ready to save" screen. Used both for a manual Stop and for
  // hitting the 6-hour absolute ceiling.
  const finalizeRecording = async ({ hitAbsoluteLimit = false } = {}) => {
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
      await saveRecording(classId, new Blob([], { type: 'audio/webm' }), {
        seconds: secondsRef.current,
        timestamp: Date.now(),
        parts: uploadedPartsRef.current,
      });
      setReadyToSave(true);
    } catch (e) {
      setSaveError('Could not finish uploading the last part of this recording. Your audio is safe on this device — try saving again.');
      setReadyToSave(true);
    }
    setUploadingSegment(false);
    rotatingRef.current = false;
  };

  const stopRecording = () => { finalizeRecording(); };

  const saveAndProcess = async () => {
    setProcessing(true);
    setSaveError('');
    try {
      // Recovering from a previous session: the recovered blob is the one
      // segment that hadn't finished uploading yet. Upload it now, appended
      // after whatever segments were already uploaded before the crash.
      if (recoveredBlob && recoveredBlob.size > 0 && uploadedPartsRef.current.length === (recoveryAvailable?.parts?.length || 0)) {
        const ref = await uploadSegmentWithRetry(recoveredBlob);
        uploadedPartsRef.current = [...uploadedPartsRef.current, ref];
        setSavedSegmentCount(uploadedPartsRef.current.length);
      }

      const parts = uploadedPartsRef.current;
      if (!parts.length) throw new Error('The recording is empty. Please record it again.');

      const durationSeconds = seconds || recoveryAvailable?.seconds || 0;

      // Check the estimated Cedar-credit cost before creating the Lecture. The
      // backend independently verifies the real media duration before any AI
      // call, so this only avoids wasting effort when the known balance is low.
      await base44.functions.invoke('processLectureRecording', {
        action: 'preflight',
        duration_seconds: durationSeconds,
      });

      let lectureId = pendingLectureId;
      if (!lectureId) {
        const today = new Date().toISOString().split('T')[0];
        const lecture = await base44.entities.Lecture.create({
          class_id: classId,
          date: today,
          recording_url: parts[0],
          // recording_parts is only set for a lecture actually split into more
          // than one segment; a single-segment recording keeps behaving exactly
          // like before, driven entirely by recording_url.
          recording_parts: parts.length > 1 ? parts : null,
          // Display estimate only. The processing function replaces this with
          // duration parsed from the stored media before calculating the bill.
          duration_seconds: durationSeconds,
          // 'pending' — the server flips it to 'processing' when it actually
          // claims the work. Creating it as 'processing' made a brand-new row
          // look like a run already in flight, so processing never started.
          status: 'pending',
        });
        lectureId = lecture.id;
        setPendingLectureId(lectureId);
      }

      // The backend resolves the audio URL(s) from the owned Lecture record;
      // the browser no longer supplies a URL that could be swapped or forged.
      // It answers 202 as soon as the job is accepted, so wait by polling the
      // lecture row rather than holding one long HTTP request open.
      await base44.functions.invoke('processLectureRecording', { lecture_id: lectureId });
      await waitForLectureProcessing(lectureId);

      // Save any notes typed during the lecture as a separate Note record tied
      // to this lecture. Kept distinct from the transcript, and the handbook
      // already surfaces per-lecture notes alongside it.
      if (liveNotes.trim()) {
        try {
          await base44.entities.Note.create({
            lecture_id: lectureId,
            class_id: classId,
            content: liveNotes.trim(),
          });
        } catch (e) { /* non-fatal: the recording itself is safely saved */ }
      }
      // Uploaded and processed successfully — the durable copy is no longer
      // needed, so clear it and move on to offer spaced reviews.
      await clearRecording(classId);
      setPendingLectureId(null);
      setProcessing(false);
      setReviewLectureId(lectureId);
      return;
    } catch (e) {
      // Keep the durable copy, uploaded parts, and pending lecture id so a
      // retry does not re-upload segments or create a second Lecture after a
      // processing failure.
      const detail = e?.response?.data?.message || e?.response?.data?.error || e?.message;
      setSaveError(detail || 'Check your connection and try again.');
    }
    setProcessing(false);
  };

  const discardRecording = async () => {
    const orphans = [...uploadedPartsRef.current];
    await clearRecording(classId);
    uploadedPartsRef.current = [];
    setSavedSegmentCount(0);
    setReadyToSave(false);
    setSeconds(0);
    setSaveError('');
    await deleteOrphanedParts(orphans);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // After processing, show the review-scheduling prompt in place of the modal.
  if (reviewLectureId) {
    return (
      <PostRecordingReviewPrompt
        classId={classId}
        lectureId={reviewLectureId}
        onDone={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
      <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full mx-4 text-center animate-fade-in">
        {/* Crash recovery banner — real audio was recovered from IndexedDB */}
        {recoveryAvailable && recoveredBlob && !recording && !readyToSave && !saveError && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Unsaved recording found</p>
                <p className="text-xs text-muted-foreground mt-1">A recording for this class (about {formatTime(recoveryAvailable.seconds)}) didn't finish saving last time. The audio is safe — you can save it now.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveAndProcess}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                    Recover &amp; save
                  </button>
                  <button onClick={clearRecovery}
                    className="py-2 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save failed — audio is preserved, offer a retry */}
        {saveError && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Couldn't save the recording</p>
                <p className="text-xs text-muted-foreground mt-1">Your audio is safely stored on this device — nothing was lost. {saveError}</p>
                <button onClick={saveAndProcess} disabled={processing}
                  className="mt-3 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {processing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Trying again…</> : 'Try again'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Consent gate — shown once per class before the first recording.
            Recordings are private to this student and are never shared, but
            university policy still requires the instructor's permission to
            record at all, so we confirm that up front. */}
        {!recording && !readyToSave && !recoveredBlob && !saveError && !consentConfirmed && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-1">Before you record</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Most instructors are glad to allow it, but recording a lecture needs their permission first. Your recordings stay private to you — they're never shared with classmates or anyone else.
            </p>

            <button
              onClick={() => setConsentChecked(v => !v)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors mb-3 ${consentChecked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
            >
              <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors ${consentChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                {consentChecked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <span className="text-sm text-foreground">
                I have my instructor's permission to record {cls?.name ? <span className="font-medium">{cls.name}</span> : 'this class'}, and I'll keep the recording for my own study use only.
              </span>
            </button>

            <button
              onClick={confirmConsent}
              disabled={!consentChecked || savingConsent}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingConsent ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</> : 'Confirm & continue'}
            </button>

            <button
              onClick={emailInstructorForPermission}
              className="mt-2 w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" /> Email my instructor to ask
            </button>

            <button onClick={onClose} className="mt-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </>
        )}

        {!recording && !readyToSave && !recoveredBlob && !saveError && consentConfirmed && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-1">Record Lecture</h3>
            <p className="text-sm text-muted-foreground mb-2">Tap to start recording. AI will transcribe and summarize automatically.</p>
            <p className="text-xs text-muted-foreground mb-2">Long lectures are split into segments automatically behind the scenes — just keep recording for up to 6 hours in one session.</p>
            {cls?.recording_consent_date && (
              <p className="text-[11px] text-muted-foreground mb-6 inline-flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-600" /> Permission confirmed for this class
              </p>
            )}
            <button onClick={startRecording} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Start Recording</button>
            <button onClick={onClose} className="mt-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </>
        )}
        {recording && (
          <>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 relative ${paused ? 'bg-muted' : 'bg-destructive/10'}`}>
              {!paused && <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping"></span>}
              <Mic className={`w-8 h-8 relative ${paused ? 'text-muted-foreground' : 'text-destructive'}`} />
            </div>
            <p className="font-heading text-3xl font-bold tabular-nums mb-1">{formatTime(seconds)}</p>
            <p className="text-sm text-muted-foreground mb-1">{paused ? 'Paused' : 'Recording in progress…'}</p>
            {savedSegmentCount > 0 && (
              <p className="text-xs text-muted-foreground mb-4">{savedSegmentCount} segment{savedSegmentCount === 1 ? '' : 's'} saved so far</p>
            )}

            <div className="flex gap-2 mb-5">
              <button onClick={togglePause}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted flex items-center justify-center gap-2">
                {paused ? <><Play className="w-4 h-4" fill="currentColor" /> Resume</> : <><Pause className="w-4 h-4" fill="currentColor" /> Pause</>}
              </button>
              <button onClick={stopRecording}
                className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90">
                Stop
              </button>
            </div>

            {/* Live notes — jot cues while the lecture runs. Saved as a separate
                note on the lecture (shown alongside the transcript later). */}
            <div className="text-left">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Pencil className="w-3 h-3" /> Your notes &amp; cues
              </label>
              <textarea
                value={liveNotes}
                onChange={e => setLiveNotes(e.target.value)}
                placeholder="Jot down anything the prof emphasizes, questions to revisit, page numbers… saved with this lecture."
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                rows={4}
              />
            </div>
          </>
        )}
        {!recording && readyToSave && !saveError && (
          <>
            {uploadingSegment ? (
              <>
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
                <h3 className="font-heading text-lg font-semibold mb-1">Finishing upload…</h3>
                <p className="text-sm text-muted-foreground">Saving the last part of your recording.</p>
              </>
            ) : processing ? (
              <>
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
                <h3 className="font-heading text-lg font-semibold mb-1">Processing Lecture...</h3>
                <p className="text-sm text-muted-foreground">AI is transcribing and analyzing your recording.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-1">Recording Complete</h3>
                <p className="text-sm text-muted-foreground mb-1">{formatTime(seconds)} of audio captured</p>
                {savedSegmentCount > 1 && (
                  <p className="text-xs text-muted-foreground mb-4">Saved as {savedSegmentCount} segments</p>
                )}
                {recordingLimitReached && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">The 6-hour recording limit was reached. Save this recording, then start a new one if the class is continuing.</p>
                )}
                <div className="flex gap-2">
                  <button onClick={discardRecording} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Discard</button>
                  <button onClick={saveAndProcess} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Save & Process</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AssignmentTab({ assignments, classId, cls, onUpdate, highlightAssignmentId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editAssignment, setEditAssignment] = useState(null);
  // Tracks which assignment+action is in flight, e.g. "abc123:completed", so
  // only the button being pressed shows a spinner.
  const [resolvingKey, setResolvingKey] = useState(null);
  const cardRefs = useRef({});

  const typeColors = {
    exam: 'bg-rose-500/10 text-rose-600',
    quiz: 'bg-amber-500/10 text-amber-600',
    project: 'bg-purple-500/10 text-purple-600',
    assignment: 'bg-blue-500/10 text-blue-600',
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const statusOf = (a) => a.status || 'active';
  const isPastDue = (a) => statusOf(a) === 'active' && a.due_date && a.due_date < todayStr;

  const activeAssignments = assignments.filter(a => statusOf(a) !== 'archived');
  const archivedAssignments = assignments.filter(a => statusOf(a) === 'archived');

  // If a deep-linked assignment lives in the archived section, auto-expand it
  // so it's actually visible to scroll to.
  useEffect(() => {
    if (highlightAssignmentId && archivedAssignments.some(a => a.id === highlightAssignmentId)) {
      setShowArchived(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightAssignmentId]);

  // Scroll the deep-linked assignment into view once it's rendered.
  useEffect(() => {
    if (highlightAssignmentId && cardRefs.current[highlightAssignmentId]) {
      cardRefs.current[highlightAssignmentId].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightAssignmentId, activeAssignments.length, archivedAssignments.length]);

  const resolve = async (assignmentId, action) => {
    setResolvingKey(assignmentId + ':' + action);
    try {
      await base44.functions.invoke('resolveAssignment', { assignment_id: assignmentId, action });
      onUpdate();
    } catch (e) {
      alert('Could not update the assignment. Please try again.');
    }
    setResolvingKey(null);
  };

  const renderCard = (a) => {
    const status = statusOf(a);
    const pastDue = isPastDue(a);
    const completed = status === 'completed';
    const archived = status === 'archived';
    const resolved = completed || archived;
    const busy = resolvingKey !== null;
    const highlighted = highlightAssignmentId === a.id;

    return (
      <div key={a.id} ref={el => { cardRefs.current[a.id] = el; }}
        className={`rounded-xl border bg-card p-4 transition-all ${pastDue ? 'border-amber-500/40' : 'border-border'} ${resolved ? 'opacity-70' : ''} ${highlighted ? 'ring-2 ring-primary/50' : ''}`}>
        {/* Card body — click to open the edit modal (title, due date, sessions) */}
        <button type="button" onClick={() => setEditAssignment(a)} className="w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-foreground">{a.title}</h3>
                {completed && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                  </span>
                )}
                {archived && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                    <Archive className="w-2.5 h-2.5" /> Archived
                  </span>
                )}
                {pastDue && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600">
                    <AlertTriangle className="w-2.5 h-2.5" /> Past due
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Due {a.due_date}</p>
              {a.type === 'project' && a.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.description}</p>
              )}
              {a.type === 'project' && a.roadmap && a.roadmap.length > 0 && (
                <p className="text-[10px] text-primary mt-1 font-medium">{a.roadmap.length}-step roadmap</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase ${typeColors[a.type]}`}>{a.type}</span>
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        </button>

        {/* Past-due prompt — resolve the deadline and clear its leftover sessions */}
        {pastDue && (
          <div className="mt-3 pt-3 border-t border-amber-500/20">
            <p className="text-[11px] text-muted-foreground mb-2">
              This deadline has passed. Resolving it also clears the study sessions still scheduled for it.
            </p>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); resolve(a.id, 'completed'); }} disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                {resolvingKey === a.id + ':completed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark done
              </button>
              <button onClick={(e) => { e.stopPropagation(); resolve(a.id, 'archived'); }} disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted disabled:opacity-50">
                {resolvingKey === a.id + ':archived' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} Archive
              </button>
            </div>
          </div>
        )}

        {/* Resolved — allow reactivating if it was closed by mistake */}
        {resolved && (
          <div className="mt-3 pt-3 border-t border-border">
            <button onClick={(e) => { e.stopPropagation(); resolve(a.id, 'reactivate'); }} disabled={busy}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
              {resolvingKey === a.id + ':reactivate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Reactivate
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{activeAssignments.length} assignment{activeAssignments.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add
          </button>
          <button onClick={() => setShowProject(true)} className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
            <FolderPlus className="w-4 h-4" /> Project
          </button>
        </div>
      </div>

      {activeAssignments.length === 0 && archivedAssignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-3">No assignments yet. Add exams, quizzes, or deadlines to generate study plans.</p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add assignment
          </button>
        </div>
      ) : activeAssignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Check className="w-6 h-6 text-emerald-600 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">You're all caught up — no active assignments.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeAssignments.map(renderCard)}
        </div>
      )}

      {/* Archived assignments — hidden by default */}
      {archivedAssignments.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? 'Hide' : 'Show'} archived ({archivedAssignments.length})
          </button>
          {showArchived && (
            <div className="space-y-2 mt-2">
              {archivedAssignments.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddAssignmentModal classId={classId} onClose={() => { setShowAdd(false); onUpdate(); }} />}
      {showProject && <ProjectAssignmentModal classId={classId} className={cls?.name} onClose={() => { setShowProject(false); onUpdate(); }} />}
      {editAssignment && (
        <AssignmentEditModal
          assignment={editAssignment}
          onClose={() => setEditAssignment(null)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

function StudyTab({ classId, cls, lectures, onUpdate }) {
  const [showMissedConfirm, setShowMissedConfirm] = useState(false);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Link to={`/planner?tab=practice&classId=${classId}`}
          className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Practice</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Flashcards, quizzes, and practice tests for this class</p>
        </Link>
        <Link to={`/planner?tab=plan&classId=${classId}`}
          className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Plan &amp; review</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Review lectures, set a test, and plan study sessions</p>
        </Link>
        <Link to="/focus"
          className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
            <Headphones className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Focus session</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Classical music and a timer</p>
        </Link>
      </div>

      <div className="rounded-xl border border-dashed border-border p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">Missed a Lecture?</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">Generate an AI-estimated summary based on previous lectures and course progression.</p>
            <button onClick={() => setShowMissedConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm font-medium text-amber-700 dark:text-amber-500 hover:bg-amber-500/10">
              Generate Missed Lecture Summary
            </button>
          </div>
        </div>
      </div>

      {showMissedConfirm && (
        <MissedLectureConfirmModal
          classId={classId}
          onClose={() => setShowMissedConfirm(false)}
          onGenerated={() => { setShowMissedConfirm(false); onUpdate(); }}
        />
      )}
    </div>
  );
}

function MissedLectureConfirmModal({ classId, onClose, onGenerated }) {
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  const confirmGenerate = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateMissedLectureSummary', {
        class_id: classId,
        date: new Date().toISOString().split('T')[0],
        guidance_notes: notes.trim() || undefined,
      });
      onGenerated();
    } catch (e) {
      alert('Failed to generate missed lecture summary. Please try again.');
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">Generate Missed Lecture Summary?</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-500">
            This creates a new lecture entry with AI-estimated content based on your previous lectures — it doesn't reflect what was actually taught. It'll be clearly labelled as AI-estimated.
          </p>
        </div>

        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          Notes on what was actually covered <span className="font-normal">(optional)</span>
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. we covered chapters 4–5 and did a group problem set on integration by parts"
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none mb-4"
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground -mt-3 mb-4">Anything you add here guides the AI's estimate alongside your course's previous lectures.</p>

        <div className="flex gap-2">
          <button onClick={onClose} disabled={generating}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button onClick={confirmGenerate} disabled={generating}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : 'Confirm & Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HandbookTab({ cls, lectures }) {
  const [showReader, setShowReader] = useState(false);

  const lecturesWithContent = lectures.filter(l => l.ai_summary || l.transcript || (l.ai_concepts && l.ai_concepts.length > 0));

  return (
    <div>
      {/* Handbook preview card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
        <div className="p-6 text-center" style={{ backgroundColor: (cls.color || '#3B82F6') + '08' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: (cls.color || '#3B82F6') + '20' }}>
            <BookOpen className="w-8 h-8" style={{ color: cls.color || '#3B82F6' }} strokeWidth={1.5} />
          </div>
          <h2 className="font-heading text-xl font-bold mb-1" style={{ color: cls.color || '#3B82F6' }}>{cls.name}</h2>
          {cls.instructor && <p className="text-sm text-muted-foreground">by Prof. {cls.instructor}</p>}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-2">Class Handbook</p>
        </div>
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">{lecturesWithContent.length} chapter{lecturesWithContent.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowReader(true)} disabled={lecturesWithContent.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <BookOpen className="w-4 h-4" /> Open Handbook
            </button>
          </div>
          {lecturesWithContent.length === 0 ? (
            <div className="flex items-center gap-2 justify-center py-4">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">No chapters yet. Record and process lectures to generate the handbook.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {lecturesWithContent.slice(0, 5).map((lec, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground tabular-nums w-5">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-foreground truncate flex-1">{lec.ai_title || `Lecture — ${lec.date}`}</span>
                  <span className="text-muted-foreground">{lec.date}</span>
                </div>
              ))}
              {lecturesWithContent.length > 5 && (
                <p className="text-[10px] text-muted-foreground pl-5">+{lecturesWithContent.length - 5} more chapters...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {showReader && (
        <HandbookReader classId={cls.id} onClose={() => setShowReader(false)} />
      )}
    </div>
  );
}

function AddAssignmentModal({ classId, onClose }) {
  const [form, setForm] = useState({ title: '', due_date: '', type: 'assignment', coverage_scope: 'cumulative' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const assignment = await base44.entities.Assignment.create({ ...form, class_id: classId });
      if (getSetting('autoGenerateSchedules')) {
        await base44.functions.invoke('generateStudySchedule', { assignment_id: assignment.id });
      }
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-semibold mb-4">Add Assignment</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Title (e.g. Midterm Exam)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />
          <input type="date" value={form.due_date}
            onChange={e => setForm({ ...form, due_date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="assignment">Assignment</option>
            <option value="exam">Exam</option>
            <option value="quiz">Quiz</option>
            <option value="project">Project</option>
          </select>
          <select value={form.coverage_scope} onChange={e => setForm({ ...form, coverage_scope: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="cumulative">Cumulative (all lectures)</option>
            <option value="since_last">Since last exam</option>
            <option value="custom">Custom lecture range</option>
          </select>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving || !form.title || !form.due_date} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Planning...</> : 'Add & Plan Study'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
