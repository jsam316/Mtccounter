// Centralized localStorage wrapper with quota-exceeded protection.

export const KEYS = Object.freeze({
  history:                'mtcHistory',
  celebrants:             'savedCelebrants',
  parishes:               'savedParishes',
  rounds:                 'mtcRounds',
  liveCounts:             'mtcLiveCounts',
  language:               'language',
  darkMode:               'darkMode',
  installPromptDismissed: 'installPromptDismissed',
  coCelebrantsEnabled:    'coCelebrantsEnabled',
});

function _showStorageWarning() {
  const el = document.getElementById('successMsg');
  if (!el) return;
  const span = el.querySelector('[data-i18n="successMsg"]');
  if (span) span.textContent = '⚠️ Storage full! Export and delete old records to free space.';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

/** Load a JSON-serialised value; returns fallback if key absent or parse fails. */
export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Save a JSON-serialised value. Shows a warning and re-throws on QuotaExceededError. */
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      _showStorageWarning();
    }
    throw e;
  }
}

/** Load a plain string value (no JSON parsing). */
export function getString(key, fallback = null) {
  const v = localStorage.getItem(key);
  return v !== null ? v : fallback;
}

/** Save a plain string value. */
export function setString(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      _showStorageWarning();
    }
    throw e;
  }
}

export function remove(key) {
  localStorage.removeItem(key);
}
