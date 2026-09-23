import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FAQ, faqJsonLd } from '../../shared/faq.js';
import { FOUNDER } from '../../shared/founder.js';
import { TIERS, TIER_ORDER, CREDIT_PACKS, semesterSaving, maxSemesterSavingPercent } from '../../shared/tiers.js';
import { LEGAL_VERSION, PRIVACY_EFFECTIVE_DATE } from '../../shared/legal.js';
import { proofLine } from '../../shared/proof.js';
import { LANDING_TITLE, PUBLIC_PAGES, PUBLIC_PATHS } from '../../shared/publicPages.js';
import { publicStats, resetPublicStatsCache } from '../routes/publicStats.js';

/**
 * The public site after the 18 Sep 2026 audit.
 *
 * An outside audit scored the site 2/20 on trust: no person behind it, no
 * numbers, no testimonials, no payment marks, the full pricing table living
 * only in the terms of service, a title with no category keyword, and a
 * privacy policy that said "third-party AI services" without naming one.
 * These tests hold the fixes in place: what the pages say, what the served
 * HTML carries for crawlers, and the two things that make the privacy
 * wording true (the named providers, and the Deepgram opt-out parameter).
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const HTML = read('../../index.html');
const MARKUP = HTML.replace(/<!--[\s\S]*?-->/g, '');
const HERO = read('../../src/components/landing/LandingHero.jsx');
const END = read('../../src/components/landing/LandingEnd.jsx');
const TIERS_JSX = read('../../src/components/landing/PricingTiers.jsx');
const FOOTER = read('../../src/components/landing/LandingFooter.jsx');
const NAV = read('../../src/components/landing/LandingNav.jsx');
const LANDING = read('../../src/pages/Landing.jsx');
const PRIVACY = read('../../src/pages/PrivacyPolicy.jsx');
const TRANSCRIPTION = read('../lib/transcription.js');
const SITEMAP = read('../../public/sitemap.xml');
const LLMS = read('../../public/llms.txt');
const APP = read('../../src/App.jsx');

const jsonLdBlocks = () => [...MARKUP.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((m) => JSON.parse(m[1]));

// ------------------------------------------------------------- title & schema

test('the title names the category, and the runtime title is the same string', () => {
  const title = MARKUP.match(/<title>([^<]+)<\/title>/)[1].replace(/&amp;/g, '&');
  assert.match(title, /Lecture Recording/i);
  assert.match(title, /Study Tool/i);
  assert.ok(title.length <= 60, `title is ${title.length} characters; search results cut it at about 60`);
  assert.equal(LANDING_TITLE, title, 'the homepage would overwrite the served title with a different one');
  assert.match(LANDING, /import \{ LANDING_TITLE, LANDING_DESCRIPTION \} from '@\/lib\/publicPages'/, 'Landing.jsx must read the shared title');
  assert.equal(PUBLIC_PAGES['/'].title, title);
  const served = MARKUP.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.equal(PUBLIC_PAGES['/'].description, served, 'the homepage would overwrite the served description with a different one');
  // The description already carried the category terms; it stays.
  assert.match(MARKUP, /<meta name="description" content="Record your lecture/);
});

test('the served HTML carries SoftwareApplication, Organization and FAQPage schema', () => {
  const types = jsonLdBlocks().map((b) => b['@type']);
  assert.deepEqual(types, ['SoftwareApplication', 'Organization', 'FAQPage']);
  const org = jsonLdBlocks()[1];
  assert.equal(org.name, 'Praelecta');
  assert.equal(org.url, 'https://praelecta.ca/');
  assert.match(org.logo, /^https:\/\/praelecta\.ca\//);
  assert.ok(fs.existsSync(new URL(`../../public/${org.logo.slice('https://praelecta.ca/'.length)}`, import.meta.url)), 'the Organization logo is not a file in public/');
  assert.equal(org.founder.name, FOUNDER.name);
  // The founder's LinkedIn: one address, on the pages and in the schema.
  assert.match(FOUNDER.linkedin, /^https:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9-]+$/);
  assert.equal(org.founder.sameAs, FOUNDER.linkedin);
  assert.equal(org.address.addressCountry, 'CA');
});

test('the FAQ schema in index.html is exactly the FAQ the page renders', () => {
  // One source (shared/faq.js). index.html is static, so it is checked
  // rather than generated: a changed answer that is not copied across fails here.
  assert.deepEqual(jsonLdBlocks()[2], faqJsonLd());
  assert.ok(FAQ.length >= 6 && FAQ.length <= 8, 'six to eight questions, the ones students actually ask');
  for (const q of ['Is recording lectures allowed?', 'What happens to my audio?', 'Will I run out of credits mid-semester?', 'Can I cancel anytime?', 'Does Praelecta write my essays?', 'What if my professor talks too fast?', 'Does it work on iPhone or Mac?']) {
    assert.ok(FAQ.some((f) => f.question === q), `missing FAQ: ${q}`);
  }
  const faqSection = read('../../src/components/landing/LandingFaq.jsx');
  assert.match(faqSection, /id="faq"/);
  assert.match(faqSection, /<details/, 'answers must be in the DOM without JavaScript');
  assert.match(LANDING, /<LandingFaq \/>/);
  // Between the pricing section and the final call to action.
  assert.ok(LANDING.indexOf('<LandingEnd />') < LANDING.indexOf('<LandingFaq />') && LANDING.indexOf('<LandingFaq />') < LANDING.indexOf('<LandingFinalCta />'));
});

// ------------------------------------------------------------------ the hero

test('the hero names the category before the hook and foregrounds semester billing', () => {
  // The eyebrow is the audit's own line (22 Sep, FIT + D1.1): category, ICP,
  // and the semester-billing differentiator, all in the first five seconds.
  assert.match(HERO, /Lecture recording and study tool for students\. Bills by semester, not by month — no other study app does that\./);
  assert.match(HERO, /You showed up to the lecture\. That should be the hard part\./, 'the h1 is the brief’s line; it stays');
  assert.match(HERO, /Bills by semester, not by month/);
  assert.match(HERO, /no other study app does that/);
  assert.match(HERO, /to="\/pricing"/);
  // Scope, stated: who it is not for.
  assert.match(HERO, /Not for you if you want an app to write your assignments/);
  // Payment trust under the primary button.
  assert.match(HERO, /<PaymentTrustLine/);
  const trust = read('../../src/components/landing/PaymentTrustLine.jsx');
  assert.match(trust, /Stripe/);
  assert.match(trust, /Cancel anytime/);
  assert.match(trust, /No charge for failed actions/);
  assert.match(trust, /to="\/terms#refunds"/, 'the refund policy must be one click from the button');
  assert.match(read('../../src/pages/Terms.jsx'), /id="refunds"/);
});

// --------------------------------------------------------------- pricing

test('the pricing surface shows every tier with a price, a default, the real saving and the credit model', () => {
  assert.match(END, /<PricingTiers compact \/>/);
  assert.match(END, /<CreditsExplainer/);
  assert.match(END, /<PaymentTrustLine/);
  assert.match(END, /<LandingProof/, 'the proof line sits above the prices');
  assert.match(TIERS_JSX, /export const RECOMMENDED_TIER = 'student'/);
  assert.match(TIERS_JSX, /Most popular/);
  assert.match(TIERS_JSX, /TIER_ORDER\.map/, 'every tier, not a hand-picked subset');
  assert.match(TIERS_JSX, /save \{saving\.percent\}%/, 'the semester saving is shown as a percentage, derived');
  // No typed prices anywhere on the public pricing surfaces.
  for (const [name, src] of [['LandingEnd', END], ['PricingTiers', TIERS_JSX], ['Pricing page', read('../../src/pages/Pricing.jsx')], ['CreditsExplainer', read('../../src/components/landing/CreditsExplainer.jsx')]]) {
    const literal = src.replace(/\$\{[^}]*\}/g, '').match(/\$\d+\.\d\d/);
    assert.equal(literal, null, `${name} hardcodes the price ${literal?.[0]}`);
  }
  // The saving never overstates: floor, not round, and the real figures.
  for (const id of ['student', 'scholar', 'unlimited']) {
    const t = TIERS[id];
    const s = semesterSaving(t);
    assert.ok(s.percent <= ((t.monthly * 4 - t.semester) / (t.monthly * 4)) * 100);
  }
  assert.equal(semesterSaving(TIERS.free), null);
  assert.ok(maxSemesterSavingPercent() >= 20);
});

test('the pricing page exists, is public, and the nav points at it', () => {
  assert.match(APP, /path="\/pricing" element=\{<Pricing \/>\}/);
  assert.match(NAV, /\{ label: 'Pricing', to: '\/pricing' \}/);
  assert.match(FOOTER, /to="\/pricing"/);
  const page = read('../../src/pages/Pricing.jsx');
  assert.match(page, /<PricingTiers \/>/, 'the full matrix, not the compact teaser');
  assert.match(page, /CREDIT_PACKS\.map/);
  assert.match(page, /What a semester saves/);
  assert.match(page, /<CreditsExplainer/);
});

test('llms.txt is a real file whose prices match tiers.js', () => {
  assert.match(LLMS, /^# Praelecta/);
  for (const id of TIER_ORDER.filter((t) => t !== 'free')) {
    const t = TIERS[id];
    assert.ok(LLMS.includes(`$${t.monthly.toFixed(2)}/month`), `llms.txt lacks ${t.name}'s monthly price`);
    assert.ok(LLMS.includes(`$${t.semester.toFixed(2)}/semester`), `llms.txt lacks ${t.name}'s semester price`);
  }
  for (const p of CREDIT_PACKS) assert.ok(LLMS.includes(`${p.credits} for $${p.price.toFixed(2)}`), `llms.txt lacks the ${p.name} pack`);
  for (const path of ['/pricing', '/about', '/changelog', '/privacy', '/terms']) assert.ok(LLMS.includes(`https://praelecta.ca${path}`), `llms.txt lacks ${path}`);
});

// --------------------------------------------------------------------- trust

test('a person is on the site: the about page, the footer and the schema agree', () => {
  assert.match(APP, /path="\/about" element=\{<About \/>\}/);
  const about = read('../../src/pages/About.jsx');
  assert.match(about, /FOUNDER\.name/);
  assert.match(about, /FOUNDER\.photo/);
  assert.match(about, /onError=\{\(\) => setMissing\(true\)\}/, 'a missing photo must fall back to initials, never a broken image');
  assert.match(about, /FOUNDER\.linkedin && \(/, 'the LinkedIn link renders only when the address is set');
  assert.match(about, /Why I built this/);
  assert.match(FOOTER, /Made in Canada by/);
  assert.match(FOOTER, /FOUNDER\.name/);
  assert.match(FOOTER, /to="\/about"/);
  assert.equal(FOUNDER.name, 'De Wet Luus');
  assert.match(FOUNDER.email, /@praelecta\.ca$/);
});

test('the proof line is honest at every size, and the counts come from the database', () => {
  assert.equal(proofLine(null), 'Early students are testing Praelecta on their own classes. Join them.');
  assert.equal(proofLine({ students: 0, lectures: 0 }), 'Early students are testing Praelecta on their own classes. Join them.');
  assert.equal(proofLine({ students: 11, lectures: 48 }), '11 students have recorded 48 lectures with Praelecta so far. Join them.');
  assert.equal(proofLine({ students: 1, lectures: 1 }), '1 student has recorded 1 lecture with Praelecta so far. Join them.');
  assert.equal(proofLine({ students: 0, lectures: 3 }), 'Early students have recorded 3 lectures with Praelecta so far. Join them.');
  assert.match(read('../../src/components/landing/LandingProof.jsx'), /\/public\/stats/);
  assert.match(read('../index.js'), /app\.use\('\/public', publicStatsRouter\)/);
});

test('public stats are cached, so the landing page never becomes a query per visitor', async () => {
  resetPublicStatsCache();
  let queries = 0;
  const db = { async query() { queries += 1; return { rows: [{ students: 11, lectures: 48, hours: 48 }] }; } };
  let t = 0;
  const now = () => t;
  assert.deepEqual(await publicStats(db, { now, ttl: 1000 }), { students: 11, lectures: 48, hours: 48 });
  t = 500;
  await publicStats(db, { now, ttl: 1000 });
  assert.equal(queries, 1, 'a second call inside the window must be served from memory');
  t = 1500;
  await publicStats(db, { now, ttl: 1000 });
  assert.equal(queries, 2);
  resetPublicStatsCache();
});

test('testimonials, recognition and the avatar grid render nothing until there is something true to show', () => {
  const t = read('../../src/components/landing/LandingTestimonials.jsx');
  const r = read('../../src/components/landing/LandingRecognition.jsx');
  const p = read('../../src/components/landing/LandingProof.jsx');
  assert.match(t, /export const TESTIMONIALS = \[\];/, 'no invented testimonials');
  assert.match(t, /if \(!testimonials\.length\) return null;/);
  // The audit's own heading and caption format, ready for the real quotes.
  assert.match(t, /What students say/);
  assert.match(t, /\[t\.name, t\.course, t\.school\]/);
  assert.match(r, /export const RECOGNITION = \[\];/, 'no invented badges');
  assert.match(r, /if \(!items\.length\) return null;/);
  assert.match(p, /export const PROOF_AVATARS = \[\];/, 'no students shown without their say-so');
  assert.match(p, /if \(!avatars\.length\) return null;/);
  assert.match(LANDING, /<LandingTestimonials \/>/);
  // The badge slot sits directly under the hero, where the audit asked for it.
  assert.ok(LANDING.indexOf('<LandingRecognition />') > LANDING.indexOf('<LandingHero />'));
  assert.ok(LANDING.indexOf('<LandingRecognition />') < LANDING.indexOf('<RecordingFeature />'));
  // The testimonial wall sits after "Sound familiar?" and before the pricing section.
  const why = LANDING.indexOf('<LandingWhyStudents />');
  const down = LANDING.indexOf('<LandingDownloads />');
  for (const tag of ['<LandingTestimonials />']) {
    const at = LANDING.indexOf(tag);
    assert.ok(why < at && at < down, `${tag} is not between the trust section and the downloads`);
  }
});

// ------------------------------------------------------------------- privacy

test('the privacy policy names every processor, and the code makes the Deepgram line true', () => {
  for (const name of ['Groq', 'Deepgram', 'Google Gemini', 'Cloudflare R2', 'Supabase', 'Stripe', 'Resend', 'HeyCatch']) {
    assert.ok(PRIVACY.includes(name), `the privacy policy does not name ${name}`);
  }
  assert.doesNotMatch(PRIVACY, /third-party AI services/, 'the unnamed "third-party AI services" line is back');
  // Deepgram's model-improvement program is opt-out; the policy promises the
  // opt-out, so the request must carry it.
  assert.match(TRANSCRIPTION, /mip_opt_out: 'true'/);
  // A changed document is a new consent version, dated today.
  assert.equal(PRIVACY_EFFECTIVE_DATE, 'September 22, 2026');
  assert.equal(LEGAL_VERSION, '2026-09-22');
});

// -------------------------------------------------------------- crawl surface

test('the sitemap lists every public page and only public pages, each with a route', () => {
  const urls = [...SITEMAP.matchAll(/<loc>https:\/\/praelecta\.ca(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  // The sitemap and lib/publicPages.js are the same list: a page with a
  // served <head> of its own is a page a crawler is told about, and vice versa.
  assert.deepEqual([...urls].sort(), [...PUBLIC_PATHS].sort());
  const robots = read('../../public/robots.txt');
  for (const path of urls) {
    assert.ok(path === '/' || APP.includes(`path="${path}"`), `${path} is in the sitemap but has no route`);
    assert.doesNotMatch(robots, new RegExp(`^Disallow: ${path.replace('/', '\\/')}$`, 'm'), `${path} is disallowed in robots.txt`);
  }
});

test('the changelog is dated, newest first, and reachable', () => {
  assert.match(APP, /path="\/changelog" element=\{<Changelog \/>\}/);
  const page = read('../../src/pages/Changelog.jsx');
  const dates = [...page.matchAll(/date: '(\d{4}-\d{2}-\d{2})'/g)].map((m) => m[1]);
  assert.ok(dates.length >= 5);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'entries must be newest first');
  assert.match(page, /<time dateTime=\{entry\.date\}/, 'dates must be machine-readable');
  assert.match(FOOTER, /to="\/changelog"/);
});
