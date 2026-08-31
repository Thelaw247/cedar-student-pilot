import { supabase } from './supabaseClient.js';
import { functionPath } from './functionPath.js';

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
const MAX_RECORDING_BYTES = 24 * 1024 * 1024;
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

const CREDITS_SPENT_HEADER = 'X-Credits-Spent';

/**
 * Fire the app's existing data-changed event when a response reports a charge.
 * useBalance listens for it, so the credit meter and every gated surface
 * re-read the balance without any per-feature wiring. Header absent or zero
 * (a cached read, a free action, a background job that charges later) is the
 * common case and does nothing.
 * @param {Response} response
 */
function announceCreditsSpent(response) {
  try {
    const spent = Number(response.headers.get(CREDITS_SPENT_HEADER));
    if (Number.isFinite(spent) && spent > 0) {
      window.dispatchEvent(new CustomEvent('cedar-data-changed'));
    }
  } catch {
    // Header parsing must never break the request it rode in on.
  }
}

/**
 * @param {string} path
 * @param {{method?: string, body?: any, headers?: Record<string, string>}} options
 */
async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  if (!RENDER_API_URL) throw new Error('The Praelecta API URL is not configured');
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
  // The server stamps X-Credits-Spent on any response whose handler charged.
  // Announcing it here means every paid feature refreshes the credit meter the
  // moment it settles — the meter used to sit on a stale number until the user
  // reloaded, which reads as credits quietly disappearing.
  announceCreditsSpent(response);
  if (!response.ok) {
    /** @type {Error & {code?: string, status?: number, response?: {data: any, status: number}}} */
    const error = new Error(data?.message || data?.error || `API request failed (${response.status})`);
    error.code = data?.code;
    error.status = response.status;
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
    if (file.size > MAX_RECORDING_BYTES) {
      throw new RangeError('This recording is over 24 MB. Save it in shorter sections (about 90 minutes or less each).');
    }
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
  async uploadAvatar(file) {
    const prepared = await apiRequest('/files/avatars/upload-url', {
      method: 'POST',
      body: { content_type: file.type, size_bytes: file.size },
    });
    const uploaded = await fetch(prepared.data.upload_url, {
      method: 'PUT', headers: prepared.data.headers, body: file,
    });
    if (!uploaded.ok) throw new Error(`Profile photo upload failed (${uploaded.status})`);
    return (await apiRequest('/files/avatars/confirm', {
      method: 'POST', body: { key: prepared.data.key },
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
        if (file.size > 7 * 1024 * 1024) throw new RangeError('Timetable files must be 7 MB or smaller');
        return { file_url: await readAsDataUrl(file) };
      }
      if (purpose === 'avatar') {
        const result = await files.uploadAvatar(file);
        return { file_url: result.storage_ref };
      }
      throw new Error('This file-upload purpose has not been migrated to private storage yet');
    },
  },
};

const auth = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      /** @type {Error & {status?: number}} */
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
    let previousAvatar = null;
    if (Object.hasOwn(allowed, 'avatar_url')) {
      const { data: current } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
      previousAvatar = current?.avatar_url || null;
    }
    if (Object.keys(allowed).length) {
      const { error } = await supabase.from('profiles').update(allowed).eq('id', user.id);
      if (error) throw error;
    }
    if (previousAvatar && previousAvatar !== allowed.avatar_url && previousAvatar.startsWith('r2://')) {
      await files.delete(previousAvatar).catch((error) => {
        console.error('Could not remove the previous profile photo', error);
      });
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
  async register({ email, password, legalVersion }) {
    // Consent is recorded at the moment the account is created, not inferred
    // from a signup date against whatever the documents say today. Refusing
    // without it means no future change to the signup UI can quietly create an
    // account that agreed to nothing — the client is the second line after the
    // checkbox, the same way the server is the authority on credits.
    if (!legalVersion) throw new Error('Terms acceptance is required to create an account');
    const emailRedirectTo = `${window.location.origin}/today`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        // Lands in raw_user_meta_data — no schema change, and it travels with
        // the account rather than living in a table that can drift from it.
        data: { legal_version: legalVersion, legal_accepted_at: new Date().toISOString() },
      },
    });
    if (error) throw error;
    return data;
  },
  async verifyOtp({ email, otpCode }) {
    let { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup',
    });
    // Some Supabase email templates issue the generic email OTP type. Support
    // both without weakening verification; Supabase validates the token and
    // intended email in either case.
    if (error) {
      ({ data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      }));
    }
    if (error) throw error;
    return data.session || data;
  },
  async resendOtp(email) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/today` },
    });
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
  async hasRecoverySession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    // URL-fragment recovery can finish just after the page's first render.
    // Wait briefly for supabase-js to exchange it instead of flashing an
    // invalid-link screen due to an initialization race.
    return new Promise((resolve) => {
      let settled = false;
      let timer;
      let subscription;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        subscription?.unsubscribe();
        resolve(value);
      };
      ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession) finish(true);
      }));
      if (settled) subscription.unsubscribe();
      else timer = setTimeout(() => finish(false), 4000);
    });
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
