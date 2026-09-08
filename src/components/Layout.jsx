import React, { useEffect, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import ClassStatusBar from './ClassStatusBar';
import DesktopRail from './DesktopRail';
import StudySessionNotifier from './StudySessionNotifier';
import OfflineIndicator from './OfflineIndicator';
import CommandPalette from './CommandPalette';
import ShortcutsHelp from './ShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import UpgradeProvider from './monetization/UpgradeContext';
import PendingSchedules from './monetization/PendingSchedules';
import { RecordingProvider } from '@/recording/RecordingContext';
import RecordingIsland from '@/recording/RecordingIsland';
import { StudySessionProvider } from '@/study/StudySessionContext';

export default function Layout() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('cedar-theme');
    if (stored === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('cedar-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [showShortcuts, setShowShortcuts] = useState(false);

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  useKeyboardShortcuts({
    onSearch: openCommandPalette,
    onHelp: () => setShowShortcuts(true),
  });

  return (
    // UpgradeProvider mounts the single upgrade sheet for every authenticated
    // surface; the credit meter (Sidebar) and any LockedFeature open it via
    // useUpgrade(). See docs/MONETIZATION_KIT.md.
    <UpgradeProvider>
    {/* RecordingProvider sits above the router so a live recording session
        survives navigation; RecordingIsland is its floating handle on every
        page (Design Blueprint §3). It must be inside UpgradeProvider — the
        save flow opens the upgrade sheet on a 402. */}
    {/* StudySessionProvider is the same move for the study clock, and for the
        same reason: the timer used to live inside Focus Mode, whose tools were
        all overlays, so you could not navigate away from a running session by
        accident. Now three of the study tools are routes — pressing "Quiz me"
        would have ended the session it belonged to, silently. The clock sits
        above the router; the study page is only its handle. */}
    <RecordingProvider>
    <StudySessionProvider>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <ClassStatusBar variant="mobile" />
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <DesktopRail />
      {/* The floating AI chat button was withdrawn with the AI Assistant and
          its source purged in the conversion redesign (git history holds it). */}
      <StudySessionNotifier />
      {/* Finishes the job a plan boundary interrupted: a deadline whose
          sessions were skipped on a smaller plan is booked the moment the
          new one lands, wherever in the app the student happens to be. */}
      <PendingSchedules />
      <OfflineIndicator />
      <CommandPalette />
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <RecordingIsland />
    </div>
    </StudySessionProvider>
    </RecordingProvider>
    </UpgradeProvider>
  );
}