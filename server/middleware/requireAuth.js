// Verifies a caller's Supabase Auth session for protected routes — the
// backend-side equivalent of what createClientFromRequest(req) +
// base44.auth.me() did in every one of Base44's 28 functions.
//
// Deliberately does NOT verify the JWT signature locally. Calling Supabase
// Auth's own /auth/v1/user endpoint is the more faithful translation: Base44
// functions asked Base44's own auth service to validate the token, not a
// locally-held secret. This also means revocation and expiry are always
// correct without this server needing to manage or rotate a JWT secret of
// its own.
//
// Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY (the anon/publishable
// key — safe to expose, this is the same key a browser client would use).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[auth] SUPABASE_URL / SUPABASE_ANON_KEY not set — all protected routes will fail closed.');
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!resp.ok) return res.status(401).json({ error: 'Unauthorized' });

    const user = await resp.json();
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    req.user = user; // .id, .email, etc. — same shape a route would get from base44.auth.me()
    next();
  } catch (error) {
    console.error('[auth] verification request failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
