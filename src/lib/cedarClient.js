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
  const requested = desc ? sort.slice(1) : sort;
  const column = requested === 'created_date' ? 'created_at'
    : requested === 'updated_date' ? 'updated_at'
      : requested;
  return query.order(column, { ascending: !desc });
}

function makeEntity(tableName, entityName) {
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
      if (!user) throw new Error('Not signed in');
      const payload = { ...fields, user_id: user.id };
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async bulkCreate(rows) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const payload = rows.map((r) => ({ ...r, user_id: user.id }));
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
      if (entityName === 'Lecture' || entityName === 'Class') {
        await apiRequest(`/data/${entityName.toLowerCase()}s/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return true;
      }
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
    return makeEntity(table, name);
  },
});

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  if (!RENDER_API_URL) throw new Error('The Cedar API URL is not configured');
  const response = await fetch(`${RENDER_API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(await authHeaders()),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `API request failed (${response.status})`);
    error.response = { data, status: response.status };
    throw error;
  }
  return { data, status: response.status };
}

const functions = {
  /** Mirrors base44.functions.invoke(name, args) -> { data }, matching the
   *  shape every existing call site (response.data / res?.data) expects. */
  async invoke(name, args = {}) {
    return apiRequest(functionPath(name), { method: 'POST', body: args });
  },
};

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });
}

const files = {
  async uploadRecording(file) {
    if (!(file instanceof Blob) || !file.size) throw new TypeError('A non-empty recording is required');
    const prepared = await apiRequest('/files/recordings/upload-url', {
      method: 'POST',
      body: { content_type: file.type, size_bytes: file.size },
    });
    const uploaded = await fetch(prepared.data.upload_url, {
      method: 'PUT',
      headers: prepared.data.headers,
      body: file,
    });
    if (!uploaded.ok) throw new Error(`Recording upload failed (${uploaded.status})`);
    return (await apiRequest('/files/recordings/confirm', {
      method: 'POST',
      body: { key: prepared.data.key },
    })).data;
  },
  async getDownloadUrl(ref) {
    if (!String(ref || '').startsWith('r2://')) return ref;
    const withoutScheme = String(ref).slice(5);
    const slash = withoutScheme.indexOf('/');
    if (slash < 1) throw new TypeError('Invalid recording reference');
    const key = withoutScheme.slice(slash + 1);
    const result = await apiRequest(`/files/download-url?key=${encodeURIComponent(key)}`);
    return result.data.url;
  },
  async delete(ref) {
    if (!String(ref || '').startsWith('r2://')) return;
    const withoutScheme = String(ref).slice(5);
    const slash = withoutScheme.indexOf('/');
    if (slash < 1) throw new TypeError('Invalid recording reference');
    const key = withoutScheme.slice(slash + 1);
    await apiRequest('/files', { method: 'DELETE', body: { key } });
  },
};

const integrations = {
  Core: {
    async UploadFile({ file, purpose }) {
      if (!(file instanceof Blob) || !file.size) throw new TypeError('A non-empty file is required');
      if (purpose === 'recording') {
        const result = await files.uploadRecording(file);
        return { file_url: result.storage_ref, playback_url: result.playback_url };
      }
      if (purpose === 'timetable') {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
        if (!allowed.has(file.type)) throw new TypeError('Timetable must be a PDF, JPEG, PNG, or WebP file');
        if (file.size > 8 * 1024 * 1024) throw new RangeError('Timetable files must be 8 MB or smaller');
        return { file_url: await readAsDataUrl(file) };
      }
      throw new Error('This file-upload purpose has not been migrated to private storage yet');
    },
  },
};

const auth = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const error = new Error('Unauthorized');
      error.status = 401;
      throw error;
    }
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return { id: user.id, email: user.email, ...profile };
  },
  async updateMe(fields) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const allowed = {};
    if (Object.hasOwn(fields, 'full_name')) allowed.full_name = fields.full_name;
    if (Object.hasOwn(fields, 'avatar_url')) allowed.avatar_url = fields.avatar_url;
    const unexpected = Object.keys(fields).filter((field) => !Object.hasOwn(allowed, field));
    if (unexpected.length) throw new Error(`Profile fields cannot be updated: ${unexpected.join(', ')}`);
    if (Object.keys(allowed).length) {
      const { error } = await supabase.from('profiles').update(allowed).eq('id', user.id);
      if (error) throw error;
    }
    return auth.me();
  },
  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async loginWithProvider(provider, returnTo = '/today') {
    const redirectTo = new URL(returnTo, window.location.origin).toString();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  },
  async register({ email, password }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });
    if (error) throw error;
    return data.session || data;
  },
  async resendOtp(email) {
    const { data, error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
    return data;
  },
  async resetPasswordRequest(email) {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  },
  async resetPassword({ resetToken, newPassword }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && resetToken) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: resetToken,
        type: 'recovery',
      });
      if (verifyError) throw verifyError;
    }
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },
  async changePassword({ currentPassword, newPassword }) {
    const current = await auth.me();
    if (!current?.email) throw new Error('Not signed in');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: current.email,
      password: currentPassword,
    });
    if (signInError) throw signInError;
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },
  async setToken() {
    // verifyOtp already persists the returned session in supabase-js.
    return supabase.auth.getSession();
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

export const cedar = { entities, functions, auth, files, integrations };
