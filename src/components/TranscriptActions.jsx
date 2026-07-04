import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Printer, Mail, Loader2, Check } from 'lucide-react';

export default function TranscriptActions({ lecture }) {
  const [printing, setPrinting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailSent, setEmailSent] = useState(false);

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

  const handleEmail = async (e) => {
    e.preventDefault();
    if (!emailAddr) return;
    setEmailing(true);
    try {
      await base44.functions.invoke('exportTranscript', {
        lecture_id: lecture.id,
        mode: 'email',
        email_to: emailAddr,
      });
      setEmailSent(true);
      setTimeout(() => { setShowEmail(false); setEmailSent(false); setEmailAddr(''); }, 2000);
    } catch (e) {
      alert('Could not send transcript email.');
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
        onClick={() => setShowEmail(!showEmail)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Mail className="w-3.5 h-3.5" /> Email
      </button>
      {showEmail && (
        <form onSubmit={handleEmail} className="flex items-center gap-2 animate-fade-in">
          <input
            type="email"
            value={emailAddr}
            onChange={e => setEmailAddr(e.target.value)}
            placeholder="email@example.com"
            className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 w-48"
            autoFocus
          />
          <button
            type="submit"
            disabled={emailing || !emailAddr}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {emailSent ? <Check className="w-3.5 h-3.5" /> : emailing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {emailSent ? 'Sent' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
}