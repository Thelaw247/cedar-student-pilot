import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import { startAnalyticsIfAllowed } from '@/lib/analyticsConsent'
import App from '@/App.jsx'
import '@/index.css'

// Inter, self-hosted. It used to come from Google Fonts, which meant every
// visitor's browser called Google before the page could draw a word.

// HeyCatch product analytics (https://heycatch.ai/agents.md), started only for
// a visitor who has allowed it in the cookie banner or in Settings. Module
// scope in the entry file, before anything renders, so that visitor's first
// page view is still seen; lib/analyticsConsent.js holds the config, the
// stored answer and the reasons. Anyone who has not said yes is never
// tracked, and every other analytics call is a no-op for them.
startAnalyticsIfAllowed()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
