import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, FileJson, Shield } from 'lucide-react';

export default function DataExportSection() {
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

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
      a.download = `praelecta-export-${new Date().toISOString().split('T')[0]}.json`;
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

      {/* Account deletion moved to the Account section, next to profile and
          sign-out — see src/components/DeleteAccountSection.jsx. */}
    </div>
  );
}
