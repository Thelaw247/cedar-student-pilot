import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, FileJson, Trash2, AlertTriangle, Shield, Check } from 'lucide-react';

export default function DataExportSection() {
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Delete flow state. `confirming` shows the destructive confirmation panel;
  // the user must type the confirmation word before the delete button enables.
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleteError, setDeleteError] = useState(false);

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
    setDeleteError(false);
    setDeleteResult(null);
    try {
      const response = await base44.functions.invoke('deleteUserData', {});
      setDeleteResult(response.data || { status: 'complete' });
      setConfirming(false);
      setConfirmText('');
    } catch (e) {
      console.error(e);
      setDeleteError(true);
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
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-500">Your data has been deleted</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {typeof deleteResult.total_deleted === 'number'
                    ? `${deleteResult.total_deleted} record${deleteResult.total_deleted !== 1 ? 's' : ''} removed from your account.`
                    : 'Your academic data has been removed from your account.'}
                </p>
              </div>
            </div>
          </div>
        ) : !confirming ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">Permanently delete all of your academic data from your account. This can’t be undone.</p>
            <button onClick={() => { setConfirming(true); setDeleteError(false); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete My Data
            </button>
          </>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">This permanently deletes everything</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All your lectures, transcripts, notes, study history, schedule, and coverage data will be erased. Consider exporting a copy first. This action can’t be reversed.
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
              <p className="text-xs text-destructive mb-3">Something went wrong. Please try again, or contact support if it keeps happening.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setConfirming(false); setConfirmText(''); setDeleteError(false); }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4" /> Delete everything</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
