import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 text-white shadow-lg text-xs font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        You're offline — viewing cached data. Changes will sync when reconnected.
      </div>
    </div>
  );
}