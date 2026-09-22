import React from 'react'
import ReactDOM from 'react-dom/client'
import { analytics } from '@heycatch/sdk'
import App from '@/App.jsx'
import '@/index.css'

// HeyCatch product analytics (https://heycatch.ai/agents.md).
//
// Module scope in the entry file, before anything renders, with a static
// import: that is what the install guide requires, and it is what lets the
// SDK see the first page view. The project key is publishable by design —
// it belongs in the bundle, the way the Supabase anon key does.
//
// tracingHosts names the API because it lives on its own host: requests to it
// then carry X-POSTHOG-SESSION-ID, which server/lib/http.js must allow through
// CORS or the browser drops the request (server/test/analytics-install.test.js
// keeps the two in step). Nothing else is configured: no apiHost, no guards,
// and no hand-instrumented UI events — autocapture covers those.
analytics.init({
  projectKey: 'hck_pk_DAwNG96mZXpjqzyKcLl-K5UIEoeRbPrB',
  install: {
    framework: 'vite-react',
    // React's major. The guide asks for "the detected major" and does not say
    // which half of vite-react to read; React is what the app is written in,
    // Vite only builds it.
    frameworkVersion: '18',
    agent: 'claude-code',
  },
  tracingHosts: ['api.praelecta.ca'],
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
