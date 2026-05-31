import { save, load, KEYS } from './state.js';
import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg } from './utils.js';

export function getSavedParishes() {
  return load(KEYS.parishes, []);
}

function _saveParishes(parishes) {
  save(KEYS.parishes, parishes);
  updateParishDatalist();
  displayParishList();
}

export function updateParishDatalist() {
  const parishes = getSavedParishes();
  const select = document.getElementById('parishName');
  const currentValue = select.value;
  select.innerHTML = '<option value="">-- Select Parish --</option>';
  parishes.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (currentValue) select.value = currentValue;
}

export function openParishManager() {
  document.getElementById('parishManager').classList.add('show');
  displayParishList();
  triggerHaptic('light');
}

export function closeParishManager() {
  document.getElementById('parishManager').classList.remove('show');
  document.getElementById('newParishName').value = '';
  triggerHaptic('light');
}

export function addParish() {
  const nameInput = document.getElementById('newParishName');
  const name = nameInput.value.trim();
  if (!name) { alert(t('enterParishName')); return; }
  const parishes = getSavedParishes();
  if (parishes.includes(name)) {
    alert(t('parishExists'));
    triggerHaptic('error');
    return;
  }
  parishes.push(name);
  parishes.sort();
  _saveParishes(parishes);
  nameInput.value = '';
  showSuccessMsg(t('parishAdded'), 2000);
  triggerHaptic('success');
}

export function deleteParish(name) {
  if (!confirm('Delete "' + name + '"?')) return;
  const parishes = getSavedParishes().filter(p => p !== name);
  _saveParishes(parishes);
  showSuccessMsg(t('parishDeleted'), 2000);
  triggerHaptic('double');
}

export function displayParishList() {
  const parishes = getSavedParishes();
  const display = document.getElementById('parishListDisplay');
  if (parishes.length === 0) {
    display.innerHTML = '<div class="celebrant-empty-state">' + t('noParishes') + '</div>';
    return;
  }
  let html = '';
  parishes.forEach(name => {
    const escaped = name.replace(/'/g, "\\'");
    html += '<div class="celebrant-item">'
      + '<span class="celebrant-name">' + name + '</span>'
      + '<button class="delete-celebrant-btn" onclick="deleteParish(\'' + escaped + '\')">'
      + '<span data-i18n="deleteParish">' + t('deleteParish') + '</span>'
      + '</button></div>';
  });
  display.innerHTML = html;
}
