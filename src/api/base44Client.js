import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getCachedUserId } from '@/lib/currentUser';
import { cedar } from '@/lib/cedarClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// requiresAuth is deliberately left false.
//
// In the SDK it means "redirect to login if not authenticated" — and that
// redirect goes to Base44's HOSTED login screen, which would bypass this app's
// own login pages (src/pages/Login.jsx). Gating is done in the router instead,
// via ProtectedRoute in src/App.jsx, so the in-app flow stays the single
// source of truth. Do not flip this to true without also removing the custom
// auth pages.
const rawClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// ── Per-user isolation: stamp `user_id` on every client create ───────────────
//
// Every user-data entity gates create on `data.user_id === {{user.id}}` (RLS)
// and lists `user_id` as required, so a record MUST carry the signed-in user's
// id or the write is rejected twice over.
//
// IMPORTANT — why this is a Proxy and not a loop of assignments:
// `rawClient.entities` is itself a Proxy whose `get` trap calls
// createEntityHandler() and returns a BRAND-NEW object on every single access.
// `base44.entities.Lecture === base44.entities.Lecture` is false. Patching
// `entities.Lecture.create` therefore mutates a throwaway object that is
// discarded immediately, and the next access returns a fresh, unpatched
// handler. The only place a wrapper survives is on the access itself, so we
// intercept the lookup rather than the object it returns.
//
// `user_id` is injected LAST so a caller can never override it with someone
// else's id. The server rule is the real authority; this keeps legitimate
// creates from failing and closes the crafted-user_id path at the client too.
const USER_ENTITIES = new Set([
  'Semester', 'Class', 'Lecture', 'Note', 'Assignment', 'StudySession',
  'StudyRecord', 'StudySessionReview', 'KnowledgeCoverage', 'Flashcard',
  'PracticeQuestion', 'CalendarEvent', 'ClassAttendance', 'CustomTrack',
]);

const withUserId = (data) => {
  const user_id = getCachedUserId();
  if (!user_id && import.meta.env?.DEV) {
    // AuthContext populates this once auth resolves, which happens before any
    // protected page can render. Seeing this means something is writing before
    // the session is known, and the server will reject it.
    console.warn('[base44] create called before the user id was cached — this write will be rejected by RLS.');
  }
  return { ...(data || {}), user_id };
};

const entitiesProxy = new Proxy({}, {
  get(_target, name) {
    if (typeof name !== 'string') return Reflect.get(rawClient.entities, name);
    const ent = rawClient.entities[name];
    // Non-user entities (e.g. User) and internal lookups pass straight through.
    if (!ent || !USER_ENTITIES.has(name)) return ent;

    // Spreading is safe here: createEntityHandler returns a plain object whose
    // methods close over axios/appId/entityName and never reference `this`.
    return {
      ...ent,
      create: (data) => ent.create(withUserId(data)),
      bulkCreate: (rows) => ent.bulkCreate((Array.isArray(rows) ? rows : []).map(withUserId)),
    };
  },
});

// Proxy the client rather than assigning `rawClient.entities = …`, so this does
// not depend on that property being writable. Everything except `entities` is
// forwarded untouched — including `asServiceRole`, whose backend callers set
// `user_id` explicitly in the Deno functions.
const base44Sdk = new Proxy(rawClient, {
  get(target, prop) {
    if (prop === 'entities') return entitiesProxy;
    const value = target[prop];
    // Bind methods to the raw client so `this` is never the Proxy.
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

// The live Base44 build keeps its existing behavior unless this explicit
// staging flag is present. Cloudflare Pages can therefore exercise the new
// stack without changing or republishing the live Base44 application.
// Both adapters intentionally expose the same dynamic compatibility surface,
// but the Base44 SDK's generated proxy types and Cedar's handwritten adapter
// cannot be expressed as a useful static union. Type the boundary once here so
// every consumer does not need an unsafe cast of its own.
/** @type {any} */
export const base44 = import.meta.env.VITE_BACKEND_MODE === 'supabase'
  ? cedar
  : base44Sdk;
