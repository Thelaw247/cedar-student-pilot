import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURES, FEATURE_PATHS, featureBySlug } from '../../shared/features.js';
import { COMPETITORS, GLANCE_COMPETITORS, GLANCE_ROWS, PRAELECTA_GLANCE, competitorBySlug } from '../../shared/competitors.js';
import { PUBLIC_PAGES, PUBLIC_PATHS } from '../../shared/publicPages.js';
import { FAQ } from '../../shared/faq.js';
import { TIERS } from '../../shared/tiers.js';

/**
 * The homepage after the 28 Sep 2026 audit against studley.ai and turbo.ai.
 *
 * The audit found praelecta.ca the most specific of the three pages and the
 * one losing the first five seconds: no proof a visitor could see without
 * reading, 2,750 words against Turbo's 650, two buttons two thousand words
 * apart, the free tier and the accuracy promise buried in the FAQ, and the
 * long copy with nowhere else to live. These tests hold the fixes in place:
 * the fact strip reads real figures, the free box reads the free tier, every
 * section carries a button and a short form, the feature pages are routed
 * and listed, the glance table reads the same facts as the /vs pages, and the
 * header is the design system's glass surface rather than a second recipe.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const LANDING = read('../../src/pages/Landing.jsx');
const HERO = read('../../src/components/landing/LandingHero.jsx');
const PROOF = read('../../src/components/landing/LandingProof.jsx');
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

// ------------------------------------------------------------- the first screen

test('the fact strip under the hero buttons carries four checkable facts, from the code that makes them true', () => {
  assert.match(HERO, /<ProofFacts/);
  assert.match(HERO, /<FounderLine/);
  assert.match(PROOF, /export const PROOF_FACTS = \[/);
  // Six hours is the recorder's own ceiling, not a marketing figure.
  assert.match(RECORDER, /MAX_TOTAL_SECONDS = 6 \* 60 \* 60/);
  assert.match(PROOF, /Records up to 6 hours/);
  // The price is read from tiers.js, never typed.
  assert.match(PROOF, /TIERS\.student\.semester\.toFixed\(2\)\} CAD for the whole semester/);
  assert.doesNotMatch(PROOF.replace(/\$\{[^}]*\}/g, ''), /\$\d+\.\d\d/, 'a typed price in the fact strip');
  assert.match(PROOF, /Two full lectures free, no card/);
  assert.match(PROOF, /Cancel in one tap/);
  // The founder line falls back to initials, never a broken image, like /about.
  assert.match(PROOF, /onError=\{\(\) => setMissing\(true\)\}/);
  assert.match(PROOF, /FOUNDER\.initials/);
  assert.match(PROOF, /University of Saskatchewan/);
  // No invented crowd anywhere on the first screen.
  assert.doesNotMatch(HERO, /\d,\d{3},\d{3}\+|#1 |10x|3x faster/);
});

test('the hero paragraph is under thirty words and the feature cards are one line each, linking to the feature pages', () => {
  const sub = HERO.match(/text-muted-foreground sm:text-lg">([^<]+)<\/p>/)[1];
  assert.ok(sub.split(/\s+/).length <= 30, `the hero paragraph is ${sub.split(/\s+/).length} words`);
  assert.doesNotMatch(HERO, /body: '/, 'the cards carry a second line again');
  for (const f of FEATURES) assert.ok(HERO.includes(`to: '${f.path}'`), `no card links to ${f.path}`);
  assert.match(HERO, /Two full lectures free\. No card, nothing expires\./);
});

// ------------------------------------------------------ order and short forms

test('the promises and the free box come before the product tour, which is in its short form', () => {
  const at = (tag) => { const i = LANDING.indexOf(tag); assert.ok(i >= 0, `${tag} is not on the homepage`); return i; };
  assert.ok(at('<LandingHero />') < at('<LandingRecognition />'));
  assert.ok(at('<LandingRecognition />') < at('<LandingWhyStudents />'));
  assert.ok(at('<LandingWhyStudents />') < at('<LandingFree />'));
  assert.ok(at('<LandingFree />') < at('<RecordingFeature compact />'));
  assert.ok(at('<RecordingFeature compact />') < at('<StudyToolProof compact />'));
  assert.ok(at('<StudyToolProof compact />') < at('<StudyScheduleProof compact />'));
  assert.ok(at('<StudyScheduleProof compact />') < at('<StudySystemFeature compact />'));
  assert.ok(at('<StudySystemFeature compact />') < at('<LandingCompare />'));
  assert.ok(at('<LandingCompare />') < at('<LandingTestimonials />'));
  for (const [name, src] of Object.entries(SECTIONS)) {
    assert.match(src, /\{ compact = false \}/, `${name} has no compact form`);
    assert.match(src, /<SectionCta/, `${name} has no call to action`);
  }
});

test('the short paragraphs are under thirty words', () => {
  // Each compact branch's first paragraph.
  const compactParagraph = (src) => {
    const m = src.match(/\{compact \? \(\s*<p[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(m, 'no compact paragraph');
    return m[1].replace(/&[a-z]+;/g, 'x').replace(/\s+/g, ' ').trim();
  };
  for (const [name, src] of Object.entries(SECTIONS)) {
    const words = compactParagraph(src).split(' ').length;
    assert.ok(words <= 32, `${name}'s short paragraph is ${words} words`);
  }
});

test('the free box reads the free tier, and the accuracy promise names the plan the slides check needs', () => {
  const free = read('../../src/components/landing/LandingFree.jsx');
  assert.match(free, /TIERS\.free\.includes\.map/);
  assert.match(free, /Free is two full lectures, not a demo\./);
  assert.match(free, /No card\. Nothing expires\./);
  assert.ok(TIERS.free.lifetimeOnly, 'the free grant must not expire for "nothing expires" to be true');
  const rec = SECTIONS.RecordingFeature;
  assert.match(rec, /The notes come from the lecture, not from the internet\./);
  assert.match(rec, /\$\{TIERS\.student\.name\} plan/, 'the slides check is a Student-plan feature and must say so');
  assert.match(rec, /id="accuracy"/);
});

// --------------------------------------------------------------- feature pages

test('every feature page is routed, listed, linked and has its own head', () => {
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
  assert.match(page, /<Section \/>/, 'the feature page renders the section in full, not compact');
  assert.match(page, /<LandingFaq ids=\{feature\.faq\} \/>/);
});

// ---------------------------------------------------------------- comparison

test('the glance table reads the same competitors as the /vs pages, one line per cell, and both are on the site', () => {
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

test('the header is the design system’s glass chrome, floating, with the opaque fallbacks intact', () => {
  assert.match(NAV, /className=\{`glass-chrome /, 'the nav must use .glass-chrome, not a second glass recipe');
  assert.match(NAV, /rounded-full/);
  assert.match(NAV, /aria-expanded=\{menuOpen\}/);
  assert.doesNotMatch(NAV, /backdrop-blur/, 'blur comes from .glass-chrome, which has the @supports and reduced-transparency fallbacks');
  assert.match(CSS, /\.glass-chrome \{[\s\S]*?background-color: hsl\(var\(--card\)\);/);
  assert.match(CSS, /prefers-reduced-transparency: reduce/);
});
