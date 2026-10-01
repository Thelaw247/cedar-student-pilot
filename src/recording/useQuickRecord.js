import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecording } from '@/recording/RecordingContext';

/**
 * One-tap recording (Design Blueprint follow-up, Aug 2026).
 *
 * The rule: when a class already has the recording-consent attestation on
 * file, tapping a mic anywhere starts the session IMMEDIATELY — the island
 * appears and the student is recording, no modal in between. When consent
 * hasn't been confirmed yet (or the mic is refused), we fall back to the
 * class page's RecordModal, which owns the consent gate and error copy —
 * the legal flow is never skipped, only the redundant tap after it.
 *
 * Used by ClassStatusBar (mobile header + desktop sidebar) — the one record
 * entry point in the chrome since the 3 Sep 2026 audit removed the second
 * copy that used to also live in the desktop rail (QuickRecordCard).
 */
export function useQuickRecord() {
  const rec = useRecording();
  const navigate = useNavigate();
  const [startingId, setStartingId] = useState(null);

  const startForClass = useCallback(async (cls) => {
    if (!cls) return;
    // One session at a time — if something is live, the island is the
    // control surface; the class page explains this if they push through.
    if (rec.active) {
      navigate(`/classes/${cls.id}?record=1`);
      return;
    }
    if (!cls.recording_consent_confirmed) {
      navigate(`/classes/${cls.id}?record=1`);
      return;
    }
    setStartingId(cls.id);
    const outcome = await rec.start({ id: cls.id, name: cls.name, color: cls.color });
    setStartingId(null);
    // start() answers with a word, never a boolean: 'started', 'busy',
    // 'recovery-pending' or 'mic-denied'. Anything but 'started' needs the
    // class page's modal — a refused microphone, a recording waiting to be
    // recovered — and used to leave the student on Today with nothing shown.
    if (outcome !== 'started') {
      navigate(`/classes/${cls.id}?record=1`);
    }
  }, [rec, navigate]);

  return { startForClass, startingId, recordingActive: rec.active };
}
