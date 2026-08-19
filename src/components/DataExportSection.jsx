import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Download, Loader2, FileJson, Trash2, AlertTriangle, Shield, Check } from 'lucide-react';

export default function DataExportSection() {
  const { clearOfflineData, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Delete flow state. `confirming` shows the destructive confirmation panel;
  // the user must type the confirmation word before the delete button enables.
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const CONFIRM_WORD = 'DELETE';

  const handleExport = async () => {
    setExporting(true);
    setSuccess(false);
    try {
      const response = await base44.functions.invoke('exportUserData', {});
      const data = response.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cedar-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    setDeleteError('');
    setDeleteResult(null);
    try {
      // The backend refuses to run without this, so a stray invoke can't wipe
      // an account. It also cancels any active Stripe subscription first.
      const response = await base44.functions.invoke('deleteUserData', { confirm: 'DELETE' });
      const data = response.data || { status: 'complete' };

      // The function aborts without deleting anything if the subscription
      // could not be cancelled — surface that instead of claiming success.
      if (data.status === 'aborted') {
        setDeleteError(data.message || 'Your subscription could not be cancelled, so nothing was deleted.');
        setDeleting(false);
        return;
      }

      // Remove this user's browser cache, queued writes, settings, dismissals,
      // and crash-recovery audio immediately. In particular, no queued mutation
      // can recreate deleted data while the success message is visible.
      await clearOfflineData();

      setDeleteResult(data);
      setConfirming(false);
      setConfirmText('');

      // Everything is gone, including the credit balance. Staying signed in
      // would show a half-empty app built on records that no longer exist, so
      // sign out and let them start clean.
      setTimeout(() => { void logout(); }, 4000);
    } catch (e) {
      console.error(e);
      setDeleteError('Something went wrong. Please try again, or contact support if it keeps happening.');
    }
    setDeleting(false);
  };

  return (
    <div>
      {/* Export */}
      <p className="text-sm text-muted-foreground mb-3">Download all your academic data — lectures, transcripts, notes, study history, and calendar events — as a JSON file.</p>
      <button onClick={handleExport} disabled={exporting}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</> : <><Download className="w-4 h-4" /> Export My Data</>}
      </button>
      {success && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <FileJson className="w-4 h-4" /> Export downloaded successfully.
        </div>
      )}

      {/* Privacy policy link */}
      <div className="mt-5 pt-4 border-t border-border">
        <Link to="/privacy" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Shield className="w-4 h-4" /> Read our Privacy Policy
        </Link>
      </div>

      {/* Danger zone — delete all data */}
      <div className="mt-5 pt-4 border-t border-border">
        {deleteResult ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-500">Your account has been reset</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {typeof deleteResult.total_deleted === 'number'
                    ? `${deleteResult.total_deleted} record${deleteResult.total_deleted !== 1 ? 's' : ''} removed.`
                    : 'Your data has been removed.'}
                  {deleteResult.subscription_cancelled && ' Your subscription has been cancelled.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Signing you out… signing in again will start a fresh free account.</p>
              </div>
            </div>
          </div>
        ) : !confirming ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">Permanently delete your account and everything in it. Any active subscription is cancelled. This can’t be undone.</p>
            <button onClick={() => { setConfirming(true); setDeleteError(''); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete My Account
            </button>
          </>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">This permanently deletes everything</p>
                <ul className="text-xs text-muted-foreground mt-1.5 space-y-1">
                  <li>• Lectures, transcripts, notes, flashcards and coverage data</li>
                  <li>• Classes, semesters, schedule and calendar events</li>
                  <li>• Your credit balance, including any credits you paid for</li>
                  <li>• Cached handbooks and all usage history</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Any active subscription is cancelled immediately. <span className="font-medium text-foreground">No refund is issued</span>, and purchased credits are not recoverable. Export a copy first if you want to keep anything.
                </p>
              </div>
            </div>

            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Type <span className="font-semibold text-foreground">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive/40 mb-3"
              autoFocus
            />

            {deleteError && (
              <p className="text-xs text-destructive mb-3">{deleteError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setConfirming(false); setConfirmText(''); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4" /> Delete my account</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
