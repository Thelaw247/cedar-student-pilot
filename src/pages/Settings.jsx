import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sun, Moon, Bell, Sparkles, Clock, Palette, Check, AlertCircle, GraduationCap, BookOpen, Shield, User, Zap, LineChart, ArrowRight, LifeBuoy, Mail } from 'lucide-react';
import { getSetting, setSetting } from '@/lib/settings';
import ProfileSettings from '@/components/ProfileSettings';
import DeleteAccountSection from '@/components/DeleteAccountSection';
import SubscriptionSettings from '@/components/SubscriptionSettings';
import ReviewScheduleSection from '@/components/ReviewScheduleSection';
import LearningModeToggle from '@/components/LearningModeToggle';
import ConceptDecaySettings from '@/components/ConceptDecaySettings';
import DataExportSection from '@/components/DataExportSection';
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

      <SettingsSection icon={Palette} title="Appearance">
        <div className="space-y-2">
          <button onClick={() => toggleTheme(false)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${!isDark ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <Sun className="w-5 h-5 text-amber-500" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium">Light Mode</p>
              <p className="text-xs text-muted-foreground">Blue and white — focus-optimized</p>
            </div>
            {!isDark && <Check className="w-4 h-4 text-primary" />}
          </button>
          <button onClick={() => toggleTheme(true)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${isDark ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <Moon className="w-5 h-5 text-indigo-500" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Black and white — for night studying</p>
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

      <SettingsSection icon={Bell} title="Notifications">
        <Toggle label="Class reminders" description="Get notified before classes start" settingKey="classReminders" />
        <Toggle label="Study session reminders" description="Alert before scheduled study blocks" settingKey="studySessionReminders" />
        <Toggle label="Assignment deadlines" description="Reminders for upcoming due dates" settingKey="assignmentDeadlines" />
        <div className="mt-3 rounded-lg bg-muted/50 p-3 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">When study session reminders are on, we also send email fallbacks if you haven't opened the app.</p>
        </div>
      </SettingsSection>

      <SettingsSection icon={Sparkles} title="AI Features">
        <Toggle label="Auto-generate lecture summaries" description="Process recordings automatically" settingKey="autoGenerateSummaries" />
        <Toggle label="Auto-generate study schedules" description="Plan sessions when adding exams" settingKey="autoGenerateSchedules" />
        <Toggle label="AI flashcards & quizzes" description="Create study material from lectures" settingKey="autoFlashcards" />
      </SettingsSection>

      <SettingsSection icon={GraduationCap} title="Review Schedule">
        <ReviewScheduleSection />
      </SettingsSection>

      <SettingsSection icon={BookOpen} title="Learning Mode">
        <LearningModeToggle />
        <ConceptDecaySettings />
      </SettingsSection>

      <SettingsSection icon={Clock} title="Recording">
        <Toggle label="High quality audio" description="Larger files, better transcription" settingKey="highQualityAudio" />
        <Toggle label="Auto-transcribe" description="Process immediately after recording" settingKey="autoTranscribe" />
      </SettingsSection>

      <SettingsSection icon={Shield} title="Data & Privacy">
        <DataExportSection />
      </SettingsSection>

      {/* Plan, credits and purchases. Reads CreditBalance / UsageEvent, both
          RLS-scoped to the signed-in user. */}
      <SettingsSection icon={Zap} title="Plan & Credits">
        <SubscriptionSettings />
      </SettingsSection>

      {/* Profile: name, email, password, sign out, delete account. */}
      <SettingsSection icon={User} title="Account">
        <ProfileSettings />
        <div className="mt-5 pt-4 border-t border-border">
          <DeleteAccountSection />
        </div>
      </SettingsSection>

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

      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">Praelecta • v1.0</p>
    </div>
  );
}

function SettingsSection({ icon, title, children }) {
  // Widget grammar: every group collapses and the choice is remembered per
  // user (storageKey derived from the title), so a long settings page reads
  // as a scannable index instead of a wall.
  const storageKey = `set-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <Widget icon={icon} title={title} collapsible storageKey={storageKey} className="mb-4" padded>
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
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button onClick={toggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`}></span>
      </button>
    </div>
  );
}