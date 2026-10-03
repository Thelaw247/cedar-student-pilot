import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONSENT_EVENT, effectiveConsent, setConsent } from '@/lib/analyticsConsent';

/**
 * The cookie banner: one question, asked once per browser.
 *
 * Product analytics (lib/analyticsConsent.js) starts only after "Allow
 * analytics". Both answers are buttons of the same size and weight, and
 * neither is pre-selected: the banner asks, it does not steer. Closing the
 * page without answering leaves analytics off and asks again next visit.
 *
 * Sits above the phone bottom nav (BottomNav, z-40) and below dialogs
 * (z-50), so it never hides a dialog's buttons; .cookie-consent in index.css
 * sets how far up it sits, lifted over the bottom nav only where there is
 * one. Settings → Privacy changes the answer later; the CONSENT_EVENT
 * listener hides the banner if that happens in another component first.
 */
export default function CookieConsent() {
  const [answer, setAnswer] = useState(() => effectiveConsent());

  useEffect(() => {
    const onChange = (event) => setAnswer(event.detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (answer) return null;

  const choose = (value) => {
    setConsent(value);
    setAnswer(value);
  };

  const button = 'flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    <section
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="cookie-consent fixed inset-x-4 z-[45] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-foreground shadow-2 lg:inset-x-auto lg:left-6"
    >
      <h2 id="cookie-consent-title" className="text-sm font-semibold">Allow an analytics cookie?</h2>
      <p id="cookie-consent-body" className="mt-1 text-xs leading-5 text-muted-foreground">
        It shows us which pages and buttons get used, so we can improve Praelecta. Nothing is tracked unless you
        allow it, and you can change your answer in Settings.{' '}
        <Link to="/privacy#cookies" className="font-medium text-foreground underline underline-offset-2">Cookie details</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className={button} onClick={() => choose('granted')}>Allow analytics</button>
        <button type="button" className={button} onClick={() => choose('denied')}>Don&rsquo;t allow</button>
      </div>
    </section>
  );
}
