import { useEffect } from 'react';

/**
 * Writes a public page's title and description into the document while the
 * page is mounted, and puts the previous ones back when it unmounts, so the
 * app's own pages keep theirs.
 *
 * Every public page reads its strings from lib/publicPages.js — the same
 * table the build uses to write the served <head> for that route — so what a
 * crawler reads and what a visitor's tab shows are one string, not two.
 */
export function usePublicPageMeta({ title, description }) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') || null;
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle;
      if (!description) return;
      if (previousDescription === null) meta?.remove();
      else meta?.setAttribute('content', previousDescription);
    };
  }, [title, description]);
}
