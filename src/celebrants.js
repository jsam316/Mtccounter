import { save, load, KEYS } from './state.js';
import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg, escapeHtml } from './utils.js';

export function getSavedCelebrants() {
  return load(KEYS.celebrants, []);
}

function _saveCelebrants(celebrants) {
  save(KEYS.celebrants, celebrants);
  updateCelebrantDatalist();
  displayCelebrantList();
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

  const coSelect = document.getElementById('coCelebrants');
  const selectedValues = Array.from(coSelect.selectedOptions).map(o => o.value);
  coSelect.innerHTML = '';
  celebrants.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (selectedValues.includes(name)) opt.selected = true;
    coSelect.appendChild(opt);
  });
}

export function getCoCelebrantsValue() {
  const coSelect = document.getElementById('coCelebrants');
  return Array.from(coSelect.selectedOptions).map(o => o.value).join(', ');
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
  if (!name) { alert(t('enterCelebrantName')); return; }
  const celebrants = getSavedCelebrants();
  if (celebrants.includes(name)) {
    alert(t('celebrantExists'));
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
  if (!confirm('Delete "' + name + '"?')) return;
  const celebrants = getSavedCelebrants().filter(c => c !== name);
  _saveCelebrants(celebrants);
  showSuccessMsg(t('celebrantDeleted'), 2000);
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
  if (localStorage.getItem('coCelebrantsEnabled') === 'true') {
    const toggle = document.getElementById('coCelebrantsToggle');
    toggle.classList.add('active');
    toggle.setAttribute('aria-checked', 'true');
    document.getElementById('coCelebrantsField').classList.add('active');
  }
}
