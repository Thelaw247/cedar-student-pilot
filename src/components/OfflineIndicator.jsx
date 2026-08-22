import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Check } from 'lucide-react';
import { getQueueLength, replayQueue, hasPending } from '@/lib/syncQueue';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getQueueLength());
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-replay queue when reconnected
      if (hasPending()) {
        setSyncing(true);
        replayQueue().then(({ succeeded, failed }) => {
          setSyncing(false);
          setPendingCount(getQueueLength());
          if (succeeded > 0 && failed === 0) {
            setJustSynced(true);
            setTimeout(() => setJustSynced(false), 3000);
          }
          // Invalidate all cached data after sync so fresh reads happen
          window.dispatchEvent(new CustomEvent('cedar-data-changed'));
        });
      }
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChanged = () => setPendingCount(getQueueLength());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('cedar-sync-queue-changed', handleQueueChanged);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cedar-sync-queue-changed', handleQueueChanged);
    };
  }, []);

  const handleManualSync = () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    replayQueue().then(() => {
      setSyncing(false);
      setPendingCount(getQueueLength());
      window.dispatchEvent(new CustomEvent('cedar-data-changed'));
    });
  };

  // Just synced toast
  if (justSynced) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white shadow-lg text-xs font-medium">
          <Check className="w-3.5 h-3.5" />
          Synced — all changes saved.
        </div>
      </div>
    );
  }

  // Offline with pending changes
  if (!isOnline && pendingCount > 0) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/95 text-white shadow-lg text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          Offline — {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued
        </div>
      </div>
    );
  }

  // Offline, no pending
  if (!isOnline) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 text-white shadow-lg text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — viewing cached data.
        </div>
      </div>
    );
  }

  // Online with pending changes (manual sync button)
  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
        <button onClick={handleManualSync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : `Sync ${pendingCount} change${pendingCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    );
  }

  // Syncing indicator
  if (syncing) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/90 text-primary-foreground shadow-lg text-xs font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Syncing changes...
        </div>
      </div>
    );
  }

  return null;
}
