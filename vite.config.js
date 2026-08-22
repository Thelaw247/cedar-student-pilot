import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    // Base44's plugin previously supplied this implicitly. Define it here so
    // the independent Cloudflare build does not depend on that plugin.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    // Cloudflare is the isolated Supabase/Render staging build. Keeping the
    // Base44 Vite plugin out of that build prevents Base44 proxy, analytics,
    // navigation, and editor hooks from running in the parallel stack. The
    // default/live Base44 build retains its existing plugin unchanged.
    ...(mode === 'cloudflare' ? [] : [base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    })]),
    react(),
  ],
}));
