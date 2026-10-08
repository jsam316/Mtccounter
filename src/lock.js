// Counting lock: while counting, only the male/female counter boxes (and
// their − buttons) respond, so a phone held in the hand or pocket can't
// accidentally hit Save, New, Delete, the tabs or the service details.
//
// Locked parts are made `inert` (no taps, no keyboard focus) and dimmed.
// The lock button itself stays active to unlock.

import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showToast } from './toast.js';

const LOCKED_SELECTORS = [
  '.top-controls', '.tabs', '#serviceDetails', '.assist-launch-btn',
  '.round-total-section', '.action-buttons', '.app-footer',
];

let _locked = false;

export function isCountingLocked() { return _locked; }

function _apply() {
  document.body.classList.toggle('counting-locked', _locked);
  for (const sel of LOCKED_SELECTORS) {
    document.querySelectorAll(sel).forEach(el => { el.inert = _locked; });
  }
  const btn = document.getElementById('lockBtn');
  if (btn) {
    btn.setAttribute('aria-pressed', String(_locked));
    btn.querySelector('.lock-icon').textContent = _locked ? '🔒' : '🔓';
    btn.querySelector('.lock-label').textContent = t(_locked ? 'lockOn' : 'lockOff');
  }
}

export function toggleCountingLock() {
  _locked = !_locked;
  _apply();
  triggerHaptic(_locked ? 'double' : 'light');
  showToast(t(_locked ? 'lockOnToast' : 'lockOffToast'), { type: 'info', duration: 2200 });
}

/** Re-apply labels after a language change. */
export function refreshCountingLock() { _apply(); }
