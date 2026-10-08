// Undo for destructive actions (delete a record, clear rounds, start a new
// record, delete a name, restore a backup, replace a record).
//
// Instead of asking "Are you sure?" first, the action happens right away
// and a message offers Undo for a few seconds. Undo puts back a snapshot of
// the stored data taken just before the action; main.js listens for
// 'mtc:data-restored' and refreshes the counters and lists.

import { KEYS } from './state.js';
import { t } from './translations.js';
import { showToast } from './toast.js';
import { triggerHaptic } from './haptic.js';

// Everything an undoable action can change.
export const UNDO_KEYS = Object.freeze([
  KEYS.history, KEYS.celebrants, KEYS.parishes, KEYS.rounds, KEYS.liveCounts,
]);

const UNDO_SECONDS = 7;

/** Raw stored values of the undoable keys (null = key absent). */
export function takeSnapshot() {
  const snap = {};
  for (const k of UNDO_KEYS) snap[k] = localStorage.getItem(k);
  return snap;
}

/** Write a snapshot back exactly as it was. */
export function restoreSnapshot(snap) {
  for (const k of UNDO_KEYS) {
    if (snap[k] === null || snap[k] === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, snap[k]);
  }
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('mtc:data-restored'));
    document.dispatchEvent(new CustomEvent('mtc:data-changed')); // re-backup the restored state
  }
}

/**
 * Run a destructive action, then offer Undo.
 * The action may return false to signal it did nothing (no Undo shown).
 */
export function withUndo(message, action) {
  const snap = takeSnapshot();
  const result = action();
  if (result === false) return;
  showToast(message, {
    type: 'info',
    duration: UNDO_SECONDS * 1000,
    action: {
      label: t('undo'),
      onClick: () => {
        restoreSnapshot(snap);
        triggerHaptic('light');
        showToast(t('undone'), { type: 'success', duration: 2000 });
      },
    },
  });
}
