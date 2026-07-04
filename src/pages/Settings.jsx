import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sun, Moon, Bell, Sparkles, Clock, Palette, Calendar, Mail, Loader2, Check } from 'lucide-react';

export default function Settings() {
  const [isDark, setIsDark] = useState(false);
  const [googleCalConnected, setGoogleCalConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = (dark) => {
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('cedar-theme', dark ? 'dark' : 'light');
  };

  const connectGoogleCalendar = async () => {
    setConnecting(true);
    try {
      const connection = await base44.connectAppUser('6a41cf62255e656d3c2b684a');
      if (connection?.url) {
        window.location.href = connection.url;
      }
    } catch (e) {
      console.error(e);
    }
    setConnecting(false);
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

      <SettingsSection icon={Calendar} title="Google Calendar">
        <p className="text-sm text-muted-foreground mb-3">Sync your Cedar events with Google Calendar for two-way synchronization.</p>
        <button onClick={connectGoogleCalendar} disabled={connecting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
          {googleCalConnected ? 'Connected' : 'Connect Google Calendar'}
        </button>
      </SettingsSection>

      <SettingsSection icon={Bell} title="Notifications">
        <Toggle label="Class reminders" description="Get notified before classes start" defaultOn />
        <Toggle label="Study session reminders" description="Alert before scheduled study blocks" defaultOn />
        <Toggle label="Assignment deadlines" description="Reminders for upcoming due dates" defaultOn />
      </SettingsSection>

      <SettingsSection icon={Sparkles} title="AI Features">
        <Toggle label="Auto-generate lecture summaries" description="Process recordings automatically" defaultOn />
        <Toggle label="Auto-generate study schedules" description="Plan sessions when adding exams" defaultOn />
        <Toggle label="AI flashcards & quizzes" description="Create study material from lectures" defaultOn />
      </SettingsSection>

      <SettingsSection icon={Clock} title="Recording">
        <Toggle label="High quality audio" description="Larger files, better transcription" defaultOn />
        <Toggle label="Auto-transcribe" description="Process immediately after recording" defaultOn />
      </SettingsSection>

      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">Cedar Student Pilot • v1.0</p>
    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, description, defaultOn }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`}></span>
      </button>
    </div>
  );
}