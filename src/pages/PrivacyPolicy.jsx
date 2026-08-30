import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Shield, Lock, Database, Trash2, Mail, Server } from 'lucide-react';

// Effective date is shown to users; update when the policy materially changes.
const EFFECTIVE_DATE = 'August 2, 2026';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Settings
      </Link>

      <div className="flex items-start gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground mt-1">Effective {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        This policy explains what Praelecta collects, how it’s used, and the control you have over it.
        It’s written to be read — not to be dense. If anything here is unclear, reach out and we’ll explain it plainly.
      </p>

      <Section icon={Database} title="What we store">
        <p>Praelecta stores only what it needs to be your study companion:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><span className="font-medium text-foreground">Lecture recordings and transcripts</span> that you choose to record, along with the AI-generated summaries, concepts, and flashcards built from them.</li>
          <li><span className="font-medium text-foreground">Your notes</span> typed during or after class.</li>
          <li><span className="font-medium text-foreground">Your schedule</span> — classes, semesters, attendance, assignments, and calendar events you add.</li>
          <li><span className="font-medium text-foreground">Study activity</span> — review sessions, practice results, and the knowledge-coverage map that tracks which concepts you’ve mastered.</li>
          <li><span className="font-medium text-foreground">Your account basics</span> — the email you sign in with.</li>
        </ul>
      </Section>

      <Section icon={Lock} title="Your recordings stay yours">
        <p>
          Lecture recordings and transcripts are private to your account. They are never shown to other students, never
          shared between accounts, and never made public by Praelecta. Recording a lecture requires your instructor’s
          permission, which the app asks you to confirm before your first recording in each class.
        </p>
      </Section>

      <Section icon={Server} title="How your data is used">
        <p>
          Your content is used to power the features you see: transcribing recordings, generating summaries and study
          material, tracking coverage, and planning study sessions. To do this, recording audio and transcript text are
          processed by third-party AI services (for transcription and summarization) solely to produce your results.
          Your data is <span className="font-medium text-foreground">not</span> sold, and it is not used to advertise to you.
        </p>
      </Section>

      <Section icon={Trash2} title="Your controls">
        <p>You’re in control of your data at any time from <Link to="/settings" className="text-primary hover:underline">Settings → Data &amp; Privacy</Link>:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><span className="font-medium text-foreground">Export</span> — download a full copy of your data as a file.</li>
          <li><span className="font-medium text-foreground">Delete</span> — permanently erase your academic data from your account.</li>
        </ul>
        <p className="mt-2">
          Deletion removes your lectures, transcripts, notes, study history, schedule, and coverage data. This can’t be
          undone, so the app asks you to confirm first.
        </p>
      </Section>

      <Section icon={Database} title="Data retention">
        <p>
          Your data is kept for as long as your account is active so it’s there when you come back next semester. When you
          delete your data, it’s removed from your account. Copies in routine encrypted backups age out on our provider’s
          normal backup cycle; contact us if you need those purged sooner.
        </p>
      </Section>

      <Section icon={Mail} title="Contact">
        <p>
          Questions about your privacy, or a request about your data? Reach out through the in-app support link and we’ll
          respond. For account holders in Canada, you have rights under applicable provincial and federal privacy law,
          including the right to access and correct your personal information.
        </p>
      </Section>

      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">Praelecta • Privacy Policy • {EFFECTIVE_DATE}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}
