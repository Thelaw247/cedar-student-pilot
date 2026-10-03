import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MarketingShell from '@/components/landing/MarketingShell';
import { useAuth } from '@/lib/AuthContext';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/legal';

/**
 * Every address the app has no route for.
 *
 * The host answers every path with the app and a 200 (it is a single-page
 * app), so this page is the only thing that can tell a search engine the
 * address is not a page: it renders inside the public site's frame with
 * `noindex` and its own title.
 *
 * Rewritten Oct 2026. The page it replaced came from the app builder: a grey
 * slate screen in another design system, a "Go Home" button that reloaded the
 * whole app, an extra sign-in request on every miss, and an "Admin Note"
 * telling the owner to ask an AI to build the missing page.
 */
export default function PageNotFound() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const home = isAuthenticated ? { to: '/today', label: 'Go to Today' } : { to: '/', label: 'Go to the homepage' };

  return (
    <MarketingShell
      title="Page not found | Praelecta"
      description="This address is not a page on Praelecta."
      noindex
    >
      <section className="px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">This page doesn&rsquo;t exist.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Nothing lives at <code className="break-all rounded-md bg-muted px-1.5 py-0.5 text-sm text-foreground">{pathname}</code>.
            The link may be mistyped, or the page may have moved.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={home.to} className="auth-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              {home.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.06]">
              See pricing
            </Link>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Followed a link from Praelecta that brought you here? Tell us at{' '}
            <a href={SUPPORT_MAILTO} className="font-medium text-foreground underline underline-offset-2">{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
