import { translations } from './translations.js';
import { showToast } from './toast.js';

/** Show a success message in the bottom message bar. */
export function showSuccessMsg(msg, duration = 3000) {
  showToast(msg, { type: 'success', duration });
}

/** Show a problem (validation, failed action) without blocking the screen. */
export function showErrorMsg(msg, duration = 4500) {
  showToast(msg, { type: 'error', duration });
}

/**
 * Escape a string for safe insertion into HTML (text or attribute values).
 * User-entered names/titles and restored backups must never be treated as
 * markup.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Identity key for a record: date + service label. Several services can be
 * recorded on one date (e.g. Morning and Evening); the service label is
 * optional, case-insensitive, and blank means the main service.
 */
export function recordKey(r) {
  return (r.date || '') + '|' + String(r.service || '').trim().toLowerCase();
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
