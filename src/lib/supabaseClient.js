import { createClient } from '@supabase/supabase-js';

// Real Supabase project, same one the backend (server/) talks to. anon key
// is safe to ship to the browser by design — it's what every RLS policy is
// built to be called with from the client side.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — auth and data access will fail.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
