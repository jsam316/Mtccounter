import { translations } from './translations.js';

/** Show the toast success message with custom text. */
export function showSuccessMsg(msg, duration = 3000) {
  const el = document.getElementById('successMsg');
  if (!el) return;
  const span = el.querySelector('[data-i18n="successMsg"]');
  const original = span ? span.textContent : '';
  if (span) span.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
    if (span) span.textContent = original;
  }, duration);
}

/**
 * Returns true if a stored field value means "not specified".
 * Handles empty strings and legacy records saved in either language.
 */
export function isNotSpecified(val) {
  return !val
    || val === translations.en.notSpecified
    || val === translations.ml.notSpecified;
}
