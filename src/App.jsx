import { Toaster } from "@/components/ui/toaster"
import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const OAuthConsent = lazy(() => import('@/pages/OAuthConsent'));
const Home = lazy(() => import('./pages/Home'));
const Classes = lazy(() => import('./pages/Classes'));
const ClassDetail = lazy(() => import('./pages/ClassDetail'));
const LectureDetail = lazy(() => import('./pages/LectureDetail'));
const StudyPlanner = lazy(() => import('./pages/StudyPlanner'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const SemesterSetup = lazy(() => import('./pages/SemesterSetup'));
const FocusMode = lazy(() => import('./pages/FocusMode'));
const Analytics = lazy(() => import('./pages/Analytics'));
const LectureReview = lazy(() => import('./pages/LectureReview'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const OwnerAnalytics = lazy(() => import('./pages/OwnerAnalytics'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Landing = lazy(() => import('./pages/Landing'));
const Todos = lazy(() => import('./pages/Todos'));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <span className="sr-only">Loading page</span>
  </div>
);

/**
 * Sends an unauthenticated visitor to the in-app login page, remembering where
 * they were headed. safeReturnTo() in src/lib/authReturnTo.js validates this
 * value on the way back out — it must stay the only thing that consumes it.
 */
const RedirectToLogin = () => {
  const location = useLocation();
  const returnTo = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
};

const AuthenticatedApp = () => {
  // Deliberately NOT gated on isLoadingAuth / isLoadingPublicSettings.
  //
  // A top-level spinner here blocked every route until auth resolved — including
  // /login. That made the login page unreachable in exactly the situations you
  // need it: an unresolved session, a hung /api/apps/public request, an expired
  // token. The symptom was an endless spinner on /login with no way out.
  //
  // Public routes must always render. ProtectedRoute owns the loading state for
  // everything behind it (`if (isLoadingAuth || !authChecked) return fallback`),
  // so protected pages still show a spinner while auth is in flight.
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Public — reachable without an account. */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth-consent" element={<OAuthConsent />} />
      {/* The privacy policy and terms are legal documents and have to be
          readable without signing in, so they sit outside the authenticated
          Layout. Stripe and the app stores both link to them from outside the
          app; inside ProtectedRoute they would redirect a visitor to /login,
          and because the Worker serves a single-page app that redirect returns
          200, so nothing would look broken while being entirely broken. */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Everything below requires a signed-in user. */}
      <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
      {/* First-run onboarding renders without the app chrome — it is a focused
          full-screen flow (goal → promise → plan) that ends at /setup. */}
      <Route path="/welcome" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route path="/today" element={<Home />} />
        <Route path="/setup" element={<SemesterSetup />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/classes/:classId" element={<ClassDetail />} />
        <Route path="/lectures/:lectureId" element={<LectureDetail />} />
        {/* The AI Assistant was withdrawn (feature-flagged off since Base44)
            and its dead source purged in the conversion redesign; git history
            holds it if a real use case ever earns it back. */}
        <Route path="/planner" element={<StudyPlanner />} />
        {/* The To-do tab: tasks professors assign in lectures land here by
            themselves (enrichment pass), alongside the student's own. */}
        <Route path="/todos" element={<Todos />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/focus" element={<FocusMode />} />
        <Route path="/focus/:sessionId" element={<FocusMode />} />
        {/* Study Tools merged into the Study tab (/planner); redirect old links. */}
        <Route path="/study-tools" element={<Navigate to="/planner" replace />} />
        <Route path="/study-tools/:classId" element={<Navigate to="/planner" replace />} />
        <Route path="/analytics" element={<Analytics />} />
        {/* Lecture review is the review runner launched from the Study tab. */}
        <Route path="/lecture-review" element={<LectureReview />} />
        <Route path="/lecture-review/:scope" element={<LectureReview />} />
        <Route path="/lecture-review/lecture/:lectureId" element={<LectureReview />} />
        {/* Full plan comparison and checkout. Logged-in only for now; a public
            pricing page can reuse this once the landing page exists. */}
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        {/* Owner-only business dashboard: revenue, cost to serve and margin.
            Reached from the Owner dashboard card in Settings, which only
            renders for admins. That link is convenience only — the real gate
            is server-side, since the route itself is guessable: the
            ownerAnalytics function returns 403 to any non-admin caller. */}
        <Route path="/owner" element={<OwnerAnalytics />} />
      </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
