import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  // Fire the fallback auth check at most once per mount. checkUserAuth is
  // memoised in AuthContext so this effect no longer re-fires on every render,
  // but the ref makes that guarantee local: if the context is ever refactored
  // and the function stops being stable, this can still only run once instead
  // of spinning into an infinite call/render loop.
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!authChecked && !isLoadingAuth && !attemptedRef.current) {
      attemptedRef.current = true;
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
