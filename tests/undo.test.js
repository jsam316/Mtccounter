// Undo snapshots: everything an undoable action changes comes back exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { takeSnapshot, restoreSnapshot, UNDO_KEYS } from '../src/undo.js';
import { KEYS } from '../src/state.js';

test('undo covers records, names, rounds and live counts', () => {
  for (const k of [KEYS.history, KEYS.celebrants, KEYS.parishes, KEYS.rounds, KEYS.liveCounts]) {
    assert.ok(UNDO_KEYS.includes(k), k);
  }
});

test('restore puts back changed, deleted and newly added values', () => {
  localStorage.clear();
  localStorage.setItem(KEYS.history, '[{"date":"2026-10-04","total":90}]');
  localStorage.setItem(KEYS.rounds, '[{"male":3,"female":4}]');
  // celebrants absent before the action
  const snap = takeSnapshot();

  localStorage.setItem(KEYS.history, '[]');                 // record deleted
  localStorage.removeItem(KEYS.rounds);                    // rounds cleared
  localStorage.setItem(KEYS.celebrants, '["Rev. New"]');   // something added

  restoreSnapshot(snap);
  assert.equal(localStorage.getItem(KEYS.history), '[{"date":"2026-10-04","total":90}]');
  assert.equal(localStorage.getItem(KEYS.rounds), '[{"male":3,"female":4}]');
  assert.equal(localStorage.getItem(KEYS.celebrants), null, 'a key absent before is absent again');
});

test('settings outside the undo set are not touched', () => {
  localStorage.clear();
  localStorage.setItem('language', 'ml');
  const snap = takeSnapshot();
  localStorage.setItem('language', 'en');
  restoreSnapshot(snap);
  assert.equal(localStorage.getItem('language'), 'en');
});
