import React, { useEffect, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import StudySessionNotifier from './StudySessionNotifier';
import OfflineIndicator from './OfflineIndicator';
import CommandPalette from './CommandPalette';
import ShortcutsHelp from './ShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      {/* The floating AI chat button is intentionally not rendered. It sat at
          the same fixed position as the Today page's quick-task button
          (both bottom-20 / lg:bottom-6, right-4, z-40) and the two overlapped.
          src/components/FloatingChat.jsx is left in place — re-add <FloatingChat />
          here once it has a position that doesn't collide. The full AI page at
          /ai is unaffected. */}
      <StudySessionNotifier />
      <OfflineIndicator />
      <CommandPalette />
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}