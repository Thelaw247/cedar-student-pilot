import { userStorageKey } from './currentUser.js';

const settingsKey = () => userStorageKey('settings');

// Only settings something reads. Six switches nothing used were removed in
// Oct 2026 (see the note in pages/Settings.jsx); values a browser still has
// stored for them are ignored.
const DEFAULTS = {
  studySessionReminders: true,
  // Browser notifications when a class ends. Off until the student turns it
  // on in Settings; a browser that already granted the permission before
  // this switch existed (Oct 2026) keeps its notifications (UpNextCard).
  classChangeNotifications: null,
  autoGenerateSchedules: true,
  learningMode: 'cumulative',
  conceptDecayRate: 'default',
  // How fast a recording plays back, remembered across lectures: a student
  // who listens at 1.5x listens at 1.5x (components/lecture/RecordingPlayer).
  playbackRate: 1,
};

export function getSettings() {
  try {
    const storageKey = settingsKey();
    if (!storageKey) return { ...DEFAULTS };
    const stored = localStorage.getItem(storageKey);
    return { ...DEFAULTS, ...(stored ? JSON.parse(stored) : {}) };
  } catch {
    return DEFAULTS;
  }
}

export function getSetting(key) {
  return getSettings()[key];
}

export function setSetting(key, value) {
  const storageKey = settingsKey();
  if (!storageKey) return;
  const settings = getSettings();
  settings[key] = value;
  localStorage.setItem(storageKey, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('cedar-settings-change'));
}