// Counting lock: while counting, only the male/female counter boxes (and
// their − buttons) and the rounds respond, so a phone held in the hand or
// pocket can't accidentally hit Save, New, Delete, the tabs or the service
// details. Rounds stay usable because adding a round is part of counting;
// only "Clear all rounds" is locked.
//
// Locked parts are made `inert` (no taps, no keyboard focus) and dimmed.
// The lock button itself stays active to unlock.

import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showToast } from './toast.js';

const LOCKED_SELECTORS = [
  '.top-controls', '.tabs', '#serviceDetails', '.assist-launch-btn',
  '.clear-rounds-btn', '.action-buttons', '.app-footer',
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
    btn.querySelector('.lock-label').textContent = t(_locked ? 'lockOn' : 'lockOff');
  }
}

export function toggleCountingLock() {
  _locked = !_locked;
  _apply();
  if (_locked) centerCountingArea();
  triggerHaptic(_locked ? 'double' : 'light');
  showToast(t(_locked ? 'lockOnToast' : 'lockOffToast'), { type: 'info', duration: 2200 });
}

/**
 * Scroll so the counting area (totals, both counters and the rounds) sits in
 * the middle of the screen. If it is taller than the screen, keep as much as
 * fits from the top: totals first, or the counters on short screens.
 */
export function centerCountingArea() {
  const total = document.querySelector('.total-box');
  const counters = document.getElementById('maleBox');
  const rounds = document.querySelector('.round-total-section');
  if (!total || !counters || !rounds) return;

  const viewH = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  const margin = 12;
  const docTop = el => el.getBoundingClientRect().top + window.scrollY;
  const bottom = rounds.getBoundingClientRect().bottom + window.scrollY;

  let top = docTop(total);
  if (bottom - top > viewH - 2 * margin) top = docTop(counters);
  const height = bottom - top;
  const target = height <= viewH - 2 * margin
    ? top - (viewH - height) / 2   // fits: centre it
    : top - margin;                // too tall: start at the top of it

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' });
}

/** Re-apply labels after a language change. */
export function refreshCountingLock() { _apply(); }
