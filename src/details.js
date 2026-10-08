// Collapsible "Service details" section on the Counter tab.
//
// The parish, date, service, celebrant, sermon and scripture fields live in
// a <details> element so the counters fit on one phone screen. Its summary
// row shows a one-line recap of what is set, and the open/closed choice is
// remembered.

import { t, getCurrentLang } from './translations.js';
import { getString, setString } from './state.js';

const OPEN_KEY = 'mtcDetailsOpen';
const LAST_KEY = 'mtcLastDetails';

/**
 * Remember the parish and celebrant last used, so the next service starts
 * with them instead of blank pickers (most parishes are the same every
 * week). Blank values don't overwrite what was remembered.
 */
export function rememberLastDetails(parishName, celebrant) {
  try {
    const prev = JSON.parse(getString(LAST_KEY) || '{}');
    setString(LAST_KEY, JSON.stringify({
      parishName: parishName || prev.parishName || '',
      celebrant:  celebrant  || prev.celebrant  || '',
    }));
  } catch { /* best-effort */ }
}

/** Fill empty parish/celebrant pickers with the remembered values, if still in the lists. */
function _restoreLastDetails() {
  let last = {};
  try { last = JSON.parse(getString(LAST_KEY) || '{}'); } catch { return; }
  for (const [id, value] of [['parishName', last.parishName], ['celebrant', last.celebrant]]) {
    const select = document.getElementById(id);
    if (!select || select.value || !value) continue;
    if ([...select.options].some(o => o.value === value)) select.value = value;
  }
}

/** Rebuild the one-line recap shown in the collapsed summary row. */
export function refreshServiceSummary() {
  const el = document.getElementById('serviceSummary');
  if (!el) return;
  const val = id => (document.getElementById(id)?.value || '').trim();

  const parts = [];
  const date = val('date');
  if (date) {
    const d = new Date(date + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString(getCurrentLang() === 'ml' ? 'ml-IN' : 'en-US',
        { weekday: 'short', day: 'numeric', month: 'short' }));
    }
  }
  const service = val('service');
  if (service) parts.push(service);
  const parish = val('parishName');
  const celebrant = val('celebrant');
  if (parish) parts.push(parish);
  if (celebrant) parts.push(celebrant);

  // Nothing beyond the date yet: invite the usher to fill the details in.
  if (!parish && !celebrant) parts.push(t('detailsEmpty'));
  el.textContent = parts.join(' · ');
}

export function initServiceDetails() {
  const details = document.getElementById('serviceDetails');
  if (!details) return;

  try { details.open = getString(OPEN_KEY) === 'true'; } catch { /* default closed */ }
  details.addEventListener('toggle', () => {
    try { setString(OPEN_KEY, String(details.open)); } catch { /* best-effort */ }
  });

  _restoreLastDetails();

  // Typing or picking in any field updates the recap.
  details.addEventListener('input', refreshServiceSummary);
  details.addEventListener('change', refreshServiceSummary);
  document.addEventListener('mtc:language-changed', refreshServiceSummary);

  // Picking a parish or celebrant remembers it for next time.
  for (const id of ['parishName', 'celebrant']) {
    document.getElementById(id)?.addEventListener('change', () =>
      rememberLastDetails(document.getElementById('parishName').value, document.getElementById('celebrant').value));
  }

  refreshServiceSummary();
}
