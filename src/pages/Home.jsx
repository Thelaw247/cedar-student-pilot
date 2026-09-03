import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import UserMenuButton from '@/components/UserMenuButton';
import CreditMeter from '@/components/monetization/CreditMeter';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUndo, UndoToast } from '@/hooks/useUndo';
import { Plus, GraduationCap, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Segmented from '@/components/ui/Segmented';
import Timeline from '@/components/Timeline';
import TodayIntelligenceCard from '@/components/TodayIntelligenceCard';
import RiskIndicatorCard from '@/components/RiskIndicatorCard';
import AddExamOrStudyModal from '@/components/AddExamOrStudyModal';
import DailyProgressRing from '@/components/DailyProgressRing';
import FloatingActionButton from '@/components/FloatingActionButton';
import AutoPrintPrompt from '@/components/AutoPrintPrompt';
import AttendancePrompt from '@/components/AttendancePrompt';
import AssignmentDetectedNotice from '@/components/AssignmentDetectedNotice';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import AddEventModal from '@/components/AddEventModal';
import { classesOnDate } from '@/lib/classSchedule';
import { weekDates } from '@/lib/eventSchedule';
import { formatWeekRange } from '@/lib/time';
import { eventsOnDate } from '@/lib/eventSchedule';
import { sessionTitle, sessionDescription } from '@/lib/sessionTitle';

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('today');
  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddExamOrStudy, setShowAddExamOrStudy] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const { toast, showUndo, handleUndo, dismiss } = useUndo();

  useKeyboardShortcuts({
    onNewEvent: () => setShowAddEvent(true),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await fetchWithCache('Semester', 'filter', [{ is_active: true }]);
      if (semesters.length > 0) setActiveSemester(semesters[0]);

      // Load ALL events (not just today's): the Weekly view and recurring
      // events both need the full set to expand across any week.
      const [allClasses, allEvents, allAssignments, allSessions, allAttendance, allLectures] = await Promise.all([
        semesters.length > 0
          ? fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }])
          : Promise.resolve([]),
        fetchWithCache('CalendarEvent', 'list', []),
        fetchWithCache('Assignment', 'list', []),
        fetchWithCache('StudySession', 'list', []),
        // Needed by DailyProgressRing: a class is only "done" once the student
        // confirms attendance or records a lecture, never just because its end
        // time has passed.
        fetchWithCache('ClassAttendance', 'list', ['-date', 200]),
        fetchWithCache('Lecture', 'list', ['-date', 200]),
      ]);

      setClasses(allClasses);
      setEvents(allEvents);
      setAssignments(allAssignments);
      setStudySessions(allSessions);
      setAttendance(allAttendance);
      setLectures(allLectures);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteEvent = useCallback(async (eventId, eventData) => {
    const snapshot = { ...eventData };
    try {
      await base44.entities.CalendarEvent.delete(eventId);
      showUndo('Event deleted', async () => {
        const { id, created_date, updated_date, created_by_id, _recurring, _seriesId, ...rest } = snapshot;
        await base44.entities.CalendarEvent.create(rest);
        loadData();
      });
      loadData();
    } catch (e) { console.error(e); }
  }, [showUndo, loadData]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('cedar-data-changed', handler);
    return () => window.removeEventListener('cedar-data-changed', handler);
  }, [loadData]);

  useEffect(() => {
    // 30s tick: the clock shows h:mm and every calculation here runs on
    // minutes, so a 1-second interval just re-rendered the page 30x too often.
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const greeting = (() => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const today = getTodayString();

  // Concrete occurrences for today, including date ranges and one-off changes.
  const todayClasses = classesOnDate(classes, today);

  // Today's event occurrences (expands recurring events onto today).
  const todayEvents = eventsOnDate(events, today);

  const allItems = [
    ...todayClasses.map(c => ({
      id: c._occurrence_key || c.id,
      title: c.name,
      time: c.start_time,
      endTime: c.end_time,
      type: 'class',
      room: c.room,
      instructor: c.instructor,
      color: c.color,
      classId: c.id,
    })),
    ...todayEvents.map(e => ({
      id: e.id,
      title: e.title,
      time: e.start_time,
      endTime: e.end_time,
      type: e.type,
      notes: e.notes,
      color: e.color,
      recurring: e._recurring,
      // Events are the only timeline item the student owns outright: a class
      // is edited from the class page and a study session from the planner.
      // `source` is the row itself, so deleting can offer a real undo.
      deletable: true,
      source: e,
    })),
    ...studySessions.filter(s => s.scheduled_date === today).map(s => ({
      id: s.id,
      // `title` is the session's name; `notes` stays the description shown
      // beneath it on the timeline (see src/lib/sessionTitle.js).
      title: sessionTitle(s),
      notes: sessionDescription(s),
      time: s.scheduled_time,
      type: 'study',
      classId: s.class_id,
      // Study belongs to a class, so it renders in the class's color (law 02).
      color: classes.find(c => c.id === s.class_id)?.color,
    })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-40 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!activeSemester) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="font-heading text-xl font-bold mb-2">Welcome to Praelecta</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Set up your semester to start tracking classes, lectures, and study sessions.
        </p>
        <Link to="/setup" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Set Up Semester
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      {/* Profile access, top left. Hidden from lg up because the Sidebar
          already shows the same button there and two would be a duplicate.
          Replaces the old Praelecta logo lockup here — the brand mark stays in
          the favicon, home-screen icon, and marketing; this corner is
          profile-only now. */}
      <div className="mb-6 lg:hidden flex items-center justify-between">
        <UserMenuButton size="sm" />
        {/* Mobile home for the credit meter — the desktop meter lives in the
            Sidebar. Same component, same sheet (MON-04 §3). */}
        <CreditMeter />
      </div>

      {/* View switch. The theme toggle moved to Settings -> Appearance (it was
          chrome competing with content here; Settings already had the same
          control). */}
      <div className="mb-6">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[{ value: 'today', label: 'Today' }, { value: 'weekly', label: 'Weekly' }]}
        />
      </div>

      {/* Today tab */}
      {tab === 'today' && (
        <div>
          <div className="mb-5">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{greeting}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <span className="text-muted-foreground/40">•</span>
              <p className="text-sm text-muted-foreground tabular-nums">
                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <AutoPrintPrompt />
          <AttendancePrompt />
          <AssignmentDetectedNotice />

          <DailyProgressRing
            classes={todayClasses}
            events={todayEvents}
            studySessions={studySessions}
            attendance={attendance}
            lectures={lectures}
            currentTime={currentTime}
          />

          <TodayIntelligenceCard
            todayClasses={todayClasses}
            events={todayEvents}
            assignments={assignments}
            studySessions={studySessions}
            onRecalculateComplete={loadData}
          />
          <RiskIndicatorCard />

          <div className="flex items-center justify-between mb-3 mt-6">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">Today's schedule</h2>
            <button onClick={() => setShowAddEvent(true)}
              className="hidden sm:inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add event
            </button>
          </div>
          <Timeline items={allItems} onAddEvent={() => setShowAddEvent(true)} onDeleteItem={(item) => handleDeleteEvent(item.id, item.source)} />
        </div>
      )}

      {/* Weekly tab — the whole week: classes + study + events together */}
      {tab === 'weekly' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset(w => w - 1)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setWeekOffset(0)}
                title={weekOffset === 0 ? 'This week' : 'Back to this week'}
                className={`px-3 h-8 rounded-lg text-xs font-medium tabular-nums transition-colors ${weekOffset === 0 ? 'text-muted-foreground' : 'text-primary hover:bg-primary/10'}`}>
                {formatWeekRange(weekDates(new Date(), weekOffset))}
              </button>
              <button onClick={() => setWeekOffset(w => w + 1)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowAddEvent(true)}
              className="hidden sm:inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add event
            </button>
          </div>

          <WeeklyCalendar
            classes={classes}
            events={events}
            studySessions={studySessions}
            weekOffset={weekOffset}
            dateAware
            onEditClass={(c) => navigate(`/classes/${c.id}`)}
          />
        </div>
      )}

      {/* Modals */}
      {showAddEvent && (
        <AddEventModal
          classes={classes}
          onAddClass={() => { setShowAddEvent(false); navigate('/classes?add=1'); }}
          onClose={() => { setShowAddEvent(false); loadData(); }}
        />
      )}
      {showAddExamOrStudy && <AddExamOrStudyModal classes={classes} onClose={() => { setShowAddExamOrStudy(false); loadData(); }} />}

      <UndoToast toast={toast} onUndo={handleUndo} onDismiss={dismiss} />

      <FloatingActionButton actions={[
        { label: 'Add Event', icon: Calendar, onClick: () => setShowAddEvent(true) },
        { label: 'Add Exam', icon: AlertCircle, onClick: () => setShowAddExamOrStudy(true) },
        { label: 'Add Class', icon: GraduationCap, onClick: () => navigate('/classes?add=1') },
      ]} />
    </div>
  );
}
