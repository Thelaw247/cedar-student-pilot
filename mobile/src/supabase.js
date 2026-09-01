import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

/**
 * Supabase on iOS. Three things differ from the web client and each of them is
 * a real bug if you copy the web setup across.
 *
 * 1. STORAGE. The web client persists the session in localStorage, which does
 *    not exist here. A session token is a bearer credential, so it goes in the
 *    iOS keychain via SecureStore rather than AsyncStorage — AsyncStorage is
 *    unencrypted on disk and included in device backups.
 *
 * 2. detectSessionInUrl MUST be false. It defaults to true and is meaningless
 *    without a browser URL bar; left on, it throws during client construction
 *    on native. OAuth callbacks arrive through the praelecta:// deep link
 *    instead and are exchanged explicitly.
 *
 * 3. AUTO-REFRESH AND APP STATE. The web client refreshes on a timer that the
 *    browser keeps alive. iOS suspends timers when the app is backgrounded, so
 *    a student who records a 50-minute lecture with the screen off returns to
 *    an expired token and a failed upload. Refresh is therefore tied to
 *    AppState: stopped on background, restarted and immediately retried on
 *    foreground.
 */

const extra = Constants.expoConfig?.extra ?? {};

// Read from app.json extra rather than process.env: Metro has no
// import.meta.env, and EXPO_PUBLIC_ vars are inlined at build time in a way
// that silently yields undefined when the variable is missing.
export const API_URL = extra.apiUrl;
export const APP_ORIGIN = extra.appOrigin;

const SUPABASE_URL = extra.supabaseUrl;
const SUPABASE_ANON_KEY = extra.supabaseAnonKey;

/**
 * SecureStore has a 2048-byte value limit and throws above it. A Supabase
 * session with a large JWT can exceed that, so values are chunked. Silently
 * failing to persist a session logs the student out at the worst moment —
 * usually mid-recording — so this must not be best-effort.
 */
const CHUNK = 1800;

const secureStorage = {
  async getItem(key) {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith('__chunks__:')) return head;
    const count = Number(head.slice('__chunks__:'.length));
    const parts = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part === null) return null; // a missing chunk is a corrupt session, not a partial one
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key, value) {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(key, `__chunks__:${count}`);
  },
  async removeItem(key) {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith('__chunks__:')) {
      const count = Number(head.slice('__chunks__:'.length));
      for (let i = 0; i < count; i += 1) await SecureStore.deleteItemAsync(`${key}__${i}`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let appStateSubscription = null;

/** Called once from the root layout. Idempotent — a second call is a no-op. */
export function startAuthRefreshLifecycle() {
  if (appStateSubscription || Platform.OS === 'web') return () => {};
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}
