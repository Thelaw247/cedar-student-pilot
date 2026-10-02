import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURES, FEATURE_PATHS, featureBySlug } from '../../shared/features.js';
import { COMPETITORS, GLANCE_COMPETITORS, GLANCE_ROWS, PRAELECTA_GLANCE, competitorBySlug } from '../../shared/competitors.js';
import { PUBLIC_PAGES, PUBLIC_PATHS } from '../../shared/publicPages.js';
import { FAQ } from '../../shared/faq.js';
import { TIERS } from '../../shared/tiers.js';

/**
 * The homepage as seven sections, each one thing.
 *
 * A study-app homepage that converts has one shape: a headline, one sentence
 * and the product in the first screen; a proof strip; how it works in three
 * steps; a feature grid; testimonials; the FAQ; a last button. Praelecta's
 * had fourteen sections and 2,500 words. These tests hold the shorter page
 * in place — the order, the word budgets, the real screens in the steps, the
 * tiles reading lib/features.js — and keep the things that moved (the four
 * promises, the glance table, the long forms) where they went rather than
 * letting them drift back.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const LANDING = read('../../src/pages/Landing.jsx');
const HERO = read('../../src/components/landing/LandingHero.jsx');
const PROOF = read('../../src/components/landing/LandingProof.jsx');
const HOW = read('../../src/components/landing/LandingHowItWorks.jsx');
const GRID = read('../../src/components/landing/LandingFeatures.jsx');
const FINAL = read('../../src/components/landing/LandingFinalCta.jsx');
const PRICING = read('../../src/pages/Pricing.jsx');
const NAV = read('../../src/components/landing/LandingNav.jsx');
const CSS = read('../../src/index.css');
const APP = read('../../src/App.jsx');
const FOOTER = read('../../src/components/landing/LandingFooter.jsx');
const SITEMAP = read('../../public/sitemap.xml');
const LLMS = read('../../public/llms.txt');
const RECORDER = read('../../src/recording/RecordingContext.jsx');

const SECTIONS = {
  RecordingFeature: read('../../src/components/landing/RecordingFeature.jsx'),
  StudyToolProof: read('../../src/components/landing/StudyToolProof.jsx'),
  RealProductPreview: read('../../src/components/landing/RealProductPreview.jsx'),
  StudySystemFeature: read('../../src/components/landing/StudySystemFeature.jsx'),
};

const words = (s) => s.replace(/&[a-z]+;/g, 'x').replace(/\s+/g, ' ').trim().split(' ').length;
const at = (tag) => { const i = LANDING.indexOf(tag); assert.ok(i >= 0, `${tag} is not on the homepage`); return i; };

// ------------------------------------------------------------- the first screen

test('the hero is six words, one sentence, the product and two buttons, on one flat surface', () => {
  assert.match(HERO, /Just listen\.\{' '\}/, 'the headline is the founder’s own problem turned into the promise');
  assert.match(HERO, /<span className="text-primary">We&rsquo;ll take the notes\.<\/span>/, 'the second sentence carries the brand colour');
  // No lit patch behind the first screen: it read as a filter over the hero
  // and broke the one surface the page is. The header paints nothing
  // behind its pill for the same reason.
  assert.doesNotMatch(HERO, /radial-gradient|blur-3xl/, 'a glow is back under the hero');
  assert.doesNotMatch(NAV, /bg-gradient-to-b/, 'the fade band behind the header pill is back');
  // The words start at the top edge of the product window, not halfway down it.
  assert.match(HERO, /grid max-w-6xl items-start/);
  assert.match(HOW, /grid items-start gap-6 lg:grid-cols-\[0\.8fr_1\.2fr\]/, 'the step text must align with the top of its screen');
  assert.match(HOW, /Step \{step\.number\} of \{STEPS\.length\}/);
  const sub = HERO.match(/text-muted-foreground">\s*([^<]+?)\s*<\/p>/)[1];
  assert.ok(words(sub) <= 25, `the hero sentence is ${words(sub)} words`);
  assert.match(sub, /records the lecture/, 'the sentence names the category');
  // The product, in a window: the app in use, as a muted loop of a real
  // account (hero-demo.test.js holds the file, the poster and the cache
  // rule). The saved-lecture card stays in the recording section.
  assert.match(HERO, /<HeroDemo \/>/);
  assert.doesNotMatch(HERO, /LectureResultCard/, 'the hero shows the product moving, not a mock of it');
  assert.match(SECTIONS.RecordingFeature, /export function LectureResultCard/);
  assert.match(HERO, /to="\/register"/);
  assert.match(HERO, /href="#how-it-works"/, 'the second button scrolls to the steps');
  assert.match(HERO, /Two full lectures free\. No card, nothing expires\./);
  // Nothing else in the first screen: no cards, no flow bar, no eyebrow, no
  // badge, no trust line — each has a section of its own now.
  assert.doesNotMatch(HERO, /coreFeatures|<PaymentTrustLine|<ProofFacts|<FounderLine|App Store/);
  assert.doesNotMatch(HERO, /\d,\d{3},\d{3}\+|#1 |10x|3x faster/, 'no invented crowd');
});

test('the fact strip is its own section, from the code that makes the facts true', () => {
  assert.match(PROOF, /export const PROOF_FACTS = \[/);
  assert.match(PROOF, /export function LandingFacts/);
  assert.match(PROOF, /id="facts"/);
  // Six hours is the recorder's own ceiling, not a marketing figure.
  assert.match(RECORDER, /MAX_TOTAL_SECONDS = 6 \* 60 \* 60/);
  assert.match(PROOF, /Records up to 6 hours/);
  // The price is read from tiers.js, never typed.
  assert.match(PROOF, /TIERS\.student\.semester\.toFixed\(2\)\} CAD for the whole semester/);
  assert.doesNotMatch(PROOF.replace(/\$\{[^}]*\}/g, ''), /\$\d+\.\d\d/, 'a typed price in the fact strip');
  assert.match(PROOF, /Two full lectures free, no card/);
  assert.match(PROOF, /Cancel in one tap/);
  // The founder line moved to the last section; it still falls back to
  // initials, never a broken image, like /about.
  assert.match(PROOF, /onError=\{\(\) => setMissing\(true\)\}/);
  assert.match(PROOF, /FOUNDER\.initials/);
  assert.match(FINAL, /<FounderLine/);
  assert.match(FINAL, /<PaymentTrustLine/, 'the billing facts sit under the last button');
});

// ------------------------------------------------------------------- the order

test('seven sections, in order, and nothing that used to be between them', () => {
  const order = ['<LandingHero />', '<LandingRecognition />', '<LandingFacts />', '<LandingHowItWorks />', '<LandingFeatures />', '<LandingDownloads />', '<LandingTestimonials />', '<LandingFaq />', '<LandingFinalCta />'];
  for (let i = 1; i < order.length; i += 1) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i]} must follow ${order[i - 1]}`);
  // The sections that left the homepage: the long forms are the feature
  // pages, the promises and the glance table are on /pricing, the free box
  // and the "do three things" band are gone.
  for (const gone of ['RecordingFeature', 'StudyToolProof', 'StudyScheduleProof', 'StudySystemFeature', 'LandingWhyStudents', 'LandingCompare', 'LandingFree', 'LandingEnd', 'compact']) {
    assert.ok(!LANDING.includes(gone), `${gone} is back on the homepage`);
  }
  assert.ok(!fs.existsSync(new URL('../../src/components/landing/LandingFree.jsx', import.meta.url)));
  assert.ok(!fs.existsSync(new URL('../../src/components/landing/LandingEnd.jsx', import.meta.url)));
  assert.match(PRICING, /<LandingWhyStudents \/>/);
  assert.match(PRICING, /<LandingCompare \/>/);
});

// ---------------------------------------------------------------- how it works

test('how it works is three steps, each a short line with the real screen', () => {
  assert.match(HOW, /id="how-it-works"/);
  assert.match(HOW, /<RecorderCard \/>/);
  assert.match(HOW, /<CoverageMock compact \/>/);
  assert.match(HOW, /<ScheduleMock compact \/>/);
  assert.match(SECTIONS.RecordingFeature, /export function RecorderCard/);
  assert.match(SECTIONS.StudyToolProof, /export function CoverageMock\(\{ compact = false/);
  assert.match(SECTIONS.RealProductPreview, /export function ScheduleMock\(\{ compact = false/);
  const steps = [...HOW.matchAll(/title: '([^']+)',\s*body: '([^']+)'/g)];
  assert.equal(steps.length, 3);
  for (const [, title, body] of steps) {
    assert.ok(words(title) <= 7, `step title "${title}" is ${words(title)} words`);
    assert.ok(words(body) <= 20, `step "${title}" is ${words(body)} words`);
  }
  assert.match(HOW, /<SectionCta/);
  assert.match(NAV, /href: '\/#how-it-works'/);
});

// ---------------------------------------------------------------- feature grid

test('the feature grid reads lib/features.js, one line per tile, and links every feature page', () => {
  assert.match(GRID, /id="features"/);
  assert.match(GRID, /FEATURES\.map/);
  assert.match(GRID, /blurb: f\.blurb/);
  for (const f of FEATURES) {
    assert.ok(typeof f.blurb === 'string' && f.blurb.length > 20, `${f.slug} has no blurb`);
    assert.ok(words(f.blurb) <= 25, `${f.slug}'s blurb is ${words(f.blurb)} words`);
  }
  for (const [, blurb] of GRID.matchAll(/blurb: '([^']+)'/g)) assert.ok(words(blurb) <= 25, `a tile blurb is ${words(blurb)} words`);
  assert.match(GRID, /to: '\/lecture-recorder#accuracy'/, 'the accuracy tile opens the promise on the recorder page');
  assert.match(SECTIONS.RecordingFeature, /id="accuracy"/);
  assert.match(SECTIONS.RecordingFeature, /The notes come from the lecture, not from the internet\./);
  assert.match(SECTIONS.RecordingFeature, /\$\{TIERS\.student\.name\} plan/, 'the slides check is a Student-plan feature and must say so');
  assert.match(GRID, /to: '#download'/);
  assert.match(NAV, /href: '\/#features'/);
});

// --------------------------------------------------------------- feature pages

test('every feature page is routed, listed, linked and renders its section in full', () => {
  assert.equal(FEATURES.length, 4);
  for (const f of FEATURES) {
    assert.ok(APP.includes(`path="${f.path}" element={<Feature slug="${f.slug}" />}`), `${f.path} has no route`);
    assert.ok(PUBLIC_PATHS.includes(f.path), `${f.path} is not in lib/publicPages.js`);
    assert.ok(SITEMAP.includes(`<loc>https://praelecta.ca${f.path}</loc>`), `${f.path} is not in the sitemap`);
    assert.ok(LLMS.includes(`https://praelecta.ca${f.path}`), `${f.path} is not in llms.txt`);
    assert.ok(f.h1.split(/\s+/).length <= 9, `${f.slug}: the h1 is ${f.h1.split(/\s+/).length} words`);
    for (const id of f.faq) assert.ok(FAQ.some((q) => q.id === id), `${f.slug} names an FAQ that does not exist: ${id}`);
    assert.equal(featureBySlug(f.slug), f);
    assert.ok(PUBLIC_PAGES[f.path].title.length <= 70);
  }
  assert.deepEqual(FEATURE_PATHS, FEATURES.map((f) => f.path));
  assert.ok(APP.indexOf('path="/lecture-recorder"') < APP.indexOf('<ProtectedRoute'), 'the feature pages must be public');
  assert.match(FOOTER, /FEATURES\.map/);
  const page = read('../../src/pages/Feature.jsx');
  assert.match(page, /<Section \/>/, 'the feature page renders the section in full');
  assert.match(page, /<LandingFaq ids=\{feature\.faq\} \/>/);
  // The sections have one form now; the homepage shows the screens, not the sections.
  for (const [name, src] of Object.entries(SECTIONS)) {
    assert.doesNotMatch(src, /export default function \w+\(\{ compact/, `${name} still has a compact form`);
    assert.match(src, /<SectionCta/, `${name} has no call to action`);
  }
});

// ---------------------------------------------------------------- comparison

test('the glance table reads the same competitors as the /vs pages, one line per cell, on the pricing page', () => {
  for (const slug of GLANCE_COMPETITORS) {
    const c = competitorBySlug(slug);
    assert.ok(c, `${slug} is not in lib/competitors.js`);
    for (const row of GLANCE_ROWS) {
      assert.ok(c.glance?.[row.id]?.length > 1, `${c.name} has no glance cell for "${row.label}"`);
      assert.ok(c.glance[row.id].length <= 90, `${c.name}'s "${row.label}" cell is ${c.glance[row.id].length} characters; one line`);
      assert.ok(PRAELECTA_GLANCE[row.id]?.length > 1);
    }
    assert.ok(c.glance.billing.includes('USD'));
    assert.ok(COMPETITORS.some((x) => x.slug === slug));
  }
  assert.ok(PRAELECTA_GLANCE.billing.includes(`$${TIERS.student.semester.toFixed(2)} CAD`));
  const table = read('../../src/components/landing/LandingCompare.jsx');
  assert.match(table, /GLANCE_ROWS\.map/);
  assert.match(table, /not affiliated/);
  assert.match(table, /longDate\(checkedOn\)/, 'the table must say when the columns were read');
});

// -------------------------------------------------------------------- header

test('the header is the design system’s glass chrome, floating, with four links and the opaque fallbacks intact', () => {
  assert.match(NAV, /className=\{`glass-chrome /, 'the nav must use .glass-chrome, not a second glass recipe');
  assert.match(NAV, /rounded-full/);
  assert.match(NAV, /aria-expanded=\{menuOpen\}/);
  assert.doesNotMatch(NAV, /backdrop-blur/, 'blur comes from .glass-chrome, which has the @supports and reduced-transparency fallbacks');
  assert.match(CSS, /\.glass-chrome \{[\s\S]*?background-color: hsl\(var\(--card\)\);/);
  assert.match(CSS, /prefers-reduced-transparency: reduce/);
  const links = [...NAV.matchAll(/\{ label: '([^']+)', (?:href|to): '([^']+)' \}/g)].map((m) => m[1]);
  assert.deepEqual(links, ['How it works', 'Features', 'Pricing', 'FAQ'], 'the header is four links; the feature pages are reached from the grid and the footer');
});
