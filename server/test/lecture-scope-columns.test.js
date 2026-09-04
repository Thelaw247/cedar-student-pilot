import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Phase 0 of the study-flow rework: let a session and a deadline say which
 * lectures they are about.
 *
 * Before this, a session could name ONE lecture and only the auto-generated
 * post-lecture review ever set it — every assignment prep session was booked
 * with no lecture at all. A deadline could not name its lectures either:
 * coverage_scope has a 'custom' value that nothing could act on, because the
 * columns it would have used are text, unwritten and unread. And nothing
 * recorded what a student actually opened during a session, so "mark what you
 * covered as reviewed" had nowhere to read from.
 *
 * Nothing depends on the new columns yet. This phase only has to be additive,
 * complete, and correct — the phases that consume it come next.
 */

const MIGRATION = fs.readFileSync(
  new URL('../../supabase/migrations/20260905000000_link_sessions_and_assignments_to_lectures.sql', import.meta.url),
  'utf8',
);
const ROUTE = fs.readFileSync(new URL('../routes/processLectureRecording.js', import.meta.url), 'utf8');

test('the migration only adds', () => {
  // A migration against a table with live rows in it gets one rule: nothing
  // that can fail on existing data, and nothing an older deploy would trip on.
  assert.doesNotMatch(MIGRATION, /drop\s+(table|column|constraint|index)/i);
  assert.doesNotMatch(MIGRATION, /alter\s+column/i);
  assert.doesNotMatch(MIGRATION, /\bdelete\s+from\b/i);
  // Every new column is NOT NULL with a default, so existing rows are valid
  // the instant the column exists.
  const adds = MIGRATION.match(/add column if not exists \w+ uuid\[\][^,;]*/g) || [];
  assert.equal(adds.length, 3, 'expected three new array columns');
  for (const a of adds) {
    assert.match(a, /default '\{\}'::uuid\[\]/, `${a}: no default, so the NOT NULL would fail`);
    assert.match(a, /not null/, `${a}: nullable arrays give every reader two empty cases`);
  }
});

test('a session can name several lectures, and record which it opened', () => {
  assert.match(MIGRATION, /alter table public\.study_sessions[\s\S]*?lecture_ids uuid\[\]/);
  assert.match(MIGRATION, /opened_lecture_ids uuid\[\]/);
  // The distinction is the whole point: one is the plan, one is what happened.
  assert.match(MIGRATION, /comment on column public\.study_sessions\.lecture_ids is/);
  assert.match(MIGRATION, /comment on column public\.study_sessions\.opened_lecture_ids is/);
});

test('opened is deliberately not constrained to the plan', () => {
  // A student in an unscoped focus session picks lectures freely, so "opened"
  // can legitimately hold material the plan never mentioned. A subset CHECK
  // would reject an honest write, and it is exactly the sort of tidiness a
  // later migration would add without knowing why it was left out.
  assert.doesNotMatch(MIGRATION, /<@/);
  assert.doesNotMatch(MIGRATION, /opened_lecture_ids[\s\S]{0,120}check/i);
  assert.match(MIGRATION, /not by constraint/, 'the reason must survive in the schema comment');
});

test('a deadline can name its lectures, and only where that means something', () => {
  assert.match(MIGRATION, /alter table public\.assignments[\s\S]*?lecture_ids uuid\[\]/);
  // cumulative and since_last are derived from dates. Storing a list for them
  // would go stale the moment another lecture is recorded, which is why this
  // column is scoped to 'custom' — the one coverage_scope value that has never
  // done anything.
  assert.match(MIGRATION, /coverage_scope = ''custom''/);
  assert.match(MIGRATION, /would go stale/);
});

test('the backfill carries the single-lecture rows forward', () => {
  // The new column has to be complete from the moment it exists, or the
  // double-booking guard below would stop seeing reviews booked before today
  // and book every lecture a second one.
  assert.match(MIGRATION, /update public\.study_sessions\s*\n\s*set lecture_ids = array\[lecture_id\]/);
  assert.match(MIGRATION, /where lecture_id is not null/);
  assert.match(MIGRATION, /and cardinality\(lecture_ids\) = 0/, 'the backfill must be safe to re-run');
});

test('the guard that stops double-booking reads the new column, and only the owner’s rows', () => {
  assert.match(ROUTE, /select 1 from study_sessions where user_id = \$1 and \$2 = any\(lecture_ids\) limit 1/);
  assert.doesNotMatch(ROUTE, /from study_sessions where lecture_id = \$1/, 'the old unscoped guard is back');
  // Containment on an array wants a GIN index; this runs on every recording.
  assert.match(MIGRATION, /create index if not exists study_sessions_lecture_ids_idx[\s\S]*?using gin \(lecture_ids\)/);
});

test('the review session writes both columns, agreeing with each other', () => {
  const insert = ROUTE.slice(ROUTE.indexOf('insert into study_sessions'), ROUTE.indexOf('insert into study_sessions') + 700);
  assert.match(insert, /lecture_id, lecture_ids,/);
  assert.match(insert, /\$3, array\[\$3::uuid\]/, 'the two columns must be filled from the same value');
  // lecture_id stays written for one release so anything still reading it is
  // unaffected. Phase 6 removes it.
  assert.match(ROUTE, /lecture_id is written\s*\n\s*\/\/ alongside for one release/);
});

test('the insert still balances', () => {
  // A hand-edited multi-column INSERT is the easy place to lose a placeholder.
  const start = ROUTE.indexOf('insert into study_sessions');
  const stmt = ROUTE.slice(start, ROUTE.indexOf(');', start));
  const columns = stmt.slice(stmt.indexOf('(') + 1, stmt.indexOf(')')).split(',').length;
  const valuesClause = stmt.slice(stmt.indexOf('values ('));
  const values = valuesClause.slice(valuesClause.indexOf('(') + 1, valuesClause.lastIndexOf(')'))
    .replace(/array\[[^\]]*\]/g, 'ARRAY')
    .split(',').length;
  assert.equal(columns, values, `${columns} columns but ${values} values`);
  // Eight distinct placeholders, highest is $8.
  const params = new Set(stmt.match(/\$\d+/g));
  assert.equal(Math.max(...[...params].map((p) => Number(p.slice(1)))), 8);
});
