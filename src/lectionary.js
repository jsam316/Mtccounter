import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';

// Mar Thoma Sabha Lectionary — 'YYYY-MM-DD' → { occasion, theme }.
//
// Source: Malankara Mar Thoma Syrian Church Lectionary for the Christian
// Year 2026 (Diocese of North America & Europe edition).
// Only entries verified against the published lectionary are included —
// do NOT guess themes. Extend this map as further dates are confirmed.
export const LECTIONARY = {
  '2026-01-01': {
    occasion: 'New Year Day / Circumcision of our Lord',
    theme: 'Freedom under the Yoke of Christ',
  },
  '2026-01-04': {
    occasion: 'Mission Outside Kerala Sunday',
    theme: "Mission: unveiling God's love to all",
  },
};

export function getLectionaryEntry(dateStr) {
  return LECTIONARY[dateStr] || null;
}

/**
 * Refresh the lectionary hint for the currently selected date.
 * If a lectionary entry exists and the sermon field is empty, the theme is
 * filled in automatically; the hint stays visible either way so the user
 * can tap it to (re)apply the theme.
 */
export function updateLectionaryHint() {
  const hint   = document.getElementById('lectionaryHint');
  const sermon = document.getElementById('sermon');
  if (!hint || !sermon) return;

  const entry = getLectionaryEntry(document.getElementById('date').value);
  if (!entry) {
    hint.style.display = 'none';
    return;
  }

  hint.textContent   = '📖 ' + entry.occasion + ' — ' + entry.theme;
  hint.title         = t('lectionaryTapHint');
  hint.style.display = 'block';

  if (!sermon.value.trim()) sermon.value = entry.theme;
}

/** Fill the sermon field with the lectionary theme for the selected date. */
export function applyLectionaryTheme() {
  const entry = getLectionaryEntry(document.getElementById('date').value);
  if (!entry) return;
  document.getElementById('sermon').value = entry.theme;
  triggerHaptic('light');
}
