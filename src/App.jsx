import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
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
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth errors are handled inside ProtectedRoute now, so that the public
  // routes below stay reachable while signed out. Previously an auth_required
  // error short-circuited the whole route tree and bounced to Base44's hosted
  // login, which would have made these pages unreachable.
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
