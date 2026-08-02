import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Home from './pages/Home';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import LectureDetail from './pages/LectureDetail';
import AIAssistant from './pages/AIAssistant';
import StudyPlanner from './pages/StudyPlanner';
import SettingsPage from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import SemesterSetup from './pages/SemesterSetup';
import FocusMode from './pages/FocusMode';
import Analytics from './pages/Analytics';
import LectureReview from './pages/LectureReview';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<SemesterSetup />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/classes/:classId" element={<ClassDetail />} />
        <Route path="/lectures/:lectureId" element={<LectureDetail />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/planner" element={<StudyPlanner />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
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
