import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';

// Every route was ported from the Supabase REST client, which returned DATE
// columns as 'YYYY-MM-DD' strings, and the code compares and sorts them as
// strings. node-pg's default parser returns a Date object instead, which made
// `l.date >= '2026-08-26'` always false (Date >= string coerces the string to
// NaN) and `a.date.localeCompare(...)` throw. Visible symptom: "review lectures
// from the past week" said no lectures were available with seven in the window.
// db.js now registers a DATE parser that returns the raw string. Pin it.

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
await import('../lib/db.js');

test('DATE columns come back from node-pg as plain YYYY-MM-DD strings', () => {
  const parse = pg.types.getTypeParser(pg.types.builtins.DATE, 'text');
  const value = parse('2026-09-01');
  assert.equal(typeof value, 'string');
  assert.equal(value, '2026-09-01');
  // The comparisons the routes rely on now behave.
  assert.equal(value >= '2026-08-26' && value <= '2026-09-02', true);
  assert.equal(value.localeCompare('2026-08-30') > 0, true);
});

test('the week scope filters by date range in SQL, not by comparing rows in JS', () => {
  const src = fs.readFileSync(new URL('../routes/generateLectureReview.js', import.meta.url), 'utf8');
  assert.match(src, /date between \(\$2::date - interval '7 days'\) and \$2::date/,
    'week window must be a DATE range in the query');
  assert.doesNotMatch(src, /l\.date >= weekAgoStr/, 'the JS row filter that silently dropped every lecture must be gone');
  // The empty state tells the student which of the two things happened.
  assert.match(src, /still processing/);
  assert.match(src, /No lectures recorded \$\{windowLabel\} yet/);
});
