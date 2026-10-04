import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Shield, Lock, Database, Trash2, Mail, Server, Globe, Cookie, UserCheck } from 'lucide-react';
import { PRIVACY_EFFECTIVE_DATE, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/legal';
import { PUBLIC_PAGES } from '@/lib/publicPages';
import { FOUNDER } from '@/lib/founder';
import { usePublicPageMeta } from '@/hooks/usePublicPageMeta';
import { useAuth } from '@/lib/AuthContext';

// Shown to users, and shared with lib/legal.js so the recorded consent
// version and the date on this page cannot drift apart.
const EFFECTIVE_DATE = PRIVACY_EFFECTIVE_DATE;

/**
 * The privacy policy, in plain words.
 *
 * Rewritten Oct 2026 against the code rather than from memory. Every list
 * here names what the app actually stores, sends and keeps: the profile
 * fields, the reviews, the consent record, the analytics behind the cookie
 * banner (lib/analyticsConsent.js), the browser storage the app uses, where
 * the providers run, and where each control really is in Settings. When the
 * code changes what it collects, this page changes in the same commit, with
 * a new date and LEGAL_VERSION in lib/legal.js.
 */
export default function PrivacyPolicy() {
  usePublicPageMeta(PUBLIC_PAGES['/privacy']);
  const { isAuthenticated } = useAuth();
  return (
    <main id="main" className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to={isAuthenticated ? '/settings' : '/'} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {isAuthenticated ? 'Settings' : 'Home'}
      </Link>

      <div className="flex items-start gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Shield className="w-6 h-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground mt-1">Effective {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        This policy explains what Praelecta collects, how it&rsquo;s used, and the control you have over it. If anything
        here is unclear, email us and we&rsquo;ll explain it plainly.
      </p>

      <Section icon={Database} title="What we store">
        <p>Praelecta stores what it needs to be your study companion:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><span className="font-medium text-foreground">Lecture recordings and transcripts</span> you choose to record, and the summaries, concepts, flashcards and questions built from them.</li>
          <li><span className="font-medium text-foreground">Files you add</span>: course files you attach to a lecture or class (a syllabus, slides, a past exam), and the timetable picture or PDF you upload when setting up a semester.</li>
          <li><span className="font-medium text-foreground">Your notes, to-dos and schedule</span>: classes (with the instructor and room you enter), semesters, attendance, assignments, study sessions and calendar events.</li>
          <li><span className="font-medium text-foreground">Study activity</span>: review sessions, practice results and the coverage map of which concepts you&rsquo;ve learned.</li>
          <li><span className="font-medium text-foreground">Your account</span>: your email and password (stored hashed), and, if you add them, your name, profile photo and preferred study times.</li>
          <li><span className="font-medium text-foreground">Plan and usage</span>: your plan and credit balance, what each AI action cost, and which setup and upgrade screens you went through, so your balance is right and we can see where the app confuses people.</li>
          <li><span className="font-medium text-foreground">Your review</span>, if you write one: the rating and words, and the name, course and school you choose to show with it.</li>
          <li><span className="font-medium text-foreground">Your agreement</span>: which version of these documents you accepted at sign-up, and when.</li>
        </ul>
      </Section>

      <Section icon={Lock} title="Your recordings stay yours">
        <p>
          Lecture recordings and transcripts are private to your account. They are never shown to other students, never
          shared between accounts, and never made public by Praelecta. Recording a lecture requires your instructor&rsquo;s
          permission, which the app asks you to confirm before your first recording in each class.
        </p>
      </Section>

      <Section icon={Server} title="How your data is used, and by whom">
        <p>
          Your content is used to power the features you see: transcribing recordings, writing summaries and study
          material, tracking coverage and planning study sessions. To do this, these named providers process it, only to
          produce your results:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><span className="font-medium text-foreground">Groq</span> transcribes your recordings (speech to text). Groq does not retain audio from these requests by default, and its terms do not permit it to use your audio to train models.</li>
          <li><span className="font-medium text-foreground">Deepgram</span> transcribes a recording only when Groq is unavailable. Every request is sent opted out of Deepgram&rsquo;s model-improvement program, so the audio is kept only for as long as the request takes and is not used for training.</li>
          <li><span className="font-medium text-foreground">Google Gemini</span> (the paid Gemini API) reads transcripts, the files you attach and your timetable upload to write summaries, concepts, flashcards, questions and study plans, and to read your classes off the timetable. Google does not use these prompts or responses to improve its products; it may log them for a limited period solely to detect abuse.</li>
        </ul>
        <p className="mt-2">
          Your audio and files are stored in your account&rsquo;s private storage on Cloudflare R2, your account data on
          Supabase (Postgres, which also handles sign-in), and the app runs on Cloudflare and Render. Stripe handles
          payments (we never see your card number) and Resend delivers our emails. Each of these processes only what its job
          needs. Your data is <span className="font-medium text-foreground">not</span> sold, it is not used to advertise to
          you, and we do not use your recordings to train anything.
        </p>
        <p className="mt-2">
          <span className="font-medium text-foreground">HeyCatch</span> (built on PostHog) is the product analytics, and it
          runs only if you allow the analytics cookie. Then it records which pages you open, what you click (the text of the
          button or link, which can be a class or lecture title, but never the notes or transcript inside a lecture), the
          site that sent you and any campaign tag in the link, your browser and device type, and, once you&rsquo;re signed
          in, your account id, email, name and sign-up date, so the parts of Praelecta that confuse people can be found and
          fixed. Separately, our server tells HeyCatch when you start a subscription or buy credits, so every sale is
          counted; that report uses no cookie. Your recordings, transcripts and uploaded files are never sent to HeyCatch.
        </p>
        <p className="mt-2">
          If you use the music player in focus mode, the track plays from <span className="font-medium text-foreground">YouTube</span>
          {' '}in its privacy-enhanced mode, so YouTube receives your IP address and may set cookies once you press play.
        </p>
      </Section>

      <Section icon={Globe} title="Where your data is processed">
        <p>
          Praelecta is run from Canada, but its providers process data in the United States and in other countries where
          they operate: the account database and the API server are in the eastern United States, and Cloudflare serves the
          app from its worldwide network. Data held in another country can be subject to that country&rsquo;s laws, including
          lawful requests from its authorities.
        </p>
      </Section>

      <Section icon={Cookie} title="Cookies and similar storage" id="cookies">
        <p>Praelecta keeps a few things in your browser. These are needed for the app to work and are always on:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><span className="font-medium text-foreground">Sign-in</span>: your session, in local storage, so you stay signed in.</li>
          <li><span className="font-medium text-foreground">Preferences</span>: light or dark mode, tips you dismissed, panels you collapsed, and your answer to the cookie question.</li>
          <li><span className="font-medium text-foreground">An offline copy</span> of your classes and lectures, so pages open quickly and work without a connection. It is removed when you sign out.</li>
          <li><span className="font-medium text-foreground">A recording backup</span>: a lecture being recorded is kept in your browser until it uploads, so a crash or a closed tab doesn&rsquo;t lose it.</li>
          <li><span className="font-medium text-foreground">Unsaved forms</span>: what you have typed into a form you haven&rsquo;t saved yet, in this tab only, so going back doesn&rsquo;t lose it. It is removed when you save or close the form, close the tab, or sign out.</li>
        </ul>
        <p className="mt-2">
          One is optional: the <span className="font-medium text-foreground">analytics cookie</span> (names starting
          {' '}<code className="text-xs">ph_</code>, kept for up to a year) used by HeyCatch, as described above. It is off
          unless you allow it in the banner, and you can turn it on or off at any time in{' '}
          <Link to="/settings" className="text-primary hover:underline">Settings → Data &amp; Privacy</Link>. A browser that
          sends Global Privacy Control is treated as a no.
        </p>
        <p className="mt-2">
          Stripe sets its own cookies on its checkout and billing pages, under Stripe&rsquo;s privacy policy, and YouTube may
          set cookies when you play a track.
        </p>
      </Section>

      <Section icon={Trash2} title="Your controls">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><span className="font-medium text-foreground">Export</span>, in <Link to="/settings" className="text-primary hover:underline">Settings → Data &amp; Privacy</Link>: download your account data as a file, including your lectures, transcripts, notes, schedule, study history, credits, review and the record of what you agreed to. The audio itself stays in your lectures, where you can play it.</li>
          <li><span className="font-medium text-foreground">Delete your account</span>, in <Link to="/settings" className="text-primary hover:underline">Settings → Account</Link>: cancels any subscription, then permanently erases your account and everything in it, including recordings, files and unused credits. This can&rsquo;t be undone, so the app asks you to confirm first.</li>
          <li><span className="font-medium text-foreground">Your review</span>, in Settings → Your review: change it, take it off praelecta.ca, or delete it.</li>
          <li><span className="font-medium text-foreground">Analytics</span>, in Settings → Data &amp; Privacy: turn the analytics cookie on or off.</li>
        </ul>
        <p className="mt-2">
          Stripe keeps its own record of payments you made. Analytics data already sent to HeyCatch is not removed
          automatically when you delete your account; email us and we&rsquo;ll have it deleted.
        </p>
      </Section>

      <Section icon={Database} title="Data retention">
        <p>
          Your data is kept for as long as your account is active, so it&rsquo;s there when you come back next semester.
          When you delete something, it&rsquo;s removed from your account. Copies in routine encrypted backups age out on our
          provider&rsquo;s normal backup cycle; contact us if you need those purged sooner.
        </p>
      </Section>

      <Section icon={UserCheck} title="Children">
        <p>
          Praelecta is made for college and university students. It isn&rsquo;t directed at children, and we don&rsquo;t
          knowingly collect personal information from anyone under 13. If you believe a child has given us information,
          email us and we&rsquo;ll delete it.
        </p>
      </Section>

      <Section icon={Mail} title="Who is responsible, and how to reach us">
        <p>
          Praelecta is run by {FOUNDER.name} in Saskatoon, Saskatchewan, Canada, who is accountable for how your personal
          information is handled. For a question about your privacy, or a request to access, correct or delete your
          information, email <a href={SUPPORT_MAILTO} className="text-primary hover:underline">{SUPPORT_EMAIL}</a> and
          we&rsquo;ll respond. You have rights under Canadian privacy law, including the right to access and correct your
          personal information, and if you&rsquo;re not satisfied with our answer you can complain to the Office of the
          Privacy Commissioner of Canada.
        </p>
      </Section>

      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">
        Praelecta • Privacy Policy • {EFFECTIVE_DATE} • <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
      </p>
    </main>
  );
}

function Section({ icon: Icon, title, id = undefined, children }) {
  return (
    <section id={id} className="rounded-xl border border-border bg-card p-5 mb-4 scroll-mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" strokeWidth={2} aria-hidden="true" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
