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
 * Shared by QuickRecordCard (desktop rail) and ClassStatusBar (mobile
 * header + sidebar) so every mic in the chrome behaves identically.
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
    const ok = await rec.start({ id: cls.id, name: cls.name, color: cls.color });
    setStartingId(null);
    if (!ok) {
      // Mic refused/unavailable — the modal carries the permission message.
      navigate(`/classes/${cls.id}?record=1`);
    }
  }, [rec, navigate]);

  return { startForClass, startingId, recordingActive: rec.active };
}
