import { supabase } from './supabaseClient.js';

// Compatibility layer replacing @base44/sdk. Not a 1:1 reimplementation of
// Base44's client — a deliberately similar-enough shape (entities.X.filter/
// get/create/update/delete/list/bulkCreate, functions.invoke, auth.me/
// updateMe) so the ~60 files across this app that call base44.* need small,
// mechanical edits (mostly the import and a few argument shapes) rather than
// rewritten internal logic.
//
// Two real backends underneath, matching the actual architecture:
//   - entities.*    -> Supabase's own PostgREST API via supabase-js.
//                      RLS (already built, row-owner policies on every
//                      table) enforces access using the caller's own
//                      session — no custom backend route needed for CRUD.
//   - functions.*    -> the Render server's REST routes (server/routes/*.js),
//                      the 28 ported Base44 functions.
//   - auth.*          -> Supabase Auth directly.

const RENDER_API_URL = import.meta.env.VITE_RENDER_API_URL;
if (!RENDER_API_URL) {
  console.error('[cedarClient] VITE_RENDER_API_URL not set — function calls will fail.');
}

// Base44 entity names (PascalCase, singular) -> Postgres table names
// (snake_case, plural). Every table this app currently has.
const TABLE_MAP = {
  User: 'profiles', // auth.users itself isn't queryable from the client; profiles is the public extension
  Semester: 'semesters',
  Class: 'classes',
  Lecture: 'lectures',
  Assignment: 'assignments',
  Note: 'notes',
  StudySession: 'study_sessions',
  StudyRecord: 'study_records',
  CalendarEvent: 'calendar_events',
  ClassAttendance: 'class_attendance',
  KnowledgeCoverage: 'knowledge_coverage',
  Flashcard: 'flashcards',
  PracticeQuestion: 'practice_questions',
  StudySessionReview: 'study_session_reviews',
  CustomTrack: 'custom_tracks',
  Handbook: 'handbooks',
  CreditBalance: 'credit_balances',
  UsageEvent: 'usage_events',
  ProcessedStripeEvent: 'processed_stripe_events',
};

// camelCase Base44 function name -> this app's kebab-case Render route.
// e.g. 'generateStudyMaterial' -> '/generate-study-material'
function functionPath(name) {
  return '/' + name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Parses a Base44-style sort string like '-date' or 'date' into a
 *  supabase-js .order() call. Defaults to ascending on unspecified fields. */
function applySort(query, sort) {
  if (!sort) return query;
  const desc = sort.startsWith('-');
  const column = desc ? sort.slice(1) : sort;
  return query.order(column, { ascending: !desc });
}

function makeEntity(tableName) {
  return {
    async filter(match = {}, sort, limit) {
      let q = supabase.from(tableName).select('*').match(match);
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async list(sort, limit) {
      let q = supabase.from(tableName).select('*');
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async get(id) {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async create(fields) {
      // RLS's WITH CHECK requires auth.uid() = user_id on every insert —
      // Base44 stamped this automatically, so callers here rarely set it
      // explicitly either. Fill it in from the current session if missing.
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { user_id: user?.id, ...fields };
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async bulkCreate(rows) {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = rows.map((r) => ({ user_id: user?.id, ...r }));
      const { data, error } = await supabase.from(tableName).insert(payload).select();
      if (error) throw error;
      return data;
    },
    async update(id, fields) {
      const { data, error } = await supabase.from(tableName).update(fields).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

const entities = new Proxy({}, {
  get(_target, name) {
    const table = TABLE_MAP[name];
    if (!table) throw new Error(`cedarClient: no table mapping for entity "${String(name)}"`);
    return makeEntity(table);
  },
});

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

const functions = {
  /** Mirrors base44.functions.invoke(name, args) -> { data }, matching the
   *  shape every existing call site (response.data / res?.data) expects. */
  async invoke(name, args = {}) {
    const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
    const res = await fetch(`${RENDER_API_URL}${functionPath(name)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.error || `Request to ${name} failed (${res.status})`);
      err.response = { data, status: res.status };
      throw err;
    }
    return { data, status: res.status };
  },
};

const auth = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return { id: user.id, email: user.email, ...profile };
  },
  async updateMe(fields) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    // full_name/email-adjacent fields go to Supabase Auth's own user_metadata;
    // everything else (role, avatar_url) goes to the profiles extension table.
    const { full_name, ...profileFields } = fields;
    if (full_name !== undefined) {
      await supabase.auth.updateUser({ data: { full_name } });
    }
    if (Object.keys(profileFields).length > 0) {
      await supabase.from('profiles').update(profileFields).eq('id', user.id);
    }
    return auth.me();
  },
  async logout() {
    await supabase.auth.signOut();
  },
};

// asServiceRole is intentionally NOT provided here — that access level only
// exists on the server (server/lib/db.js's direct Postgres connection). A
// frontend call site that used base44.asServiceRole.* was relying on a
// Base44 platform quirk (a client-side call somehow getting elevated access)
// that has no safe equivalent and should route through a Render function
// instead. If any of the 60 files hit this, that's a real thing to fix, not
// paper over.

export const cedar = { entities, functions, auth };
