const SETTINGS_KEY = 'cedar-settings';

const DEFAULTS = {
  classReminders: true,
  studySessionReminders: true,
  assignmentDeadlines: true,
  autoGenerateSummaries: true,
  autoGenerateSchedules: true,
  autoFlashcards: true,
  highQualityAudio: true,
  autoTranscribe: true,
};

export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULTS, ...(stored ? JSON.parse(stored) : {}) };
  } catch {
    return DEFAULTS;
  }
}

export function getSetting(key) {
  return getSettings()[key];
}

export function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('cedar-settings-change'));
}