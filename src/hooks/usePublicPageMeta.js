import { useEffect } from 'react';
import { LANDING_DESCRIPTION, LANDING_TITLE } from '@/lib/publicPages';

/**
 * Writes a page's title and description into the document while the page is
 * mounted, and puts the site's defaults back when it unmounts.
 *
 * Every public page reads its strings from lib/publicPages.js — the same
 * table the build uses to write the served <head> for that route — so what a
 * crawler reads and what a visitor's tab shows are one string, not two.
 *
 * The cleanup restores the site defaults, not whatever the tab showed when
 * the page mounted. It used to restore the latter, and a visitor who arrived
 * on /pricing (whose served head already says "Pricing | Praelecta") then
 * pressed the button carried that title and description onto /register and
 * every app page after it (Oct 2026 audit).
 *
 * `noindex` adds <meta name="robots" content="noindex"> for as long as the
 * page is mounted: the 404 page, which the host serves with a 200 because
 * the app is a single-page app, must not be indexed as a real page.
 */
export function usePublicPageMeta({ title, description, noindex = false }) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    let robots = null;
    if (noindex) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      robots.setAttribute('content', 'noindex');
      document.head.appendChild(robots);
    }

    return () => {
      if (title) document.title = LANDING_TITLE;
      if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', LANDING_DESCRIPTION);
      robots?.remove();
    };
  }, [title, description, noindex]);
}
