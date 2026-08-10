import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

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
