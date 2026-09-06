import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { safeReturnTo } from '@/lib/authReturnTo';
import { useAuth } from '@/lib/AuthContext';

/**
 * Where an email link lands.
 *
 * Until now there was nowhere. A confirmation link pointed at /today — a
 * PROTECTED route with no idea it was being used to finish a sign-up — and the
 * only thing that ever read an auth URL was supabase-js's own automatic
 * handling of the `#access_token=` fragment. That works, right up until the
 * link carries anything else, and then nothing at all happens: no session, no
 * error, a bounce to /login, and a student left staring at the six-digit code
 * box in the tab they signed up from.
 *
 * A link can arrive in four shapes, and this route answers all four rather
 * than assuming which one the project is configured to send:
 *
 *   #access_token=...      implicit. supabase-js consumes it before
 *                          getSession() resolves, so there is nothing to do
 *                          but read the session back.
 *   ?code=...              PKCE. Needs exchangeCodeForSession, and needs the
 *                          verifier this browser stored when it started the
 *                          flow — so it only works in the browser that began
 *                          it, which is why the message below says so.
 *   ?token_hash=..&type=.. a verification link. verifyOtp works from ANY
 *                          browser, which is the shape that survives a link
 *                          opened on a different device.
 *   ?error=..              an expired or already-used link. Worth saying out
 *                          loud; today it is indistinguishable from a bounce.
 *
 * Public by design. A route that finishes signing you in cannot be behind a
 * guard that requires you to already be signed in.
 */

const DEFAULT_NEXT = '/welcome';

/** Only ever an in-app path, so a crafted link cannot bounce someone offsite. */
function safeNext(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_NEXT;
  return raw;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState('');
  const [destination, setDestination] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const url = new URL(window.location.href);
      const query = url.searchParams;
      // Supabase reports failures in the fragment for implicit links and in the
      // query string for the rest, so both have to be read.
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const next = safeNext(query.get('next'));

      const linkError = query.get('error_description') || query.get('error')
        || hash.get('error_description') || hash.get('error');
      if (linkError) {
        if (!cancelled) setError(String(linkError).replace(/\+/g, ' '));
        return;
      }

      try {
        const tokenHash = query.get('token_hash');
        const type = query.get('type');
        if (tokenHash && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (otpError) throw otpError;
        } else if (query.get('code')) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(query.get('code'));
          if (codeError) throw codeError;
        }

        // Covers the implicit case, and confirms the other two actually landed
        // rather than trusting the call not to have errored.
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!data?.session) {
          setError('That link did not sign you in. It may have expired, or it may have already been used.');
          return;
        }

        // An explicit ?returnTo= still wins, so deep links and the OAuth
        // consent flow keep working exactly as they did.
        const explicitReturn = query.get('returnTo');
        setDestination(explicitReturn ? safeReturnTo() : next);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'That link could not be used to sign you in.');
      }
    };

    void finish();
    return () => { cancelled = true; };
  }, []);

  // Navigate only once AuthContext agrees there is a session, not the moment
  // Supabase hands one back.
  //
  // Both destinations are behind ProtectedRoute, and ProtectedRoute reads the
  // context, not Supabase. The context learns through onAuthStateChange and
  // then an async re-check, so between the session existing and the context
  // knowing it there is a window in which authChecked is already true and
  // isAuthenticated is still false — and a route entered in that window
  // bounces straight to /login. The spinner below covers exactly that gap.
  useEffect(() => {
    if (destination && isAuthenticated) navigate(destination, { replace: true });
  }, [destination, isAuthenticated, navigate]);

  if (error) {
    return (
      <AuthLayout icon={Mail} title="That link didn't work" subtitle={error}>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Confirmation links expire, and each one can only be used once. Signing in with the
          email and password you chose works too — the link is only there to save you the typing.
        </p>
        <Button className="w-full h-12 font-medium" onClick={() => navigate('/login', { replace: true })}>
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Mail} title="Signing you in" subtitle="One moment.">
      <div className="flex justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </AuthLayout>
  );
}
