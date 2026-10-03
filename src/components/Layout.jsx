import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
import { NAV_ITEMS } from '@/lib/navItems';
import { usePublicPageMeta } from '@/hooks/usePublicPageMeta';

// Screens that are not tabs in the nav. Tabs take their name from NAV_ITEMS,
// so renaming a tab renames its title too.
const SCREEN_TITLES = {
  '/setup': 'Set up your semester',
  '/lectures': 'Lecture',
  '/focus': 'Focus session',
  '/lecture-review': 'Lecture review',
  '/subscription': 'Plans',
  '/checkout': 'Checkout',
  '/owner': 'Owner analytics',
};

/**
 * "Classes | Praelecta" for /classes and anything under it. Every app screen
 * used to carry the homepage's title, so a tab, the history list and a screen
 * reader's page announcement all said the same thing on every screen (WCAG
 * 2.4.2, Page Titled).
 */
function screenTitle(pathname) {
  const top = `/${pathname.split('/')[1] || ''}`;
  const name = NAV_ITEMS.find((item) => item.to === top)?.label || SCREEN_TITLES[top];
  return name ? `${name} | Praelecta` : undefined;
}

export default function Layout() {
  const { pathname } = useLocation();
  usePublicPageMeta({ title: screenTitle(pathname) });

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
      {/* First stop for the Tab key: jumps past the sidebar's links to the
          page itself (WCAG 2.4.1). Hidden until focused; styles in index.css. */}
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main id="main" tabIndex={-1} className="flex-1 outline-none pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
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