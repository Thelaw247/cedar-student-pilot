import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_MARK_URL } from '@/lib/brand';
import { FOUNDER } from '@/lib/founder';

/**
 * The footer of every public page: the mark, the person behind the product,
 * and the links a visitor looks for at the bottom.
 *
 * The founder's name sits next to "Made in Canada" on purpose: a study app
 * asking for lecture audio should have a person on it, not only a flag. The
 * LinkedIn link appears only once the address is filled in (lib/founder.js).
 */
export default function LandingFooter() {
  return (
    <footer className="px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src={BRAND_MARK_URL} alt="" className="h-7 w-7 object-contain" />
          <div>
            <p className="text-sm font-semibold text-foreground">Praelecta</p>
            <p className="text-xs text-muted-foreground">
              Made in Canada by{' '}
              <Link to="/about" className="font-medium text-foreground/80 hover:text-foreground">{FOUNDER.name}</Link>
              {FOUNDER.linkedin && (
                <> · <a href={FOUNDER.linkedin} target="_blank" rel="noreferrer" className="hover:text-foreground">LinkedIn</a></>
              )}
              {' '}· Your recordings stay private to you
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
          <a href="/#recording" className="hover:text-foreground">Recording</a>
          <a href="/#test-coverage" className="hover:text-foreground">Test coverage</a>
          <a href="/#study-schedule" className="hover:text-foreground">Study schedule</a>
          <a href="/#study-system" className="hover:text-foreground">Study tools</a>
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <a href="/#faq" className="hover:text-foreground">FAQ</a>
          <a href="/#download" className="hover:text-foreground">Desktop app</a>
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/changelog" className="hover:text-foreground">What's new</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/login" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
