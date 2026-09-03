import { userStorageKey } from './currentUser';

const settingsKey = () => userStorageKey('settings');

const DEFAULTS = {
  classReminders: true,
  studySessionReminders: true,
  assignmentDeadlines: true,
  autoGenerateSummaries: true,
  autoGenerateSchedules: true,
  autoFlashcards: true,
  highQualityAudio: true,
  autoTranscribe: true,
  learningMode: 'cumulative',
  conceptDecayRate: 'default',
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