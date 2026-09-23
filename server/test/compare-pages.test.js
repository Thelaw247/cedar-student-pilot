import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COMPETITORS, COMPARISON_ROWS, PRAELECTA_FACTS } from '../../shared/competitors.js';
import { PUBLIC_PAGES, PUBLIC_PATHS, publicPageUrl } from '../../shared/publicPages.js';
import { TIERS } from '../../shared/tiers.js';
import { headForRoute } from '../../scripts/publicPageHeads.mjs';

/**
 * The comparison pages and the per-route <head>, from the 22 Sep 2026 audit.
 *
 * D5.3 wanted /vs pages against the three closest competitors, each with a
 * two-column table, a "when to pick" section for each side, a sitemap entry
 * and a footer link. D5.1 wanted a description of its own on every page: the
 * single-page fallback hands a crawler the homepage's <head> for every route,
 * so the build writes one HTML file per public route with that page's own
 * title, description and canonical.
 *
 * The competitor columns are facts from their sites on a stated date; the
 * tests here hold the shape honest (every row answered, every source a URL,
 * a date, both sides of the "when to pick" question) — they cannot check the
 * facts themselves. Re-read the sources each term.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const APP = read('../../src/App.jsx');
const PAGE = read('../../src/pages/Compare.jsx');
const FOOTER = read('../../src/components/landing/LandingFooter.jsx');
const INDEX = read('../../index.html');
const SITEMAP = read('../../public/sitemap.xml');
const LLMS = read('../../public/llms.txt');
const VITE = read('../../vite.config.js');

test('there is a routed, listed, linked comparison page for each competitor', () => {
  assert.equal(COMPETITORS.length, 3);
  for (const c of COMPETITORS) {
    const path = `/vs/${c.slug}`;
    assert.ok(APP.includes(`path="${path}" element={<Compare competitor="${c.slug}" />}`), `${path} has no route`);
    assert.ok(PUBLIC_PATHS.includes(path), `${path} is not in lib/publicPages.js, so it gets the homepage <head>`);
    assert.ok(SITEMAP.includes(`<loc>https://praelecta.ca${path}</loc>`), `${path} is not in the sitemap`);
    assert.ok(LLMS.includes(`https://praelecta.ca${path}`), `${path} is not in llms.txt`);
    assert.match(PUBLIC_PAGES[path].title, new RegExp(`^Praelecta vs ${c.name}`));
  }
  assert.ok(APP.indexOf('path="/vs/lemora"') < APP.indexOf('<ProtectedRoute'), 'the comparison pages must be public');
  assert.match(FOOTER, /Compare<\/span>/, 'the footer needs the "Compare" heading the audit asked for');
  assert.match(FOOTER, /to=\{`\/vs\/\$\{c\.slug\}`\}/);
});

test('every competitor column answers every row, from dated, linked sources, and argues both ways', () => {
  for (const c of COMPETITORS) {
    for (const row of COMPARISON_ROWS) {
      assert.ok(PRAELECTA_FACTS[row.id]?.length > 20, `Praelecta has no answer for "${row.label}"`);
      assert.ok(c.facts[row.id]?.length > 20, `${c.name} has no answer for "${row.label}"`);
    }
    assert.match(c.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(c.sources.length >= 4, `${c.name}: too few sources to check the column against`);
    for (const href of c.sources) assert.match(href, /^https:\/\//);
    assert.ok(c.sources.some((href) => href.startsWith(c.url)), `${c.name}: no source on their own domain`);
    assert.ok(c.whenPraelecta.length >= 3 && c.whenThem.length >= 3, `${c.name}: a comparison that only argues one way is a pitch`);
    assert.ok(c.facts.price.includes('USD'), `${c.name}'s price cell must say the currency; Praelecta's is CAD`);
  }
  // Praelecta's price column comes from tiers.js, never typed in.
  assert.ok(PRAELECTA_FACTS.price.includes(`$${TIERS.student.semester.toFixed(2)}`));
  assert.ok(PRAELECTA_FACTS.price.includes('CAD'));
});

test('the page has the audit’s structure: h1, a two-column table, and a section for each side', () => {
  assert.match(PAGE, /<h1[^>]*>Praelecta vs \{them\.name\}<\/h1>/);
  assert.match(PAGE, /<table/);
  assert.match(PAGE, /<th scope="col"[^>]*>Praelecta<\/th>/);
  assert.match(PAGE, /<th scope="col"[^>]*>\{them\.name\}<\/th>/);
  assert.match(PAGE, /When to pick Praelecta/);
  assert.match(PAGE, /When to pick \{them\.name\}/);
  assert.match(PAGE, /them\.sources\.map/, 'the sources must be on the page, not only in the data');
  assert.match(PAGE, /as of \{longDate\(them\.checkedOn\)\}/, 'the page must say when the column was checked');
  assert.match(PAGE, /not affiliated/);
});

test('every public route gets its own served <head>, distinct from the homepage', () => {
  assert.match(VITE, /publicPageHeads\(\)/, 'the head-writing plugin is not registered');
  const descriptions = new Set();
  for (const [route, page] of Object.entries(PUBLIC_PAGES)) {
    assert.ok(page.title.length > 0 && page.title.length <= 70, `${route}: title length ${page.title.length}`);
    assert.ok(page.description.length >= 60 && page.description.length <= 170, `${route}: description is ${page.description.length} characters; a search snippet shows about 160`);
    assert.ok(!descriptions.has(page.description), `${route} repeats another page's description`);
    descriptions.add(page.description);
    if (route === '/') continue;
    const html = headForRoute(INDEX, route, page);
    assert.ok(html.includes(`<title>${page.title.replace(/&/g, '&amp;')}</title>`), `${route}: title not written`);
    assert.ok(html.includes(`<meta name="description" content="${page.description.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />`), `${route}: description not written`);
    assert.ok(html.includes(`<link rel="canonical" href="${publicPageUrl(route)}" />`), `${route}: canonical not written`);
    assert.ok(html.includes(`<meta property="og:url" content="${publicPageUrl(route)}" />`), `${route}: og:url not written`);
    assert.ok(!html.includes('content="Record your lecture'), `${route} still carries the homepage description`);
  }
  // The audit's own wording for the three pages it named.
  assert.match(PUBLIC_PAGES['/pricing'].description, /^Praelecta pricing: two lectures free, then \$\d+\.\d\d\/month or \$\d+\.\d\d\/semester\. Credit packs, plan comparison, and semester savings\.$/);
  assert.match(PUBLIC_PAGES['/about'].description, /built by De Wet Luus, an engineering student at the University of Saskatchewan, for students who can't listen and take notes at the same time/);
  assert.equal(PUBLIC_PAGES['/changelog'].description, 'What shipped in Praelecta, newest first. Desktop apps, study tools, and lecture features, dated.');
});

test('the legal pages set their own title and description at runtime, like the marketing pages', () => {
  for (const file of ['PrivacyPolicy', 'Terms']) {
    const src = read(`../../src/pages/${file}.jsx`);
    assert.match(src, /usePublicPageMeta\(PUBLIC_PAGES\['\/(privacy|terms)'\]\)/, `${file}.jsx does not set its head`);
  }
  for (const file of ['Pricing', 'About', 'Changelog']) {
    const src = read(`../../src/pages/${file}.jsx`);
    assert.match(src, /<MarketingShell \{\.\.\.PUBLIC_PAGES\['\/[a-z]+'\]\}>/, `${file}.jsx does not read the shared table`);
  }
});
