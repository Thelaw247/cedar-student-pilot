import pg from 'pg';

// Direct Postgres connection (not the Supabase REST/PostgREST client).
// Fulfillment needs a real multi-statement transaction with a row lock
// (SELECT ... FOR UPDATE) around each credit_balances mutation — PostgREST
// is a stateless REST layer and can't express that. Base44's original code
// used an app-level optimistic-concurrency retry loop instead, because
// Base44 functions never got real transactions. A direct connection gives us
// a stronger, simpler primitive for the exact same guarantee, so that's what
// this uses instead of a literal port of the retry loop.
//
// Required env var: DATABASE_URL (Supabase's direct Postgres connection
// string — Project Settings > Database > Connection string > URI, NOT the
// PostgREST/API URL).
if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL is not set — all database-backed routes will fail.');
}

// Return Postgres DATE columns as the plain 'YYYY-MM-DD' string, not a JS
// Date. Every route here was ported from the Supabase REST client, which
// returned dates as strings, so the code compares and sorts them as strings
// (`l.date >= weekAgo`, `a.date.localeCompare(b.date)`). With node-pg's
// default parser a DATE comes back as a Date object at local midnight, and
// `Date >= 'YYYY-MM-DD'` is always false (the string coerces to NaN) while
// `Date.localeCompare` throws. That is why "review this week" found no
// lectures even with seven of them in the window. A calendar date has no
// time zone, so the string is also the more honest representation.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL; see server/README.md
  max: 10,
});

pool.on('error', (err) => {
  // A background client error (e.g. a dropped idle connection) must not
  // crash the process — the pool recovers the next time a query runs.
  console.error('[db] unexpected pool error', err.message);
});
