import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, startAuthRefreshLifecycle } from './supabase';
import { shouldRecheckAuth } from '../../shared/authEvents';

/**
 * Auth state for the native app.
 *
 * Reuses shouldRecheckAuth from shared/ — the same rule the web app uses to
 * decide whether an auth event is a real identity change or noise. That
 * function exists because TOKEN_REFRESHED fires constantly and treating it as
 * a sign-in tore down the whole tree; on iOS the same mistake would tear down
 * an in-progress recording, which is worse than a flicker.
 */

const AuthContext = createContext({ session: null, user: null, loading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);
  const userIdRef = useRef(null);

  useEffect(() => {
    const stopLifecycle = startAuthRefreshLifecycle();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      userIdRef.current = data.session?.user?.id ?? null;
      checkedRef.current = true;
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      const nextId = next?.user?.id ?? null;
      if (!shouldRecheckAuth(event, nextId, userIdRef.current)) return;
      userIdRef.current = nextId;
      setSession(next ?? null);
      // Only show the splash before the first resolution. After that an auth
      // event must never blank the screen — the app may be recording.
      if (!checkedRef.current) setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      stopLifecycle();
    };
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
