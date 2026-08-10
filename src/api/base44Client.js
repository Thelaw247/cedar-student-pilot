import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getCachedUserId } from '@/lib/currentUser';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// requiresAuth is deliberately left false.
//
// In the SDK it means "redirect to login if not authenticated" — and that
// redirect goes to Base44's HOSTED login screen, which would bypass this app's
// own login pages (src/pages/Login.jsx). Gating is done in the router instead,
// via ProtectedRoute in src/App.jsx, so the in-app flow stays the single
// source of truth. Do not flip this to true without also removing the custom
// auth pages.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// ── Per-user isolation: stamp `user_id` on every client create ───────────────
// Every user-data entity gates create on `data.user_id === {{user.id}}` (RLS),
// so a record MUST carry the signed-in user's id or the create is rejected.
// Rather than edit every call site, we wrap create/bulkCreate once here.
// `user_id` is injected LAST so a caller can never override it with someone
// else's id — the server rule is the real authority, but this keeps legit
// creates from failing and closes the poison-by-crafted-user_id path at the
// client too. The cached id is populated by AuthContext after auth resolves,
// which is before any protected page can render and create a record.
const USER_ENTITIES = [
  'Semester', 'Class', 'Lecture', 'Note', 'Assignment', 'StudySession',
  'StudyRecord', 'StudySessionReview', 'KnowledgeCoverage', 'Flashcard',
  'PracticeQuestion', 'CalendarEvent', 'ClassAttendance', 'CustomTrack',
];

for (const name of USER_ENTITIES) {
  const ent = base44.entities[name];
  if (!ent) continue;

  if (typeof ent.create === 'function') {
    const origCreate = ent.create.bind(ent);
    ent.create = (data) => origCreate({ ...(data || {}), user_id: getCachedUserId() });
  }
  if (typeof ent.bulkCreate === 'function') {
    const origBulk = ent.bulkCreate.bind(ent);
    ent.bulkCreate = (arr) =>
      origBulk((Array.isArray(arr) ? arr : []).map((d) => ({ ...(d || {}), user_id: getCachedUserId() })));
  }
}