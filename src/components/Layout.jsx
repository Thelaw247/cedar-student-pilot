import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import VoiceAgent from './VoiceAgent';
import StudySessionNotifier from './StudySessionNotifier';

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <VoiceAgent />
      <StudySessionNotifier />
    </div>
  );
}