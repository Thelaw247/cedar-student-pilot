import { createClient } from '@supabase/supabase-js';

// Real Supabase project, same one the backend (server/) talks to. anon key
// is safe to ship to the browser by design — it's what every RLS policy is
// built to be called with from the client side.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.VITE_BACKEND_MODE === 'supabase' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — auth and data access will fail.');
}

// cedarClient is bundled alongside the Base44 compatibility path. Harmless
// placeholders keep the unused Supabase client from throwing during live
// Base44 startup when staging-only variables are intentionally absent.
export const supabase = createClient(
  SUPABASE_URL || 'https://not-configured.invalid',
  SUPABASE_ANON_KEY || 'not-configured',
);
