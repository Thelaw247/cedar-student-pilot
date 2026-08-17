import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthConsent from './pages/OAuthConsent';
import Home from './pages/Home';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import LectureDetail from './pages/LectureDetail';
import StudyPlanner from './pages/StudyPlanner';
import SettingsPage from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import SemesterSetup from './pages/SemesterSetup';
import FocusMode from './pages/FocusMode';
import Analytics from './pages/Analytics';
import LectureReview from './pages/LectureReview';
import CheckoutSuccess from './pages/CheckoutSuccess';
import OwnerAnalytics from './pages/OwnerAnalytics';
import Subscription from './pages/Subscription';

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
    <Routes>
      {/* Public — reachable without an account. */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth-consent" element={<OAuthConsent />} />
      {/* The privacy policy is a legal document and has to be readable without
          signing in, so it sits outside the authenticated Layout. */}
      <Route path="/privacy" element={<PrivacyPolicy />} />

      {/* Everything below requires a signed-in user. */}
      <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<SemesterSetup />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/classes/:classId" element={<ClassDetail />} />
        <Route path="/lectures/:lectureId" element={<LectureDetail />} />
        {/* The AI Assistant page is deliberately not routed for now. Without a
            route, /assistant falls through to the catch-all 404 below and the
            page isn't bundled at all. src/pages/AIAssistant.jsx is kept on disk
            so it can be reinstated with an import and a route. */}
        <Route path="/planner" element={<StudyPlanner />} />
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