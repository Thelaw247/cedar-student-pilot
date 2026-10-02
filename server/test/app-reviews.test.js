import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isReviewEligible, validateReview, reviewStatus, ratingSummary, suggestedDisplayName,
  MIN_RATINGS_FOR_AVERAGE, REVIEW_LIMITS, REVIEW_SNOOZE_DAYS,
} from '../../shared/reviews.js';
import { functionPath } from '../../shared/functionPath.js';
import { loadPublicReviews, publicReviews, resetPublicReviewsCache } from '../routes/publicReviews.js';
import { decideReview, listReviews } from '../routes/ownerReviews.js';

/**
 * Student reviews: asked for in the app, shown on praelecta.ca only with the
 * student's consent and after the founder has checked the wording. These
 * tests hold the parts that keep it honest — consent unticked by default,
 * approval the client cannot forge, an edited review checked again, the
 * average over every rating rather than the picked ones, the same form for
 * every rating, no reward — and the wiring from the card on Today to the
 * homepage.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const MIGRATION = read('../../supabase/migrations/20261002180000_app_reviews.sql');
const PROMPT = read('../../src/components/ReviewPrompt.jsx');
const FORM = read('../../src/components/ReviewForm.jsx');
const MINE = read('../../src/components/YourReviewSection.jsx');
const OWNER = read('../../src/components/OwnerReviews.jsx');
const HOME = read('../../src/pages/Home.jsx');
const SETTINGS = read('../../src/pages/Settings.jsx');
const OWNER_PAGE = read('../../src/pages/OwnerAnalytics.jsx');
const CLIENT = read('../../src/lib/cedarClient.js');
const INDEX = read('../index.js');
const TESTIMONIALS = read('../../src/components/landing/LandingTestimonials.jsx');
const HERO = read('../../src/components/landing/LandingHero.jsx');

const DAY = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------------ the table

test('a student owns their review, but cannot approve it: approved_at is outside every client grant', () => {
  assert.match(MIGRATION, /create table if not exists public\.app_reviews/);
  assert.match(MIGRATION, /user_id uuid not null unique references auth\.users\(id\) on delete cascade/, 'one review per student, gone with the account');
  assert.match(MIGRATION, /alter table public\.app_reviews enable row level security;/);
  assert.match(MIGRATION, /revoke all privileges on table public\.app_reviews from anon, authenticated;/);
  const grants = MIGRATION.match(/grant (insert|update) \([^)]*\)\s+on table public\.app_reviews to authenticated;/g) || [];
  assert.equal(grants.length, 2, 'insert and update are column grants');
  for (const g of grants) assert.doesNotMatch(g, /approved_at|created_at|updated_at|\bid\b/, `a client grant includes a server-owned column: ${g}`);
  assert.doesNotMatch(MIGRATION, /to anon/, 'the public read is the API, never the table');
  for (const verb of ['select', 'insert', 'update', 'delete']) {
    assert.match(MIGRATION, new RegExp(`create policy "${verb} own rows" on public\\.app_reviews`), `no ${verb} policy`);
  }
  assert.match(MIGRATION, /\(select auth\.uid\(\)\) = user_id/);
});

test('an approved review that is edited is checked again, and nothing can be public without words and a name', () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf('function public.app_reviews_recheck_on_edit'), MIGRATION.indexOf('$$;', MIGRATION.indexOf('function public.app_reviews_recheck_on_edit')));
  for (const col of ['body', 'display_name', 'detail', 'school']) {
    assert.match(fn, new RegExp(`new\\.${col} is distinct from old\\.${col}`), `editing ${col} keeps the old approval`);
  }
  assert.match(fn, /new\.may_publish and not old\.may_publish/);
  assert.match(fn, /new\.approved_at := null;/);
  assert.match(MIGRATION, /create trigger recheck_on_edit before update on public\.app_reviews/);
  assert.match(MIGRATION, /constraint app_reviews_rated_or_declined check \(declined or rating is not null\)/);
  assert.match(MIGRATION, /constraint app_reviews_publishable check/);
  assert.match(MIGRATION, /rating smallint check \(rating between 1 and 5\)/);
  assert.match(MIGRATION, new RegExp(`char_length\\(body\\) <= ${REVIEW_LIMITS.body}`), 'the database and the form disagree on the length');
});

// ------------------------------------------------------------------ the rules

test('who is asked: a student with a processed lecture or a week in the app — never the founder, never on day one', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  assert.equal(isReviewEligible({ lectures: [{ status: 'complete' }], accountCreatedAt: '2026-10-02T11:00:00Z', now }), true);
  assert.equal(isReviewEligible({ lectures: [], accountCreatedAt: new Date(now - 8 * DAY).toISOString(), now }), true);
  assert.equal(isReviewEligible({ lectures: [{ status: 'processing' }], accountCreatedAt: new Date(now - DAY).toISOString(), now }), false);
  assert.equal(isReviewEligible({ lectures: [], accountCreatedAt: 'not a date', now }), false);
  assert.equal(isReviewEligible({ lectures: [{ status: 'complete' }], accountCreatedAt: '2026-01-01T00:00:00Z', role: 'admin', now }), false, 'the founder does not review his own app');
  assert.equal(suggestedDisplayName('Connor Kelly'), 'Connor');
  assert.equal(suggestedDisplayName(''), '');
});

test('the form: a rating is required, words are optional unless the review is to be shown, and everything is trimmed', () => {
  assert.equal(validateReview({ body: 'Great' }).errors.rating, 'Pick a rating from 1 to 5 stars.');
  const quiet = validateReview({ rating: 2, body: '  ' });
  assert.equal(quiet.ok, true, 'a low rating with no words is a valid review');
  assert.deepEqual(quiet.row, { rating: 2, body: null, display_name: null, detail: null, school: null, may_publish: false, declined: false });
  const shown = validateReview({ rating: 5, may_publish: true, body: '' , display_name: '' });
  assert.equal(shown.ok, false);
  assert.ok(shown.errors.body && shown.errors.display_name);
  const full = validateReview({ rating: 5, may_publish: true, body: ' Caught up on a week in an evening. ', display_name: ' Connor ', detail: ' ', school: 'University of Saskatchewan' });
  assert.equal(full.ok, true);
  assert.deepEqual(full.row, { rating: 5, body: 'Caught up on a week in an evening.', display_name: 'Connor', detail: null, school: 'University of Saskatchewan', may_publish: true, declined: false });
  assert.ok(validateReview({ rating: 4, body: 'x'.repeat(REVIEW_LIMITS.body + 1) }).errors.body);
  assert.equal(validateReview({ rating: 6 }).ok, false);
});

test('where a review stands, and when the average is worth showing', () => {
  assert.equal(reviewStatus(null), 'none');
  assert.equal(reviewStatus({ declined: true, rating: null }), 'declined');
  assert.equal(reviewStatus({ rating: 4, may_publish: false }), 'private');
  assert.equal(reviewStatus({ rating: 4, may_publish: true, approved_at: null }), 'pending');
  assert.equal(reviewStatus({ rating: 4, may_publish: true, approved_at: '2026-10-02' }), 'shown');
  assert.equal(MIN_RATINGS_FOR_AVERAGE, 5);
  assert.equal(ratingSummary({ count: 4, average: 5 }), null, 'four ratings are not an average to put on a homepage');
  assert.equal(ratingSummary(null), null);
  assert.deepEqual(ratingSummary({ count: 6, average: 4.75 }), { count: 6, average: 4.8, text: '4.8 out of 5 from 6 students' });
});

// ------------------------------------------------------------------ the API

function fakeDb(responses) {
  const queries = [];
  return {
    queries,
    async query(text, params) {
      queries.push({ text, params });
      const next = responses.find((r) => r.match.test(text));
      return { rows: next ? next.rows : [] };
    },
  };
}

test('the public read shows only consented, approved reviews — and averages every rating, shown or not', async () => {
  const db = fakeDb([
    { match: /count\(rating\)/, rows: [{ count: 7, average: 4.2857 }] },
    { match: /approved_at is not null/, rows: [{ rating: 5, body: 'Worth it.', display_name: 'Connor', detail: 'GE 122', school: null }] },
  ]);
  const out = await loadPublicReviews(db);
  assert.deepEqual(out, { count: 7, average: 4.29, reviews: [{ rating: 5, quote: 'Worth it.', name: 'Connor', detail: 'GE 122', school: null }] });
  const shown = db.queries.find((q) => /approved_at is not null/.test(q.text)).text;
  assert.match(shown, /and may_publish/);
  assert.match(shown, /and not declined/);
  assert.doesNotMatch(shown, /user_id|email|\bid\b/, 'nothing that identifies the account leaves the database');
  const average = db.queries.find((q) => /count\(rating\)/.test(q.text)).text;
  assert.doesNotMatch(average, /may_publish|approved_at/, 'the average is of every rating, not of the picked quotes');
});

test('the public reviews are cached like the stats, and an approval clears the cache', async () => {
  resetPublicReviewsCache();
  const db = fakeDb([{ match: /count\(rating\)/, rows: [{ count: 0, average: null }] }]);
  let t = 0;
  const now = () => t;
  assert.deepEqual(await publicReviews(db, { now, ttl: 1000 }), { count: 0, average: null, reviews: [] });
  t = 500;
  await publicReviews(db, { now, ttl: 1000 });
  assert.equal(db.queries.length, 2, 'a second call inside the window must be served from memory');
  await decideReview(fakeDb([{ match: /update app_reviews/, rows: [{ id: 'x' }] }]), '7d3c5a8e-2f61-4b6e-9a3d-1c2b3a4d5e6f', true);
  await publicReviews(db, { now, ttl: 1000 });
  assert.equal(db.queries.length, 4, 'an approval must show on the homepage without waiting for the cache');
  resetPublicReviewsCache();
});

test('the owner can only show a review the student agreed to show', async () => {
  assert.equal((await decideReview(fakeDb([]), 'not-a-uuid', true)).status, 400);
  const refused = fakeDb([]);
  const decision = await decideReview(refused, '7d3c5a8e-2f61-4b6e-9a3d-1c2b3a4d5e6f', true);
  assert.equal(decision.status, 409);
  assert.match(refused.queries[0].text, /and may_publish/);
  assert.match(refused.queries[0].text, /set approved_at = now\(\)/);
  const hide = fakeDb([]);
  assert.equal((await decideReview(hide, '7d3c5a8e-2f61-4b6e-9a3d-1c2b3a4d5e6f', false)).status, 200);
  assert.match(hide.queries[0].text, /set approved_at = null/);
  const list = await listReviews(fakeDb([{ match: /from app_reviews r/, rows: [
    { rating: 5, may_publish: true, approved_at: null, declined: false },
    { rating: 3, may_publish: false, approved_at: null, declined: false },
    { rating: null, may_publish: false, approved_at: null, declined: true },
  ] }]));
  assert.deepEqual(list.summary, { ratings: 2, average: 4, waiting: 1, shown: 0, declined: 1 });
});

test('the routes are mounted, the owner route is admins only, and the app calls it by name', () => {
  assert.match(INDEX, /app\.use\('\/owner-reviews', ownerReviewsRouter\);/);
  assert.match(INDEX, /app\.use\('\/public', publicReviewsRouter\);/);
  assert.match(read('../routes/ownerReviews.js'), /router\.post\('\/', requireAuth, requireAdmin,/);
  assert.equal(functionPath('ownerReviews'), '/owner-reviews');
  assert.match(OWNER, /base44\.functions\.invoke\('ownerReviews', args\)/);
  assert.match(OWNER_PAGE, /<OwnerReviews \/>/);
});

// ------------------------------------------------------------------ the app

test('the ask is a card on Today, not a pop-up, with three one-tap answers', () => {
  assert.match(CLIENT, /AppReview: 'app_reviews'/);
  assert.ok(HOME.indexOf('<ReviewPrompt lectures={lectures} />') > HOME.indexOf('<DetectedDeadlines'), 'the card sits with the other questions on Today');
  assert.doesNotMatch(PROMPT, /fixed inset-0/, 'the ask became a pop-up; the attendance question already is one');
  assert.match(PROMPT, /isReviewEligible\(\{ lectures, accountCreatedAt: user\.created_at, role: user\.role \}\)/);
  assert.match(PROMPT, /Rate Praelecta/);
  assert.match(PROMPT, /Not now/);
  assert.match(PROMPT, /Don&rsquo;t ask again/);
  assert.match(PROMPT, /AppReview\.create\(\{ declined: true \}\)/, '"Don\'t ask again" must follow the student to other devices');
  assert.match(PROMPT, /REVIEW_SNOOZE_DAYS \* DAY_MS/);
  assert.equal(REVIEW_SNOOZE_DAYS, 14);
});

test('the form asks every student the same thing, with the public box unticked and nothing offered in return', () => {
  assert.match(FORM, /useState\(!!existing\?\.may_publish\)/, 'the consent box must start unticked for a new review');
  assert.doesNotMatch(FORM, /rating\s*(>=|>|<=|<)\s*\d/, 'a different path for high and low ratings is review gating');
  assert.match(FORM, /Your star rating counts toward the average shown on praelecta\.ca\. Your words and name appear only if you tick the box, and only after a quick check\./);
  for (const [name, src] of [['ReviewPrompt', PROMPT], ['ReviewForm', FORM]]) {
    assert.doesNotMatch(src, /credit|reward|discount|free month/i, `${name} offers something for a review`);
  }
  assert.match(FORM, /role="radiogroup"/);
  assert.match(FORM, /min-h-\[44px\]/);
  assert.match(FORM, /Tap again to delete it everywhere/, 'a delete with no second step');
});

test('a student can see, change, unpublish or delete their review in Settings; the founder has no such section', () => {
  assert.match(SETTINGS, /\{!isAdmin && \(\s*<SettingsSection icon=\{Star\} title="Your review">/);
  assert.match(MINE, /reviewStatus\(row\)/);
  assert.match(MINE, /<ReviewForm\s+existing=\{row\}/);
});

test('the homepage reads the reviews and shows the average only from real ratings', () => {
  assert.match(TESTIMONIALS, /usePublicReviews\(\)/);
  assert.match(TESTIMONIALS, /ratingSummary\(stats\)/);
  assert.match(HERO, /function HeroRating\(\)/);
  assert.match(HERO, /const summary = ratingSummary\(usePublicReviews\(\)\);\s*if \(!summary\) return null;/);
  assert.doesNotMatch(HERO, /\d\.\d out of 5|\d+ students/, 'a typed rating in the hero');
  // The stars round to the nearest half, never up to a whole: 4.7 draws
  // four and a half, so the picture never says more than the number.
  const stars = read('../../src/components/ui/Stars.jsx');
  assert.match(stars, /const halves = Math\.round\(value \* 2\);/);
  assert.match(stars, /<StarHalf/);
  assert.match(read('../../src/hooks/usePublicReviews.js'), /base44\.functions\.get\('\/public\/reviews'\)/);
});
