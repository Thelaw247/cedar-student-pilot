import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Plus, GraduationCap, Clock, MapPin, Mic, FileText, Loader2, Calendar, AlertCircle, Brain, Headphones, Pencil, AlertTriangle, Search, X, BookOpen, FolderPlus } from 'lucide-react';
import EditClassModal from '@/components/EditClassModal';
import ProjectAssignmentModal from '@/components/ProjectAssignmentModal';
import WeekGroupedLectures from '@/components/WeekGroupedLectures';
import ExamPredictionCard from '@/components/ExamPredictionCard';
import HandbookReader from '@/components/HandbookReader';
import PostRecordingReviewPrompt from '@/components/PostRecordingReviewPrompt';
import { saveRecording, getRecording, clearRecording } from '@/lib/recordingStore';
import { getSetting } from '@/lib/settings';

export default function ClassDetail() {
  const { classId } = useParams();
  const [cls, setCls] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('lectures');
  const [showEdit, setShowEdit] = useState(false);

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
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'study' ? 'Practice' : t}
          </button>
        ))}
      </div>

      {tab === 'lectures' && (
        <LectureTab lectures={lectures} coverage={coverage} classId={classId} cls={cls} onUpdate={loadData} />
      )}
      {tab === 'assignments' && (
        <AssignmentTab assignments={assignments} classId={classId} cls={cls} onUpdate={loadData} />
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

function LectureTab({ lectures, coverage, classId, cls, onUpdate }) {
  const [showRecord, setShowRecord] = useState(false);
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

function RecordModal({ classId, onClose }) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(null);
  const [reviewLectureId, setReviewLectureId] = useState(null);
  const [recoveredBlob, setRecoveredBlob] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [liveNotes, setLiveNotes] = useState('');

  // Live refs for the recorder callbacks (avoid stale closures on chunks/seconds).
  const chunksRef = useRef([]);
  const secondsRef = useRef(0);

  // Crash recovery: on mount, look for a durably-persisted recording with REAL
  // audio (IndexedDB), not just leftover metadata. If found, we can recover the
  // actual audio rather than only logging a missed lecture.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = await getRecording(classId);
      if (!cancelled && rec) {
        setRecoveryAvailable({ seconds: rec.seconds || 0, timestamp: rec.timestamp });
        setRecoveredBlob(rec.blob);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  const clearRecovery = async () => {
    await clearRecording(classId);
    setRecoveryAvailable(null);
    setRecoveredBlob(null);
  };

  useEffect(() => {
    let interval;
    // Only tick while actively recording (not while paused).
    if (recording && !paused) {
      interval = setInterval(() => {
        setSeconds(s => {
          const next = s + 1;
          secondsRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recording, paused]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      // Fires roughly every 15s because of the timeslice below. Each event we
      // append the new slice and flush the whole recording-so-far to IndexedDB,
      // so a crash loses at most ~15s, and the persisted copy is valid audio.
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          saveRecording(classId, blob, { seconds: secondsRef.current, timestamp: Date.now() });
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setAudioChunks([...chunksRef.current]);
        // Final flush so the durable copy matches exactly what we captured.
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        saveRecording(classId, blob, { seconds: secondsRef.current, timestamp: Date.now() });
      };
      // Timeslice = periodic ondataavailable → periodic durable flush.
      recorder.start(15000);
      setMediaRecorder(recorder);
      setAudioChunks([]);
      setRecoveredBlob(null);
      setRecoveryAvailable(null);
      setRecording(true);
      setPaused(false);
      setSeconds(0);
      secondsRef.current = 0;
    } catch (e) {
      alert('Could not access microphone. Please grant permission.');
    }
  };

  // Pause / resume without finalizing the recording. MediaRecorder keeps the
  // captured audio; we just stop the clock and the mic from accumulating.
  const togglePause = () => {
    if (!mediaRecorder) return;
    if (paused) {
      try { mediaRecorder.resume(); } catch (e) {}
      setPaused(false);
    } else {
      // Flush what we have so the durable copy is current at the pause point.
      try { mediaRecorder.requestData(); } catch (e) {}
      try { mediaRecorder.pause(); } catch (e) {}
      setPaused(true);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorder) {
      // If paused, resume briefly so stop() flushes cleanly on all browsers.
      if (paused) { try { mediaRecorder.resume(); } catch (e) {} }
      // Ask for any buffered audio before stopping so the last slice isn't lost.
      try { mediaRecorder.requestData(); } catch (e) {}
      mediaRecorder.stop();
      setRecording(false);
      setPaused(false);
    }
  };

  const saveAndProcess = async () => {
    setProcessing(true);
    setSaveError(false);
    try {
      // Work from whichever copy we have: freshly recorded chunks, or a blob
      // recovered from a previous interrupted/failed session.
      const audioBlob = recoveredBlob || new Blob(audioChunks, { type: 'audio/webm' });
      const durationSeconds = seconds || recoveryAvailable?.seconds || 0;
      // Make sure a durable copy exists before we attempt the upload, so a
      // failure (or a tab close) mid-upload never loses the audio.
      await saveRecording(classId, audioBlob, { seconds: durationSeconds, timestamp: Date.now() });

      const audioFile = new File([audioBlob], `lecture-${Date.now()}.webm`, { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: audioFile });
      const today = new Date().toISOString().split('T')[0];
      const lecture = await base44.entities.Lecture.create({
        class_id: classId,
        date: today,
        recording_url: file_url,
        duration_seconds: durationSeconds,
        status: 'processing',
      });
      await base44.functions.invoke('processLectureRecording', {
        lecture_id: lecture.id,
        audio_url: file_url,
      });
      // Save any notes typed during the lecture as a separate Note record tied
      // to this lecture. Kept distinct from the transcript, and the handbook
      // already surfaces per-lecture notes alongside it.
      if (liveNotes.trim()) {
        try {
          await base44.entities.Note.create({
            lecture_id: lecture.id,
            class_id: classId,
            content: liveNotes.trim(),
          });
        } catch (e) { /* non-fatal: the recording itself is safely saved */ }
      }
      // Uploaded and handed off successfully — the durable copy is no longer
      // needed, so clear it and move on to offer spaced reviews.
      await clearRecording(classId);
      setProcessing(false);
      setReviewLectureId(lecture.id);
      return;
    } catch (e) {
      // Keep the durable copy so the user can retry — even after a reload.
      setSaveError(true);
    }
    setProcessing(false);
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
        {recoveryAvailable && recoveredBlob && !recording && !audioChunks.length && !saveError && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Unsaved recording found</p>
                <p className="text-xs text-muted-foreground mt-1">A recording for this class (about {formatTime(recoveryAvailable.seconds)}) didn’t finish saving last time. The audio is safe — you can save it now.</p>
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
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Couldn’t save the recording</p>
                <p className="text-xs text-muted-foreground mt-1">Your audio is safely stored on this device — nothing was lost. Check your connection and try again. It’ll still be here if you close and come back.</p>
                <button onClick={saveAndProcess} disabled={processing}
                  className="mt-3 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {processing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Trying again…</> : 'Try again'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!recording && !audioChunks.length && !recoveredBlob && !saveError && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-1">Record Lecture</h3>
            <p className="text-sm text-muted-foreground mb-6">Tap to start recording. AI will transcribe and summarize automatically.</p>
            <button onClick={startRecording} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Start Recording</button>
            <button onClick={onClose} className="mt-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </>
        )}
        {recording && (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4 relative">
              <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping"></span>
              <Mic className="w-8 h-8 text-destructive relative" />
            </div>
            <p className="font-heading text-3xl font-bold tabular-nums mb-1">{formatTime(seconds)}</p>
            <p className="text-sm text-muted-foreground mb-6">Recording in progress...</p>
            <button onClick={stopRecording} className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90">Stop Recording</button>
          </>
        )}
        {!recording && audioChunks.length > 0 && !saveError && (
          <>
            {processing ? (
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
                <p className="text-sm text-muted-foreground mb-6">{formatTime(seconds)} of audio captured</p>
                <div className="flex gap-2">
                  <button onClick={async () => { await clearRecording(classId); setAudioChunks([]); setSeconds(0); }} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Discard</button>
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

function AssignmentTab({ assignments, classId, cls, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showProject, setShowProject] = useState(false);

  const typeColors = {
    exam: 'bg-rose-500/10 text-rose-600',
    quiz: 'bg-amber-500/10 text-amber-600',
    project: 'bg-purple-500/10 text-purple-600',
    assignment: 'bg-blue-500/10 text-blue-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add
          </button>
          <button onClick={() => setShowProject(true)} className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
            <FolderPlus className="w-4 h-4" /> Project
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No assignments yet. Add exams, quizzes, or deadlines to generate study plans.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Due {a.due_date}</p>
                  {a.type === 'project' && a.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.description}</p>
                  )}
                  {a.type === 'project' && a.roadmap && a.roadmap.length > 0 && (
                    <p className="text-[10px] text-primary mt-1 font-medium">{a.roadmap.length}-step roadmap</p>
                  )}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase ${typeColors[a.type]}`}>{a.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAssignmentModal classId={classId} onClose={() => { setShowAdd(false); onUpdate(); }} />}
      {showProject && <ProjectAssignmentModal classId={classId} className={cls?.name} onClose={() => { setShowProject(false); onUpdate(); }} />}
    </div>
  );
}

function StudyTab({ classId, cls, lectures, onUpdate }) {
  const [missedLoading, setMissedLoading] = useState(false);

  const handleMissedLecture = async () => {
    setMissedLoading(true);
    try {
      await base44.functions.invoke('generateMissedLectureSummary', {
        class_id: classId,
        date: new Date().toISOString().split('T')[0],
      });
      onUpdate();
    } catch (e) {
      alert('Failed to generate missed lecture summary.');
    }
    setMissedLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Link to={`/study-tools/${classId}`}
          className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Generate Study Material</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Flashcards, quizzes, and practice tests from your lectures</p>
        </Link>
        <Link to="/focus"
          className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
            <Headphones className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Focus session</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Start a focus session with classical music and a timer</p>
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
            <button onClick={handleMissedLecture} disabled={missedLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm font-medium text-amber-700 dark:text-amber-500 hover:bg-amber-500/10 disabled:opacity-50">
              {missedLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : 'Generate Missed Lecture Summary'}
            </button>
          </div>
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
            <p className="text-xs text-muted-foreground text-center py-4">No chapters yet. Record and process lectures to generate the handbook.</p>
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