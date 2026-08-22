import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { clearLegacyUserStorage, clearOtherUserStorage, clearUserStorage, getCachedUserId, setCachedUserId } from '@/lib/currentUser';
import { clearAllRecordings, clearOtherRecordings, initializeRecordingStore } from '@/lib/recordingStore';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();
const USE_SUPABASE = import.meta.env.VITE_BACKEND_MODE === 'supabase';

async function purgeUserOfflineData(userId) {
  if (!userId) return;
  // localStorage deletion is synchronous; wait for IndexedDB before logout can
  // navigate away so crash-recovery audio is not left behind.
  clearUserStorage(userId);
  await clearAllRecordings(userId);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    // Unscoped values from older builds have no safe owner. Remove them once,
    // and open IndexedDB v2 so its unscoped recording store is dropped too.
    clearLegacyUserStorage();
    void initializeRecordingStore();
    if (USE_SUPABASE) {
      setAppPublicSettings({ id: 'cedar-student-pilot', public_settings: {} });
      setIsLoadingPublicSettings(false);
      void checkUserAuth();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        void checkUserAuth();
      });
      return () => subscription.unsubscribe();
    }
    checkAppState();
  }, []);

  const checkAppState = async () => {
    if (USE_SUPABASE) {
      setAppPublicSettings({ id: 'cedar-student-pilot', public_settings: {} });
      setIsLoadingPublicSettings(false);
      await checkUserAuth();
      return;
    }
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        // authChecked must be set on EVERY terminal path. Leaving it false
        // while isLoadingAuth is false is the exact state ProtectedRoute treats
        // as "auth not yet checked", which made it retry forever — and, once
        // the retry loop was fixed, sit on a permanent spinner instead.
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      // Same reason as the inner catch above.
      setAuthChecked(true);
    }
  };

  // Memoised deliberately — do not convert back to a plain function.
  //
  // ProtectedRoute depends on this function's identity inside a useEffect. When
  // it was recreated on every provider render, that effect re-fired on every
  // render: call -> setState -> re-render -> new identity -> call, an unbounded
  // loop that pegs the main thread and looks like the app failing to load.
  //
  // The empty dependency array is correct: the body only uses setState setters
  // (stable by contract) and the module-level base44 client.
  const checkUserAuth = useCallback(async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      const previousUserId = getCachedUserId();
      if (previousUserId && previousUserId !== currentUser.id) {
        await purgeUserOfflineData(previousUserId);
      }
      // A token can be switched outside this app between reloads, when the old
      // in-memory id is unavailable. Remove any other account's scoped residue.
      clearOtherUserStorage(currentUser.id);
      await clearOtherRecordings(currentUser.id);
      setUser(currentUser);
      setCachedUserId(currentUser.id);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      const isAuthRejection = error.status === 401 || error.status === 403;
      // A signed-out visitor reaching a public auth page is normal state, not
      // an application error. Keep real network/server failures visible.
      if (!isAuthRejection) console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token. Only purge on an
      // authoritative auth rejection; a network outage must preserve this
      // user's offline data so offline mode can still work.
      if (isAuthRejection) {
        const previousUserId = getCachedUserId();
        await purgeUserOfflineData(previousUserId);
        clearOtherUserStorage(null);
        await clearOtherRecordings(null);
        setCachedUserId(null);
        setUser(null);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  }, []);

  const clearOfflineData = useCallback(async () => {
    const userId = user?.id || getCachedUserId();
    await purgeUserOfflineData(userId);
  }, [user?.id]);

  const logout = useCallback(async (shouldRedirect = true) => {
    await clearOfflineData();
    setUser(null);
    setIsAuthenticated(false);
    setCachedUserId(null);

    try {
      if (shouldRedirect) {
        // Land on the in-app login page rather than back on the page they just
        // signed out of, which would immediately bounce them here anyway.
        await base44.auth.logout(`${window.location.origin}/login`);
      } else {
        // Just remove the token without redirect.
        await base44.auth.logout();
      }
    } catch {
      if (shouldRedirect) window.location.href = '/login';
    }
  }, [clearOfflineData]);

  // The app uses its own login pages (src/pages/Login.jsx), not Base44's hosted
  // screen, so this must not call base44.auth.redirectToLogin() — doing so
  // would bypass the in-app flow entirely. ProtectedRoute is what normally
  // performs this redirect; this stays for any imperative caller.
  const navigateToLogin = () => {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?returnTo=${returnTo}`;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      clearOfflineData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
