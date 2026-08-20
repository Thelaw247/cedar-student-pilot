import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Printer, Mail, Loader2, Check } from 'lucide-react';

/**
 * Print and email export for a lecture transcript.
 *
 * Email has no recipient field on purpose. The backend (exportTranscript)
 * always sends to the signed-in account's own email — a security scan
 * correctly flagged the old free-text "email to anyone" field as an open
 * mail relay (any authenticated user could send arbitrary content to any
 * third-party address). A UI field the backend no longer honours would be a
 * worse bug than no field at all, so this was removed rather than left to
 * silently misbehave.
 */
export default function TranscriptActions({ lecture }) {
  const { user } = useAuth();
  const [printing, setPrinting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);

  if (!lecture?.transcript) return null;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const res = await base44.functions.invoke('exportTranscript', {
        lecture_id: lecture.id,
        mode: 'print',
      });
      const html = res.data?.html;
      if (!html) throw new Error('No print data returned');
      const printWin = window.open('', '_blank');
      if (!printWin) {
        alert('Please allow pop-ups to print transcripts.');
        return;
      }
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 500);
    } catch (e) {
      alert('Could not prepare transcript for printing.');
    }
    setPrinting(false);
  };

  const handleEmail = async () => {
    setEmailing(true);
    setEmailError(null);
    try {
      await base44.functions.invoke('exportTranscript', {
        lecture_id: lecture.id,
        mode: 'email',
      });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (e) {
      setEmailError(e?.response?.data?.error || 'Could not send transcript email.');
    }
    setEmailing(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrint}
        disabled={printing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
        Print
      </button>
      <button
        onClick={handleEmail}
        disabled={emailing}
        title={user?.email ? `Email a copy to ${user.email}` : 'Email a copy to your account'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        {emailSent ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : emailing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
        {emailSent ? 'Sent to you' : 'Email me a copy'}
      </button>
      {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
    </div>
  );
}
