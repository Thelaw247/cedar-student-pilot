import React, { useState, useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sun, Moon, Bell, Sparkles, Palette, Check, GraduationCap, BookOpen, Shield, User, Zap, LineChart, ArrowRight, LifeBuoy, Mail, CalendarRange, Star } from 'lucide-react';
import { getSetting, setSetting } from '@/lib/settings';
import { CONSENT_EVENT, analyticsStarted, effectiveConsent, setConsent } from '@/lib/analyticsConsent';
import ProfileSettings from '@/components/ProfileSettings';
import DeleteAccountSection from '@/components/DeleteAccountSection';
import SubscriptionSettings from '@/components/SubscriptionSettings';
import ReviewScheduleSection from '@/components/ReviewScheduleSection';
import LearningModeToggle from '@/components/LearningModeToggle';
import ConceptDecaySettings from '@/components/ConceptDecaySettings';
import DataExportSection from '@/components/DataExportSection';
import SemestersSection from '@/components/SemestersSection';
import YourReviewSection from '@/components/YourReviewSection';
import Widget from '@/components/ui/Widget';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/legal';

export default function Settings() {
  const [isDark, setIsDark] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    // Owner dashboard entry point. This only decides whether the LINK renders;
    // the real gate is server-side (ownerAnalytics returns 403 to non-admins),
    // so a non-admin who guesses /owner still gets nothing.
    (async () => {
      try {
        const me = await base44.auth.me();
        setIsAdmin(me?.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  const toggleTheme = (dark) => {
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('cedar-theme', dark ? 'dark' : 'light');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-6">Settings</h1>

      {/* Plan, credits and purchases. Reads CreditBalance / UsageEvent, both
          RLS-scoped to the signed-in user. */}
      <SettingsSection icon={Zap} title="Plan and credits">
        <SubscriptionSettings />
      </SettingsSection>

      {/* Profile: name, email, password, sign out, delete account. */}
      <SettingsSection icon={User} title="Account">
        <ProfileSettings />
        <div className="mt-5 pt-4 border-t border-border">
          <DeleteAccountSection />
        </div>
      </SettingsSection>

      <SettingsSection icon={Palette} title="Appearance">
        <div className="space-y-2">
          <button onClick={() => toggleTheme(false)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${!isDark ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <Sun className="w-5 h-5 text-amber-500" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium">Light</p>
              <p className="text-xs text-muted-foreground">White pages, blue accents</p>
            </div>
            {!isDark && <Check className="w-4 h-4 text-primary" />}
          </button>
          <button onClick={() => toggleTheme(true)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${isDark ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <Moon className="w-5 h-5 text-indigo-500" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium">Dark</p>
              <p className="text-xs text-muted-foreground">Easier on the eyes at night</p>
            </div>
            {isDark && <Check className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </SettingsSection>

      {/* Google Calendar sync REMOVED — there is no Google OAuth app configured,
          so "Connect Google Calendar" could only ever fail. Restore this section
          once OAuth is set up and base44.connectAppUser has a real connector id
          to point at. Nothing else in the app depends on the connection. */}

      {isAdmin && (
        <SettingsSection icon={LineChart} title="Owner dashboard">
          <p className="text-sm text-muted-foreground mb-3">
            Revenue, cost to serve and margin per customer. Only you can see this.
          </p>
          <Link
            to="/owner"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <LineChart className="w-4 h-4" />
            Open business overview
            <ArrowRight className="w-4 h-4" />
          </Link>
        </SettingsSection>
      )}

      {/* Only switches that change something. Until Oct 2026 this page also
          had class reminders, assignment-deadline reminders, auto summaries,
          AI flashcards, high-quality audio and auto-transcribe: six switches
          nothing in the app read, and a note promising reminder emails that
          the server never checked this setting for. A switch that does
          nothing is a promise the app does not keep. */}
      <SettingsSection icon={Bell} title="Notifications">
        <Toggle label="Study session reminders" description="A reminder in the app when a scheduled study block is about to start" settingKey="studySessionReminders" />
        <ClassChangeToggle />
      </SettingsSection>

      <SettingsSection icon={Sparkles} title="Study planning">
        <Toggle label="Plan study sessions for new exams" description="When you add an exam, study sessions are booked for it right away" settingKey="autoGenerateSchedules" />
      </SettingsSection>

      <SettingsSection icon={GraduationCap} title="Study and review times" defaultOpen={false}>
        <ReviewScheduleSection />
      </SettingsSection>

      {/* Every semester, the active one marked, and the one way to delete one
          (through the API, so recordings and files leave storage too). */}
      <SettingsSection icon={CalendarRange} title="Semesters">
        <SemestersSection />
      </SettingsSection>

      <SettingsSection icon={BookOpen} title="How reviews are chosen" defaultOpen={false}>
        <LearningModeToggle />
        <ConceptDecaySettings />
      </SettingsSection>

      <SettingsSection icon={Shield} title="Data and privacy">
        <AnalyticsToggle />
        <div className="mt-3 pt-3 border-t border-border">
          <DataExportSection />
        </div>
      </SettingsSection>

      {/* A student's own review: what became of it, and the way to change or
          delete it. Not for the owner — the founder does not rate his own app. */}
      {!isAdmin && (
        <SettingsSection icon={Star} title="Your review">
          <YourReviewSection />
        </SettingsSection>
      )}

      {/* The support section the privacy policy and terms have always pointed
          at. Both said "reach out through the in-app support link" while no
          such link existed anywhere in the app — a promise with nothing behind
          it. A plain mailto rather than a ticket form: it works offline, it
          works from the user's own mail client with their own address attached,
          and there is nothing to maintain. */}
      <SettingsSection icon={LifeBuoy} title="Support">
        <p className="text-sm text-muted-foreground">
          Something broken, a billing question, or a request about your data? Email us and a person will answer.
        </p>
        <a
          href={SUPPORT_MAILTO}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Mail className="w-4 h-4 text-primary" /> {SUPPORT_EMAIL}
        </a>
        <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </SettingsSection>

      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">Praelecta</p>
    </div>
  );
}

function SettingsSection({ icon, title, children, defaultOpen = true }) {
  // Widget grammar: every group collapses and the choice is remembered per
  // user (storageKey derived from the title), so a long settings page reads
  // as a scannable index instead of a wall. The sections most students never
  // touch (review timing, how reviews are chosen) start closed.
  const storageKey = `set-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <Widget icon={icon} title={title} collapsible storageKey={storageKey} defaultOpen={defaultOpen} className="mb-4" padded>
      <div className="pt-2">{children}</div>
    </Widget>
  );
}

function Toggle({ label, description, settingKey }) {
  const [on, setOn] = useState(getSetting(settingKey));
  const toggle = () => {
    const next = !on;
    setOn(next);
    setSetting(settingKey, next);
  };
  return <ToggleRow label={label} description={description} on={on} onToggle={toggle} />;
}

/** A labelled switch: screen readers hear its name, its description and whether it is on. */
function ToggleRow({ label, description, on, onToggle }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium text-foreground">{label}</p>
        <p id={`${id}-description`} className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} onClick={onToggle}
        className={`relative w-11 h-6 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`}></span>
      </button>
    </div>
  );
}

/**
 * Browser notifications when a class ends (components/UpNextCard.jsx). The
 * browser's own permission prompt opens from here, when the switch is turned
 * on, so the student sees what they are allowing and why. Today used to ask
 * for it on its own the first time it opened. A browser that already said
 * yes before this switch existed shows as on.
 */
function ClassChangeToggle() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [on, setOn] = useState(() => supported && Notification.permission === 'granted' && getSetting('classChangeNotifications') !== false);
  const [blocked, setBlocked] = useState(() => supported && Notification.permission === 'denied');
  const toggle = async () => {
    if (on) {
      setSetting('classChangeNotifications', false);
      setOn(false);
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
    }
    if (permission === 'granted') {
      setSetting('classChangeNotifications', true);
      setOn(true);
      setBlocked(false);
    } else {
      setBlocked(permission === 'denied');
    }
  };
  if (!supported) return null;
  return (
    <>
      <ToggleRow
        label="Between classes"
        description="A notification when a class ends, with what comes next"
        on={on}
        onToggle={toggle}
      />
      {blocked && !on && (
        <p className="text-xs text-muted-foreground">Your browser is blocking notifications for Praelecta. Allow them in the browser's site settings, then turn this on.</p>
      )}
    </>
  );
}

/**
 * The cookie banner's question, answerable again at any time. Turning it off
 * reloads the page when analytics already started on it: the SDK has no
 * stop call, and a reload is what ends the running copy (see
 * lib/analyticsConsent.js).
 */
function AnalyticsToggle() {
  const [on, setOn] = useState(() => effectiveConsent() === 'granted');
  useEffect(() => {
    const onChange = (event) => setOn(event.detail === 'granted');
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);
  const toggle = () => {
    if (on) {
      const wasRunning = analyticsStarted();
      setConsent('denied');
      setOn(false);
      if (wasRunning) window.location.reload();
    } else {
      setConsent('granted');
      setOn(true);
    }
  };
  return (
    <>
      <ToggleRow
        label="Analytics cookie"
        description="Lets us see which pages and buttons get used, so we can improve Praelecta. Off unless you turn it on."
        on={on}
        onToggle={toggle}
      />
      <Link to="/privacy#cookies" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">What it collects</Link>
    </>
  );
}
