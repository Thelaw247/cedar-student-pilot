import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TIER_GRANT, COST_PER_30MIN_PROCESS, durationCost } from '../lib/credits.js';
import { TIERS } from '../../shared/tiers.js';

/**
 * The October 2026 trust pass, held in place.
 *
 * Each of these is a promise the site makes or a protection the app gives,
 * and each can be undone by a one-line edit that nothing else would notice:
 * a grant that stops covering what the homepage promises, a lecture's text
 * reaching analytics, a 404 that search engines index, an error that is
 * shown to nobody. Read from source, like the other frontend tests here.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const exists = (rel) => fs.existsSync(new URL(rel, import.meta.url));

// --------------------------------------------------------------- free grant

test('the free grant covers the two 90-minute lectures the site promises, in code and in the database', () => {
  const ninetyMinutes = durationCost(90 * 60, COST_PER_30MIN_PROCESS);
  assert.ok(TIER_GRANT.free >= 2 * ninetyMinutes,
    `${TIER_GRANT.free} free credits do not cover two lectures of 90 minutes (${2 * ninetyMinutes})`);
  assert.equal(TIERS.free.creditsPerMonth, TIER_GRANT.free, 'the pricing table and the grant disagree');
  // New accounts are provisioned by a trigger, which cannot import the
  // constant: the latest definition of handle_new_user() must grant the same.
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const defining = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => /create or replace function public\.handle_new_user\(\)/.test(fs.readFileSync(new URL(f, dir), 'utf8')));
  const latest = fs.readFileSync(new URL(defining.at(-1), dir), 'utf8');
  const granted = latest.match(/new\.id, 'free', (\d+), 0, (\d+),/);
  assert.ok(granted, `${defining.at(-1)} no longer grants in the expected shape`);
  assert.equal(Number(granted[1]), TIER_GRANT.free, `${defining.at(-1)} grants ${granted[1]}, TIER_GRANT.free is ${TIER_GRANT.free}`);
  assert.equal(Number(granted[2]), TIER_GRANT.free, 'lifetime_granted must start at the grant');
});

// ----------------------------------------------------------------- analytics

test('what a student studies never reaches analytics as text', () => {
  // Autocapture records the text of what is clicked. Inside these, it records
  // the click without the words (PostHog's ph-sensitive class).
  const marked = {
    'lecture/StudySections.jsx': 1,
    'lecture/TranscriptViewer.jsx': 1,
    'FlashcardViewer.jsx': 1,
    'QuizViewer.jsx': 1,
    'quiz/QuizReview.jsx': 2,
    'PracticePanel.jsx': 1,
    'InLectureQuiz.jsx': 1,
    'HandbookReader.jsx': 2,
    'ManualStudyGuide.jsx': 1,
    'SessionReview.jsx': 2,
  };
  for (const [file, count] of Object.entries(marked)) {
    const src = read(`../../src/components/${file}`);
    const found = (src.match(/className=[{"`][^>]*\bph-sensitive\b/g) || []).length;
    assert.ok(found >= count, `${file}: ${found} of ${count} content surfaces marked ph-sensitive`);
  }
});

// ---------------------------------------------------------------- public copy

test('the public pages carry no em dashes', () => {
  // House style for the site's copy, and a tell of text nobody edited.
  // Comments are code, not copy, and are left out.
  const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const landing = fs.readdirSync(new URL('../../src/components/landing/', import.meta.url)).map((f) => `src/components/landing/${f}`);
  const files = [
    ...landing,
    'src/pages/Pricing.jsx', 'src/pages/About.jsx', 'src/pages/Changelog.jsx', 'src/pages/Compare.jsx', 'src/pages/Feature.jsx',
    'src/pages/PrivacyPolicy.jsx', 'src/pages/Terms.jsx', 'src/lib/PageNotFound.jsx', 'src/components/CookieConsent.jsx',
    'src/pages/Login.jsx', 'src/pages/Register.jsx', 'src/pages/ForgotPassword.jsx', 'src/pages/ResetPassword.jsx', 'src/pages/CheckoutSuccess.jsx',
    'shared/faq.js', 'shared/features.js', 'shared/competitors.js', 'shared/publicPages.js', 'shared/tiers.js', 'shared/legal.js',
  ];
  for (const file of files) {
    const src = strip(read(`../../${file}`));
    const line = src.split('\n').find((l) => /—|&mdash;|\\u2014/.test(l));
    assert.equal(line, undefined, `${file} has an em dash: ${line?.trim().slice(0, 100)}`);
  }
  assert.doesNotMatch(read('../../public/llms.txt'), /—/, 'llms.txt has an em dash');
  assert.doesNotMatch(read('../../index.html').replace(/<!--[\s\S]*?-->/g, ''), /—|&mdash;/, 'index.html has an em dash');
});

// ------------------------------------------------------------------- the 404

test('an unknown address gets a real 404 page that search engines skip', () => {
  const page = read('../../src/lib/PageNotFound.jsx');
  assert.match(page, /<MarketingShell\s+title="Page not found \| Praelecta"/);
  assert.match(page, /\bnoindex\b/, 'the host answers every path with a 200, so the page has to say noindex itself');
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /Admin Note|auth\.me\(\)|window\.location\.href/, 'the app-builder 404 is back');
  const hook = read('../../src/hooks/usePublicPageMeta.js');
  assert.match(hook, /setAttribute\('content', 'noindex'\)/);
  assert.match(hook, /robots\?\.remove\(\)/, 'noindex outlives the 404 page and hides the next page too');
  const app = read('../../src/App.jsx');
  assert.match(app, /const PageNotFound = lazy\(\(\) => import\('\.\/lib\/PageNotFound'\)\);/);
  assert.match(app, /<Route path="\*" element=\{<PageNotFound \/>\} \/>/);
});

// --------------------------------------------------------------- titles, skip

test('every screen names itself in the tab, and the keyboard can skip the navigation', () => {
  const layout = read('../../src/components/Layout.jsx');
  assert.match(layout, /usePublicPageMeta\(\{ title: screenTitle\(pathname\) \}\)/, 'app screens carry the homepage title');
  assert.match(layout, /NAV_ITEMS\.find/, 'tab titles must come from the nav labels');
  assert.match(read('../../src/components/AuthLayout.jsx'), /usePublicPageMeta\(\{ title: title \? `\$\{title\} \| Praelecta` : undefined \}\)/);
  for (const file of ['src/components/Layout.jsx', 'src/components/landing/MarketingShell.jsx']) {
    const src = read(`../../${file}`);
    assert.match(src, /<a href="#main" className="skip-link">Skip to content<\/a>/, `${file} has no skip link`);
    assert.match(src, /<main id="main" tabIndex=\{-1\}/, `${file}: the skip link has nowhere to land`);
  }
  const css = read('../../src/index.css');
  assert.match(css, /\.skip-link:focus/);
  assert.match(css, /:focus-visible \{/, 'no visible keyboard focus');
});

// -------------------------------------------------------------------- forms

test('form errors are announced, and the sign-in flow says what happened', () => {
  for (const file of ['Login', 'Register', 'ResetPassword', 'ForgotPassword']) {
    const src = read(`../../src/pages/${file}.jsx`);
    const boxes = (src.match(/\{error && \(\s*<div /g) || []).length;
    const announced = (src.match(/\{error && \(\s*<div role="alert"/g) || []).length;
    assert.ok(boxes > 0 && boxes === announced, `${file}: ${announced} of ${boxes} error boxes are announced`);
  }
  const forgot = read('../../src/pages/ForgotPassword.jsx');
  // Enumeration-safe: any answer about the address is shown as success. Only a
  // send that never happened is reported.
  assert.match(forgot, /if \(emailNeverSent\(err\)\) \{/);
  assert.match(forgot, /return status >= 500 \|\| err\?\.name === "AuthRetryableFetchError" \|\| err\?\.name === "TypeError";/);
  assert.doesNotMatch(forgot, /Always show success/, 'every failure is swallowed again');
  const reset = read('../../src/pages/ResetPassword.jsx');
  assert.match(reset, /title="Password updated"/, 'a reset ends with no word that it worked');
  const register = read('../../src/pages/Register.jsx');
  assert.match(register, /const RESEND_WAIT_SECONDS = 60;/);
  assert.match(register, /disabled=\{resending \|\| resendWait > 0\}/, 'Resend can be pressed into a rate-limit error');
  assert.match(register, /aria-label=\{`\$\{OTP_LENGTH\}-digit code from the email`\}/);
});

test('the thank-you page names what was bought', () => {
  const route = read('../routes/confirmCheckoutSession.js');
  assert.match(route, /\{ kind: 'subscription', tier: entitlement\.tier, period: entitlement\.period \}/);
  assert.match(route, /\{ kind: 'pack', credits: entitlement\.credits \}/);
  const page = read('../../src/pages/CheckoutSuccess.jsx');
  assert.match(page, /purchaseCopy\(result\?\.purchase\)/);
  assert.match(page, /'every four months'/, 'the renewal schedule must match the Terms');
  assert.match(read('../../src/pages/Terms.jsx'), /semester plans every four months/);
});

// ------------------------------------------------------------------- privacy

test('the export holds everything the policy says it does', () => {
  const route = read('../routes/exportUserData.js');
  for (const table of ['app_reviews', 'product_events', 'lectures', 'credit_balances']) {
    assert.match(route, new RegExp(`'${table}',`), `the export leaves out ${table}`);
  }
  assert.match(route, /legal_version/, 'the export leaves out what the student agreed to');
  const policy = read('../../src/pages/PrivacyPolicy.jsx');
  assert.match(policy, /the record of what you agreed to/);
});

test('the student count on the homepage counts students with a finished lecture', () => {
  const route = read('../routes/publicStats.js');
  assert.match(route, /count\(distinct user_id\)::int from lectures where status = 'complete'/);
});

// --------------------------------------------------------------- the install

test('the installed app opens on Today and stays inside the site', () => {
  const manifest = JSON.parse(read('../../public/site.webmanifest'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/today', 'an installed app should open the app, not the homepage');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) assert.ok(exists(`../../public${icon.src}`), `${icon.src} is missing`);
});
