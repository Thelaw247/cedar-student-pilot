import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Linkedin, Mail, MapPin } from 'lucide-react';
import MarketingShell from '@/components/landing/MarketingShell';
import { FOUNDER } from '@/lib/founder';

/**
 * /about — the person behind Praelecta.
 *
 * Every other page on the site says "we". This one says who. A student is
 * being asked to hand over lecture audio and a card number to an app that,
 * until 18 Sep 2026, had no name, face or address on it anywhere except a
 * GitHub username in the download links. Name, photo, the reason it exists,
 * and a way to reach a person — that is the whole page.
 */
function FounderPhoto() {
  const [missing, setMissing] = useState(false);
  if (missing || !FOUNDER.photo) {
    return (
      <div className="flex h-36 w-36 items-center justify-center rounded-[28px] border border-border bg-primary/10 text-3xl font-bold text-primary" aria-label={FOUNDER.name}>
        {FOUNDER.initials}
      </div>
    );
  }
  return (
    <img src={FOUNDER.photo} alt={`${FOUNDER.name}, founder of Praelecta`} onError={() => setMissing(true)}
      className="h-36 w-36 rounded-[28px] border border-border object-cover shadow-[0_18px_55px_-35px_rgba(0,0,0,0.6)]" />
  );
}

export default function About() {
  return (
    <MarketingShell
      title="About — Praelecta"
      description={`Praelecta is built by ${FOUNDER.name}, an engineering student in Saskatoon, for students who would rather not redo the whole course at exam time.`}>
      <section className="px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-primary">About</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">Built by a student, for the lecture I could not keep up with.</h1>

          <div className="mt-10 flex flex-col gap-6 rounded-[26px] border border-border bg-card p-6 sm:flex-row sm:items-start sm:p-8">
            <FounderPhoto />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-foreground">{FOUNDER.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{FOUNDER.role} · {FOUNDER.line}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {FOUNDER.location}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {FOUNDER.linkedin && (
                  <a href={FOUNDER.linkedin} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                    <Linkedin className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> LinkedIn
                  </a>
                )}
                <a href={`mailto:${FOUNDER.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                  <Mail className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {FOUNDER.email}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-5 text-base leading-7 text-muted-foreground">
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">Why I built this</h2>
            <p>
              I built Praelecta before starting engineering at the University of Saskatchewan, for one reason: in a fast lecture you can listen or you can write, and I could never do both. Whatever I wrote down was half of what was said, and the half I missed was usually the half on the test.
            </p>
            <p>
              So the app does the writing. You press record, go to class, and by the time you are out of the room the lecture is a transcript, a summary, flashcards and practice questions. When the exam gets announced, the study sessions book themselves around your calendar. I use it for my own courses every week, which is also why the things that annoy students about study apps — hidden quotas, cancel screens built to lose you, paywalls dressed up as errors — are written out of this one in the code, not in a promise.
            </p>
            <p>
              Praelecta is made in Canada, priced in Canadian dollars, and bills by the semester because that is how school actually works. If something is wrong, or you want something it does not do yet, email me. It will be me who answers.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="auth-cta inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/changelog" className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground/85 transition-colors hover:bg-muted">
              See what shipped recently
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
