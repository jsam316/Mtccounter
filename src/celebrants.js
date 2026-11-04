import { save, load, KEYS } from './state.js';
import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg, showErrorMsg, escapeHtml } from './utils.js';
import { withUndo } from './undo.js';
import { icon } from './icons.js';

export function getSavedCelebrants() {
  return load(KEYS.celebrants, []);
}

function _saveCelebrants(celebrants) {
  save(KEYS.celebrants, celebrants);
  updateCelebrantDatalist();
  displayCelebrantList();
  document.dispatchEvent(new CustomEvent('mtc:data-changed'));
}

export function updateCelebrantDatalist() {
  const celebrants = getSavedCelebrants();

  const select = document.getElementById('celebrant');
  const currentValue = select.value;
  select.innerHTML = '<option value="">-- Select Celebrant --</option>';
  celebrants.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (currentValue) select.value = currentValue;

  // A name deleted from the list disappears from the chips (and the saved
  // value) but keeps its tick, so Undo brings it back exactly as it was.
  renderCoCelebrants();
}

// ── Co-celebrants: one chip per saved celebrant, tap to select ───────────────

const _coSelected = new Set();
let _coExtra = []; // names on a loaded record that aren't in the saved list

/** Names offered as chips, in list order. The main celebrant is left out. */
function _coNames() {
  const main = document.getElementById('celebrant')?.value || '';
  const names = [...getSavedCelebrants()];
  for (const n of _coExtra) if (!names.includes(n)) names.push(n);
  return names.filter(n => n !== main);
}

export function renderCoCelebrants() {
  const box = document.getElementById('coCelebrants');
  if (!box) return;
  const names = _coNames();
  if (names.length === 0) {
    box.innerHTML = '<p class="co-chips-empty" data-i18n="coCelebrantsEmpty">' + t('coCelebrantsEmpty') + '</p>';
    return;
  }
  box.innerHTML = names.map(n => {
    const on = _coSelected.has(n);
    return '<button type="button" class="co-chip" aria-pressed="' + on + '" data-name="' + escapeHtml(n) + '">'
      + icon('check', 'co-chip-check') + '<span>' + escapeHtml(n) + '</span></button>';
  }).join('');
}

function _onCoChipTap(e) {
  const chip = e.target.closest('.co-chip');
  if (!chip) return;
  const name = chip.dataset.name;
  if (_coSelected.has(name)) _coSelected.delete(name); else _coSelected.add(name);
  chip.setAttribute('aria-pressed', String(_coSelected.has(name)));
  triggerHaptic('light');
}

/** Select exactly these names (used when a saved record is loaded). */
export function setCoCelebrants(names) {
  const list = (names || []).map(n => n.trim()).filter(Boolean);
  const saved = getSavedCelebrants();
  _coExtra = list.filter(n => !saved.includes(n));
  _coSelected.clear();
  list.forEach(n => _coSelected.add(n));
  renderCoCelebrants();
}

export function getCoCelebrantsValue() {
  return _coNames().filter(n => _coSelected.has(n)).join(', ');
}

export function openCelebrantManager() {
  document.getElementById('celebrantManager').classList.add('show');
  displayCelebrantList();
  triggerHaptic('light');
}

export function closeCelebrantManager() {
  document.getElementById('celebrantManager').classList.remove('show');
  document.getElementById('newCelebrantName').value = '';
  triggerHaptic('light');
}

export function addCelebrant() {
  const nameInput = document.getElementById('newCelebrantName');
  const name = nameInput.value.trim();
  if (!name) { showErrorMsg(t('enterCelebrantName')); return; }
  const celebrants = getSavedCelebrants();
  if (celebrants.includes(name)) {
    showErrorMsg(t('celebrantExists'));
    triggerHaptic('error');
    return;
  }
  celebrants.push(name);
  celebrants.sort();
  _saveCelebrants(celebrants);
  nameInput.value = '';
  showSuccessMsg(t('celebrantAdded'), 2000);
  triggerHaptic('success');
}

export function deleteCelebrant(name) {
  withUndo(t('celebrantDeleted'), () => {
    const celebrants = getSavedCelebrants().filter(c => c !== name);
    _saveCelebrants(celebrants);
  });
  triggerHaptic('double');
}

export function displayCelebrantList() {
  const celebrants = getSavedCelebrants();
  const display = document.getElementById('celebrantListDisplay');
  if (celebrants.length === 0) {
    display.innerHTML = '<div class="celebrant-empty-state">' + t('noCelebrants') + '</div>';
    return;
  }
  let html = '';
  celebrants.forEach(name => {
    html += '<div class="celebrant-item">'
      + '<span class="celebrant-name">' + escapeHtml(name) + '</span>'
      + '<button class="delete-celebrant-btn" data-name="' + escapeHtml(name) + '">'
      + '<span data-i18n="deleteCelebrant">' + t('deleteCelebrant') + '</span>'
      + '</button></div>';
  });
  display.innerHTML = html;
  // Names live in a data attribute (never inside inline JS), read back via
  // dataset which decodes the escaping for us.
  display.onclick = e => {
    const btn = e.target.closest('.delete-celebrant-btn');
    if (btn) deleteCelebrant(btn.dataset.name);
  };
}

export function toggleCoCelebrants() {
  const toggle = document.getElementById('coCelebrantsToggle');
  const field  = document.getElementById('coCelebrantsField');
  const isActive = toggle.classList.contains('active');
  toggle.classList.toggle('active', !isActive);
  toggle.setAttribute('aria-checked', String(!isActive));
  field.classList.toggle('active', !isActive);
  localStorage.setItem('coCelebrantsEnabled', String(!isActive));
  triggerHaptic('light');
}

export function initCoCelebrantsToggle() {
  document.getElementById('coCelebrants').addEventListener('click', _onCoChipTap);
  // The main celebrant can't also be a co-celebrant: refresh the chips.
  document.getElementById('celebrant').addEventListener('change', renderCoCelebrants);
  if (localStorage.getItem('coCelebrantsEnabled') === 'true') {
    const toggle = document.getElementById('coCelebrantsToggle');
    toggle.classList.add('active');
    toggle.setAttribute('aria-checked', 'true');
    document.getElementById('coCelebrantsField').classList.add('active');
  }
}
