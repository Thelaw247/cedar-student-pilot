import React from "react";
import { Check } from "lucide-react";
import { CEDAR_LOGO_URL } from "@/lib/brand";

/**
 * The auth shell for Login, Register, Forgot- and Reset-password (Aug 2026
 * redesign). Desktop (lg+) is a split screen: a deep-navy brand panel — the
 * same constant surface as the recording island, with a soft brand-blue
 * glow — carrying the wordmark and the three-line pitch, beside the form.
 * Below lg it collapses to the classic centered card with the brandmark on
 * top. Pure presentation: every page's form logic is untouched.
 */
const PITCH = [
  'Record the lecture — Cedar takes the notes',
  'Transcripts, summaries and flashcards, minutes after class',
  'Your recordings stay private to you',
];

export default function AuthLayout({ icon: Icon, title, subtitle = '', footer = null, children = null }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Brand panel — desktop only */}
      <div
        className="hidden lg:flex w-[44%] max-w-xl flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{ backgroundColor: '#14192A' }}
      >
        {/* Soft brand glow, purely decorative */}
        <div
          aria-hidden="true"
          className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(46,102,255,0.28) 0%, rgba(46,102,255,0) 70%)' }}
        />
        <div className="relative flex items-center gap-3">
          <img src={CEDAR_LOGO_URL} alt="" className="w-9 h-9" />
          <span className="font-heading text-lg font-bold tracking-tight">Cedar</span>
        </div>
        <div className="relative">
          <h2 className="font-heading text-3xl font-bold leading-tight mb-6 text-balance">
            Every lecture, remembered for you.
          </h2>
          <ul className="space-y-3.5">
            {PITCH.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-white/80">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-[1px]">
                  <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">
          Made in Canada · Your recordings stay private to you
        </p>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {/* Brandmark on mobile (the panel carries it on desktop);
                the page's own icon in a quiet chip on desktop. */}
            <img src={CEDAR_LOGO_URL} alt="Cedar" className="w-12 h-12 mx-auto mb-4 lg:hidden" />
            <div className="hidden lg:inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
          </div>
          <div className="bg-card rounded-2xl shadow-2 border border-border p-6 sm:p-8">
            {children}
          </div>
          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}
