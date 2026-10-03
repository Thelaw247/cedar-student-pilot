import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, FileJson, Shield } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/lib/legal';

export default function DataExportSection() {
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setSuccess(false);
    setFailed(false);
    try {
      const response = await base44.functions.invoke('exportUserData', {});
      const data = response.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `praelecta-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (e) {
      // A failed export used to end silently: the spinner stopped and nothing
      // downloaded, with no word as to why.
      console.error(e);
      setFailed(true);
    }
    setExporting(false);
  };

  return (
    <div>
      {/* Export */}
      {/* Says what the file holds, in the privacy policy's words (Your controls). */}
      <p className="text-sm text-muted-foreground mb-3">Download your account data as a JSON file: lectures, transcripts, notes, schedule, study history, credits, your review and the record of what you agreed to.</p>
      <button onClick={handleExport} disabled={exporting}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        {exporting ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Exporting…</> : <><Download className="w-4 h-4" aria-hidden="true" /> Export my data</>}
      </button>
      {success && (
        <div role="status" className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <FileJson className="w-4 h-4" aria-hidden="true" /> Export downloaded successfully.
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          The export didn&rsquo;t download. Try again in a minute, and if it keeps failing, email {SUPPORT_EMAIL}.
        </p>
      )}

      {/* Privacy policy link */}
      <div className="mt-5 pt-4 border-t border-border">
        <Link to="/privacy" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Shield className="w-4 h-4" aria-hidden="true" /> Read our Privacy Policy
        </Link>
      </div>

      {/* Account deletion moved to the Account section, next to profile and
          sign-out — see src/components/DeleteAccountSection.jsx. */}
    </div>
  );
}
