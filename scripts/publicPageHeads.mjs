import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_PAGES, publicPageUrl } from '../shared/publicPages.js';

/**
 * One HTML file per public route, so a crawler that does not run JavaScript
 * reads the right <title>, description and canonical for /pricing, /about,
 * the /vs pages and the rest — instead of the homepage's, which is what the
 * single-page fallback hands out for every route.
 *
 * Used as a Vite plugin (vite.config.js): after the bundle is written, the
 * built index.html is copied to dist/<route>.html with its head rewritten.
 * Cloudflare's static assets serve dist/pricing.html for /pricing as-is, so
 * nothing runs at request time and the URL a visitor sees does not change;
 * every other route still falls back to index.html. The page's own runtime
 * setter (MarketingShell / usePublicPageMeta) keeps the head right on
 * client-side navigation.
 *
 * Only the tags below are touched. og:image, the JSON-LD blocks and the rest
 * of the head are the same on every page on purpose.
 */

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const replaceOnce = (html, pattern, replacement, what) => {
  const count = (html.match(pattern) || []).length;
  if (count !== 1) throw new Error(`publicPageHeads: expected exactly one ${what} in index.html, found ${count}`);
  return html.replace(pattern, replacement);
};

/** The head of the built homepage, rewritten for one route. */
export function headForRoute(indexHtml, route, page) {
  const url = publicPageUrl(route);
  let html = indexHtml;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`, 'description');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(page.title)}" />`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`, 'og:description');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`, 'og:url');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, 'canonical');
  return html;
}

/** Writes dist/<route>.html for every public route but the homepage. */
export function writePublicPageHeads(outDir) {
  const indexHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const written = [];
  for (const [route, page] of Object.entries(PUBLIC_PAGES)) {
    if (route === '/') continue;
    const file = path.join(outDir, `${route.slice(1)}.html`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, headForRoute(indexHtml, route, page));
    written.push(path.relative(outDir, file));
  }
  return written;
}

/** Vite plugin: run after the bundle lands in outDir. */
export default function publicPageHeads() {
  let outDir = 'dist';
  return {
    name: 'praelecta-public-page-heads',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const written = writePublicPageHeads(outDir);
      console.log(`[public pages] ${written.length} route heads written: ${written.join(', ')}`);
    },
  };
}
