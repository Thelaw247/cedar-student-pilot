import React, { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ResolvedAvatarImage from '@/components/ResolvedAvatarImage';
import { getInitials, getAvatarColor } from '@/lib/avatar';
import { matchParsedToExisting, unclaimedClasses } from '@/lib/courseIdentity';
import { invalidateEntity } from '@/lib/cache';
import { announceDataChange } from '@/lib/dataChanged';
import { Upload, Loader2, Check, X, Plus, ChevronRight, Camera, AlertCircle } from 'lucide-react';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function deriveSemesterRange(classes) {
  const starts = classes.map(cls => cls.class_start_date).filter(Boolean).sort();
  const ends = classes.map(cls => cls.class_end_date).filter(Boolean).sort();
  return {
    start_date: starts[0] || '',
    end_date: ends.at(-1) || '',
  };
}

function timetableErrorMessage(error) {
  if (error?.code === 'GEMINI_NOT_CONFIGURED') {
    return 'Timetable analysis is not configured yet. You can add classes manually for now.';
  }
  if (error?.code === 'GEMINI_REQUEST_FAILED') {
    return error.message || 'The timetable analysis provider could not process this file.';
  }
  if (error?.status === 401) return 'Your session expired. Please log in and try again.';
  if (error?.status === 413 || /7 MB|too large/i.test(error?.message || '')) {
    return 'The timetable file is too large. Please choose a file no larger than 7 MB.';
  }
  if (error?.status === 400 && error?.message) return error.message;
  return 'Could not parse the timetable. You can add classes manually instead.';
}

function meetingDates(meeting) {
  return [meeting.start_date, meeting.end_date, meeting.specific_date].filter(Boolean);
}

function classPayload(cls, semesterInfo) {
  const meetings = (cls.meetings || []).filter(m => m && (m.day || m.specific_date)).map((meeting) => {
    const normalized = { ...meeting };
    if (meeting.specific_date) {
      delete normalized.start_date;
      delete normalized.end_date;
    } else {
      delete normalized.specific_date;
      delete normalized.replaces_regular_time;
    }
    return normalized;
  });
  const dates = meetings.flatMap(meetingDates).sort();
  const days = [...new Set(meetings.map(m => m.day).filter(Boolean))];
  const earliest = [...meetings].filter(m => m.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const { source_entry_count, ...persisted } = cls;
  return {
    ...persisted,
    course_code: cls.course_code || null,
    meetings,
    days_of_week: days,
    start_time: earliest?.start_time || cls.start_time || null,
    end_time: earliest?.end_time || cls.end_time || null,
    class_start_date: dates[0] || cls.class_start_date || semesterInfo.start_date,
    class_end_date: dates.at(-1) || cls.class_end_date || semesterInfo.end_date,
  };
}

function scheduleCount(classes) {
  return classes.reduce((count, cls) => count + (cls.meetings?.length || 0), 0);
}

export default function SemesterSetup() {
  const { user, checkUserAuth } = useAuth();
  const [searchParams] = useSearchParams();
  // Re-import mode: /setup?semester=<id> updates that semester in place
  // instead of creating a new one. The classes it already has are loaded so
  // the parsed courses can be matched to them (see matchParsedToExisting);
  // matched ones are updated by id, new ones added, unclaimed ones kept.
  const updatingSemesterId = searchParams.get('semester') || null;
  const [existingClasses, setExistingClasses] = useState([]);
  const [existingLoaded, setExistingLoaded] = useState(!updatingSemesterId);
  const [saved, setSaved] = useState(null); // the server's answer, for the success screen
  // Step 0 (name + optional photo) only shows for someone who has never set a
  // name — i.e. genuinely the first time through. Nothing else in the app
  // captures a name at signup (Register.jsx is email/password only), so this
  // is the only place it's ever asked. An existing user setting up a SECOND
  // semester already has a name and skips straight to step 1, unchanged from
  // before this feature existed. Re-import always starts at step 1.
  const [step, setStep] = useState(() => (user?.full_name || updatingSemesterId ? 1 : 0));
  const [welcomeName, setWelcomeName] = useState(user?.full_name || '');
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [welcomeError, setWelcomeError] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedClasses, setParsedClasses] = useState([]);
  const [semesterInfo, setSemesterInfo] = useState({ name: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!updatingSemesterId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [semester, classes] = await Promise.all([
          base44.entities.Semester.get(updatingSemesterId),
          base44.entities.Class.filter({ semester_id: updatingSemesterId }),
        ]);
        if (cancelled) return;
        setSemesterInfo({ name: semester.name || '', start_date: semester.start_date || '', end_date: semester.end_date || '' });
        setExistingClasses(classes);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Could not load this semester. Go back to Classes and try again.');
      }
      if (!cancelled) setExistingLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [updatingSemesterId]);

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f, purpose: 'timetable' });
      setFileUrl(file_url);
      const response = await base44.functions.invoke('parseTimetableUpload', { file_url });
      const classes = response.data?.classes || [];
      setParsedClasses(updatingSemesterId ? matchParsedToExisting(classes, existingClasses) : classes);
      const parsedRange = deriveSemesterRange(classes);
      setSemesterInfo(previous => ({
        ...previous,
        start_date: previous.start_date || parsedRange.start_date,
        end_date: previous.end_date || parsedRange.end_date,
      }));
      setStep(2);
    } catch (e) {
      setError(timetableErrorMessage(e));
    }
    setParsing(false);
  };

  const handleConfirm = async () => {
    setParsing(true);
    setError('');
    try {
      if (semesterInfo.start_date > semesterInfo.end_date) {
        throw new Error('Semester start date must be on or before its end date.');
      }
      for (const cls of parsedClasses) {
        if (!cls.name?.trim()) throw new Error('Every course needs a name.');
        if (!(cls.meetings || []).length) throw new Error(`${cls.name} needs at least one schedule entry.`);
        for (const meeting of cls.meetings) {
          if (meeting.start_date && meeting.end_date && meeting.start_date > meeting.end_date) {
            throw new Error(`${cls.name} has a schedule ending before it starts.`);
          }
          for (const date of meetingDates(meeting)) {
            if (date < semesterInfo.start_date || date > semesterInfo.end_date) {
              throw new Error(`${cls.name} has a schedule date outside the semester range.`);
            }
          }
          if (meeting.start_time && meeting.end_time && meeting.start_time >= meeting.end_time) {
            throw new Error(`${cls.name} has a schedule whose end time is not after its start time.`);
          }
        }
      }
      const response = await base44.functions.invoke('createSemesterImport', {
        // Re-import: the semester to update, and per course the class it
        // updates (matched above). A first import sends neither.
        ...(updatingSemesterId ? { semester_id: updatingSemesterId } : {}),
        semester: semesterInfo,
        classes: parsedClasses.map((cls) => {
          const { id, ...payload } = classPayload(cls, semesterInfo);
          return {
            ...payload,
            ...(updatingSemesterId && id ? { id } : {}),
            color: cls.color || '#3B82F6',
          };
        }),
      });
      setSaved(response?.data || null);
      // Every page that reads the semester or its classes refreshes; the
      // import used to rely on the next navigation to notice.
      invalidateEntity('Semester');
      invalidateEntity('Class');
      announceDataChange(['Semester', 'Class']);
      setStep(3);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to create semester. Please try again.');
    }
    setParsing(false);
  };

  const updateClass = (index, field, value) => {
    const updated = [...parsedClasses];
    updated[index] = { ...updated[index], [field]: value };
    setParsedClasses(updated);
  };

  const updateMeeting = (classIndex, meetingIndex, field, value) => {
    const updated = [...parsedClasses];
    const meetings = [...(updated[classIndex].meetings || [])];
    meetings[meetingIndex] = { ...meetings[meetingIndex], [field]: value };
    updated[classIndex] = { ...updated[classIndex], meetings };
    setParsedClasses(updated);
  };

  const removeMeeting = (classIndex, meetingIndex) => {
    const updated = [...parsedClasses];
    updated[classIndex] = {
      ...updated[classIndex],
      meetings: (updated[classIndex].meetings || []).filter((_, index) => index !== meetingIndex),
    };
    setParsedClasses(updated);
  };

  const addMeeting = (classIndex) => {
    const updated = [...parsedClasses];
    updated[classIndex] = {
      ...updated[classIndex],
      meetings: [...(updated[classIndex].meetings || []), {
        component: '', day: 'Mon', start_time: '09:00', end_time: '10:00',
        start_date: semesterInfo.start_date, end_date: semesterInfo.end_date,
      }],
    };
    setParsedClasses(updated);
  };

  const splitMeeting = (classIndex, meetingIndex) => {
    const source = parsedClasses[classIndex];
    const meeting = source.meetings[meetingIndex];
    if (!meeting || source.meetings.length < 2) return;
    const remaining = source.meetings.filter((_, index) => index !== meetingIndex);
    const splitName = meeting.component ? `${source.name} — ${meeting.component}` : `${source.name} — Separate schedule`;
    const next = [...parsedClasses];
    next[classIndex] = { ...source, meetings: remaining };
    // The split-off part is a new course. In a re-import the source may carry
    // the id of an existing class; two entries with one id would both update
    // the same row, the second overwriting the first.
    const { id: _existingId, ...withoutId } = source;
    next.splice(classIndex + 1, 0, {
      ...withoutId, name: splitName, meetings: [meeting], source_entry_count: 1,
    });
    setParsedClasses(next);
  };

  const addManualClass = () => {
    setParsedClasses([...parsedClasses, {
      course_code: '', name: '', instructor: '', room: '', color: '#3B82F6', source_entry_count: 1,
      meetings: [{ day: 'Mon', component: '', start_time: '09:00', end_time: '10:00', start_date: semesterInfo.start_date, end_date: semesterInfo.end_date }],
    }]);
  };

  const handleWelcomePhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setWelcomeError(null);
    if (!f.type.startsWith('image/')) { setWelcomeError('Please choose an image file.'); return; }
    if (f.size > MAX_PHOTO_BYTES) { setWelcomeError('Photo is too large — please choose one under 5MB.'); return; }
    setPhotoBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f, purpose: 'avatar' });
      await base44.auth.updateMe({ avatar_url: file_url });
      await checkUserAuth();
    } catch (err) {
      console.error(err);
      setWelcomeError('Could not upload your photo. You can add one later in Settings.');
    }
    setPhotoBusy(false);
  };

  const continueFromWelcome = async () => {
    setWelcomeError(null);
    if (welcomeName.trim()) {
      setWelcomeBusy(true);
      try {
        await base44.auth.updateMe({ full_name: welcomeName.trim() });
        await checkUserAuth();
      } catch (err) {
        console.error(err);
        setWelcomeError('Could not save your name. You can set it later in Settings.');
        setWelcomeBusy(false);
        return;
      }
      setWelcomeBusy(false);
    }
    setStep(1);
  };

  if (step === 0) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-6 lg:py-12 animate-fade-in text-center">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">Welcome to Praelecta</h1>
        <p className="text-muted-foreground text-sm mb-8">Let's set up your profile before your semester.</p>

        <div className="relative inline-block mb-6">
          <Avatar className="w-20 h-20">
            {user?.avatar_url && <ResolvedAvatarImage src={user.avatar_url} alt={welcomeName || 'Profile photo'} />}
            <AvatarFallback
              style={{ backgroundColor: getAvatarColor(user?.id), color: '#fff' }}
              className="text-2xl font-semibold"
            >
              {getInitials(welcomeName)}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoBusy}
            title="Add photo"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background hover:bg-primary/90 disabled:opacity-50"
          >
            {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleWelcomePhoto} />
        </div>

        <div className="text-left mb-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What should we call you?</label>
          <input
            type="text"
            value={welcomeName}
            onChange={(e) => setWelcomeName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        {welcomeError && (
          <p className="text-[11px] text-destructive flex items-start gap-1.5 mt-2 text-left">
            <AlertCircle className="w-3 h-3 mt-px flex-shrink-0" />{welcomeError}
          </p>
        )}

        <button
          onClick={continueFromWelcome}
          disabled={welcomeBusy}
          className="w-full mt-6 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {welcomeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4" /></>}
        </button>
        <button
          onClick={() => setStep(1)}
          disabled={welcomeBusy}
          className="w-full mt-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <Link to={updatingSemesterId ? '/classes' : '/today'} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1">
          <X className="w-4 h-4" /> Cancel
        </Link>
        {updatingSemesterId ? (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">Update Your Schedule</h1>
            <p className="text-muted-foreground text-sm mb-2">Upload the new timetable{semesterInfo.name ? ` for ${semesterInfo.name}` : ''}. Courses you already have are updated in place — your lectures, recordings and files stay exactly where they are.</p>
            <p className="text-xs text-muted-foreground mb-8">{existingLoaded ? `${existingClasses.length} course${existingClasses.length === 1 ? '' : 's'} in this semester now. Nothing is deleted by an update.` : 'Loading your current courses…'}</p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">Set Up Your Semester</h1>
            <p className="text-muted-foreground text-sm mb-8">Upload a screenshot or PDF of your university timetable. AI will extract your classes automatically.</p>
          </>
        )}

        <label className="block">
          <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
            {parsing ? (
              <>
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm font-medium text-foreground">Parsing your timetable...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-primary" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-foreground">Upload your timetable</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP, or PDF</p>
              </>
            )}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={parsing || !existingLoaded} />
          </div>
        </label>

        {error && <p className="text-sm text-destructive mt-4">{error}</p>}

        <div className="mt-6 text-center">
          <button onClick={addManualClass} className="text-sm text-primary font-medium hover:underline">
            Or add classes manually
          </button>
        </div>

        {parsedClasses.length > 0 && (
          <div className="mt-6">
            <button onClick={() => setStep(2)} className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Review {parsedClasses.length} Class{parsedClasses.length !== 1 ? 'es' : ''} →
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    const kept = updatingSemesterId ? unclaimedClasses(parsedClasses, existingClasses) : [];
    const updatingCount = updatingSemesterId ? parsedClasses.filter((cls) => cls.id).length : 0;
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1">
          <X className="w-4 h-4" /> Back
        </button>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">{updatingSemesterId ? 'Review the Changes' : 'Review Your Classes'}</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {updatingSemesterId
            ? `${updatingCount} course${updatingCount === 1 ? '' : 's'} matched to what you already have and will be updated in place; ${parsedClasses.length - updatingCount} will be added. Nothing is removed.`
            : 'Confirm the grouped courses and every schedule variation before creating the semester.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <input type="text" placeholder="Semester Name" value={semesterInfo.name}
            onChange={e => setSemesterInfo({ ...semesterInfo, name: e.target.value })}
            className="sm:col-span-3 px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="date" value={semesterInfo.start_date}
            onChange={e => setSemesterInfo({ ...semesterInfo, start_date: e.target.value })}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="date" value={semesterInfo.end_date}
            onChange={e => setSemesterInfo({ ...semesterInfo, end_date: e.target.value })}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <div />
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-foreground">
            {parsedClasses.length} course{parsedClasses.length !== 1 ? 's' : ''} · {scheduleCount(parsedClasses)} schedule entr{scheduleCount(parsedClasses) !== 1 ? 'ies' : 'y'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Repeated timetable rows were consolidated. Different times, components and date ranges remain below.</p>
        </div>

        <div className="space-y-4 mb-6">
          {parsedClasses.map((cls, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              {updatingSemesterId && (
                <p className="text-[10px] font-semibold uppercase tracking-wide">
                  {cls.id
                    ? <span className="text-emerald-600">Updates {existingClasses.find((c) => c.id === cls.id)?.course_code || existingClasses.find((c) => c.id === cls.id)?.name || 'an existing course'}</span>
                    : <span className="text-primary">New course</span>}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input type="color" value={cls.color || '#3B82F6'} onChange={e => updateClass(i, 'color', e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-border" />
                <input type="text" placeholder="Course code" value={cls.course_code || ''}
                  onChange={e => updateClass(i, 'course_code', e.target.value)}
                  className="w-28 px-3 py-2 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <input type="text" placeholder="Course name" value={cls.name}
                  onChange={e => updateClass(i, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <button onClick={() => setParsedClasses(parsedClasses.filter((_, idx) => idx !== i))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" placeholder="Instructor" value={cls.instructor || ''}
                  onChange={e => updateClass(i, 'instructor', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <input type="text" placeholder="Default room" value={cls.room || ''}
                  onChange={e => updateClass(i, 'room', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule rules</p>
                  {cls.source_entry_count > 1 && <span className="text-[10px] text-primary">{cls.source_entry_count} source rows merged</span>}
                </div>
                {(cls.meetings || []).map((meeting, meetingIndex) => {
                  const specific = Boolean(meeting.specific_date);
                  return (
                    <div key={meetingIndex} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input type="text" placeholder="Component (Lecture/Lab)" value={meeting.component || ''}
                          onChange={e => updateMeeting(i, meetingIndex, 'component', e.target.value)}
                          className="sm:col-span-2 px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                        <select value={specific ? 'specific' : 'recurring'} onChange={e => {
                          if (e.target.value === 'specific') updateMeeting(i, meetingIndex, 'specific_date', meeting.start_date || semesterInfo.start_date);
                          else updateMeeting(i, meetingIndex, 'specific_date', '');
                        }} className="px-2.5 py-2 rounded-md border border-input bg-background text-xs">
                          <option value="recurring">Recurring range</option>
                          <option value="specific">Specific date</option>
                        </select>
                        <select value={meeting.day || 'Mon'} onChange={e => updateMeeting(i, meetingIndex, 'day', e.target.value)}
                          className="px-2.5 py-2 rounded-md border border-input bg-background text-xs">
                          {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input type="time" aria-label="Start time" value={meeting.start_time || ''}
                          onChange={e => updateMeeting(i, meetingIndex, 'start_time', e.target.value)}
                          className="px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                        <input type="time" aria-label="End time" value={meeting.end_time || ''}
                          onChange={e => updateMeeting(i, meetingIndex, 'end_time', e.target.value)}
                          className="px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                        {specific ? (
                          <input type="date" aria-label="Specific date" value={meeting.specific_date || ''}
                            min={semesterInfo.start_date || undefined} max={semesterInfo.end_date || undefined}
                            onChange={e => updateMeeting(i, meetingIndex, 'specific_date', e.target.value)}
                            className="col-span-2 px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                        ) : (
                          <>
                            <input type="date" aria-label="Schedule start date" value={meeting.start_date || ''}
                              min={semesterInfo.start_date || undefined} max={meeting.end_date || semesterInfo.end_date || undefined}
                              onChange={e => updateMeeting(i, meetingIndex, 'start_date', e.target.value)}
                              className="px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                            <input type="date" aria-label="Schedule end date" value={meeting.end_date || ''}
                              min={meeting.start_date || semesterInfo.start_date || undefined} max={semesterInfo.end_date || undefined}
                              onChange={e => updateMeeting(i, meetingIndex, 'end_date', e.target.value)}
                              className="px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input type="text" placeholder="Room override (optional)" value={meeting.room || ''}
                          onChange={e => updateMeeting(i, meetingIndex, 'room', e.target.value)}
                          className="px-2.5 py-2 rounded-md border border-input bg-background text-xs" />
                        <div className="flex items-center justify-end gap-2">
                          {specific && (
                            <label className="mr-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <input type="checkbox" checked={meeting.replaces_regular_time === true}
                                onChange={e => updateMeeting(i, meetingIndex, 'replaces_regular_time', e.target.checked)} />
                              Replaces normal time
                            </label>
                          )}
                          {(cls.meetings || []).length > 1 && (
                            <button type="button" onClick={() => splitMeeting(i, meetingIndex)} className="text-[10px] text-primary hover:underline">Split course</button>
                          )}
                          <button type="button" onClick={() => removeMeeting(i, meetingIndex)} className="text-[10px] text-destructive hover:underline">Remove</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={() => addMeeting(i)} className="text-xs text-primary font-medium hover:underline">+ Add schedule rule</button>
              </div>
            </div>
          ))}
          <button onClick={addManualClass} className="w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Another Class
          </button>
        </div>

        {/* Re-import: courses the upload did not mention stay exactly as they
            are. Removing one is a deliberate act on the Classes page, where the
            confirmation says what goes with it — never a side effect here. */}
        {updatingSemesterId && kept.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Not in this timetable — kept as they are</p>
            <p className="text-sm text-foreground">{kept.map((c) => c.course_code ? `${c.course_code} · ${c.name}` : c.name).join(', ')}</p>
            <p className="text-[11px] text-muted-foreground mt-1">To remove one, delete it from its class page afterwards.</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <button onClick={handleConfirm} disabled={parsing || !semesterInfo.name || !semesterInfo.start_date || !semesterInfo.end_date || parsedClasses.length === 0}
          className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
          {parsing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {updatingSemesterId ? 'Updating Schedule...' : 'Creating Semester...'}</>
            : <><Check className="w-4 h-4" /> {updatingSemesterId ? 'Confirm & Update Schedule' : 'Confirm & Create Semester'}</>}
        </button>
      </div>
    );
  }

  if (updatingSemesterId) {
    const updated = saved?.updated_count ?? 0;
    const created = saved?.created_count ?? 0;
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 lg:py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-emerald-600" strokeWidth={2} />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">Schedule Updated</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {updated} course{updated === 1 ? '' : 's'} updated, {created} added. Everything recorded so far is still attached to its course.
        </p>
        <Link to="/classes" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm hover:bg-primary/90">
          Back to Classes <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 lg:py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-emerald-600" strokeWidth={2} />
      </div>
      <h1 className="font-heading text-2xl font-bold mb-2">Semester Created!</h1>
      <p className="text-muted-foreground text-sm mb-8">Your classes have been added and your timeline is ready.</p>
      <Link to="/today" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm hover:bg-primary/90">
        Go to Timeline <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
