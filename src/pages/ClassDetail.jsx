import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Plus, GraduationCap, Clock, MapPin, Mic, FileText, Loader2, Calendar, AlertCircle, Brain, Headphones, Pencil } from 'lucide-react';
import EditClassModal from '@/components/EditClassModal';
import LectureItem from '@/components/LectureItem';
import { getSetting } from '@/lib/settings';

export default function ClassDetail() {
  const { classId } = useParams();
  const [cls, setCls] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('lectures');
  const [showEdit, setShowEdit] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const c = await base44.entities.Class.get(classId);
      setCls(c);
      const lecs = await base44.entities.Lecture.filter({ class_id: classId }, '-date');
      setLectures(lecs);
      const asgns = await base44.entities.Assignment.filter({ class_id: classId }, 'due_date');
      setAssignments(asgns);
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
      <div className="flex gap-1 border-b border-border mb-6">
        {['lectures', 'assignments', 'study'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'study' ? 'Study Tools' : t}
          </button>
        ))}
      </div>

      {tab === 'lectures' && (
        <LectureTab lectures={lectures} classId={classId} cls={cls} onUpdate={loadData} />
      )}
      {tab === 'assignments' && (
        <AssignmentTab assignments={assignments} classId={classId} onUpdate={loadData} />
      )}
      {tab === 'study' && (
        <StudyTab classId={classId} cls={cls} lectures={lectures} onUpdate={loadData} />
      )}

      {showEdit && (
        <EditClassModal classData={cls} semesterId={cls.semester_id} onClose={() => { setShowEdit(false); loadData(); }} />
      )}
    </div>
  );
}

function LectureTab({ lectures, classId, cls, onUpdate }) {
  const [showRecord, setShowRecord] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{lectures.length} lecture{lectures.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Mic className="w-4 h-4" /> Record
        </button>
      </div>

      {lectures.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Mic className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No lectures recorded yet.</p>
          <button onClick={() => setShowRecord(true)} className="text-sm text-primary font-medium mt-2 hover:underline">Record your first lecture</button>
        </div>
      ) : (
        <div className="space-y-2">
          {lectures.map(l => (
            <LectureItem key={l.id} lecture={l} defaultInstructor={cls?.instructor} onUpdate={onUpdate} />
          ))}
        </div>
      )}

      {showRecord && <RecordModal classId={classId} cls={cls} onClose={() => { setShowRecord(false); onUpdate(); }} />}
    </div>
  );
}

function RecordModal({ classId, onClose }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let interval;
    if (recording) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [recording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setAudioChunks(chunks);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks([]);
      setRecording(true);
      setSeconds(0);
    } catch (e) {
      alert('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const saveAndProcess = async () => {
    setProcessing(true);
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `lecture-${Date.now()}.webm`, { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: audioFile });
      const today = new Date().toISOString().split('T')[0];
      const lecture = await base44.entities.Lecture.create({
        class_id: classId,
        date: today,
        recording_url: file_url,
        duration_seconds: seconds,
        status: 'processing',
      });
      await base44.functions.invoke('processLectureRecording', {
        lecture_id: lecture.id,
        audio_url: file_url,
      });
      onClose();
    } catch (e) {
      alert('Failed to process recording.');
    }
    setProcessing(false);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
      <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full mx-4 text-center animate-fade-in">
        {!recording && !audioChunks.length && (
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
        {!recording && audioChunks.length > 0 && (
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
                  <button onClick={() => { setAudioChunks([]); setSeconds(0); }} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Discard</button>
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

function AssignmentTab({ assignments, classId, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);

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
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add
        </button>
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
                <div>
                  <h3 className="text-sm font-medium text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Due {a.due_date}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase ${typeColors[a.type]}`}>{a.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAssignmentModal classId={classId} onClose={() => { setShowAdd(false); onUpdate(); }} />}
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
          <h3 className="text-sm font-medium text-foreground">Focus Mode</h3>
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