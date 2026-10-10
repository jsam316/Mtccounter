import { save, load, KEYS } from './state.js';
import { t } from './translations.js';
import { triggerHaptic, addHapticAnimation } from './haptic.js';
import { showSuccessMsg, showErrorMsg } from './utils.js';
import { withUndo } from './undo.js';
import { isCountingLocked } from './lock.js';
import { icon } from './icons.js';

let male = 0;
let female = 0;
let rounds = [];

export function getMale()   { return male; }
export function getFemale() { return female; }
export function getRounds() { return rounds; }

// Persist live counts so an in-progress count survives the tab being
// killed (e.g. app switch on mobile). Never let a storage failure break
// counting itself.
function saveLiveCounts() {
  try { save(KEYS.liveCounts, { male, female }); } catch { /* keep counting */ }
}

export function loadLiveCounts() {
  const saved = load(KEYS.liveCounts, null);
  if (saved) {
    male   = Math.max(0, parseInt(saved.male,   10) || 0);
    female = Math.max(0, parseInt(saved.female, 10) || 0);
  }
}

export function changeMale(amount) {
  male = Math.max(0, male + amount);
  saveLiveCounts();
  updateDisplay();
  triggerHaptic(amount > 0 ? 'light' : 'medium');
  addHapticAnimation(document.getElementById('maleCount'));
}

export function changeFemale(amount) {
  female = Math.max(0, female + amount);
  saveLiveCounts();
  updateDisplay();
  triggerHaptic(amount > 0 ? 'light' : 'medium');
  addHapticAnimation(document.getElementById('femaleCount'));
}

/** +1 from tapping anywhere on a counter box; shows feedback at the tap point. */
export function tapCounterBox(event, which) {
  if (which === 'male') changeMale(1); else changeFemale(1);
  const box = event && event.currentTarget;
  if (!box || !box.getBoundingClientRect) return;

  box.classList.add('flash');
  setTimeout(() => box.classList.remove('flash'), 140);

  const float = document.createElement('span');
  float.className = 'count-float ' + (which === 'male' ? 'male-total' : 'female-total');
  float.textContent = '+1';
  const r = box.getBoundingClientRect();
  const x = typeof event.clientX === 'number' && event.clientX ? event.clientX - r.left : r.width / 2;
  const y = typeof event.clientY === 'number' && event.clientY ? event.clientY - r.top : r.height / 2;
  float.style.left = Math.min(Math.max(x - 10, 8), r.width - 34) + 'px';
  float.style.top  = Math.max(y - 28, 4) + 'px';
  box.appendChild(float);
  setTimeout(() => float.remove(), 650);
}

export function updateDisplay() {
  let totalMale   = male;
  let totalFemale = female;
  if (rounds.length > 0) {
    rounds.forEach(r => { totalMale += r.male; totalFemale += r.female; });
  }
  document.getElementById('maleCount').textContent   = male;
  document.getElementById('femaleCount').textContent = female;
  document.getElementById('maleTotal').textContent   = totalMale;
  document.getElementById('femaleTotal').textContent = totalFemale;
  document.getElementById('grandTotal').textContent  = totalMale + totalFemale;
}

export function newRecord() {
  if (male === 0 && female === 0 && rounds.length === 0) return; // nothing to clear
  withUndo(t('newRecordDone'), () => {
    male = 0;
    female = 0;
    rounds = [];
    saveLiveCounts();
    saveRounds();
    updateDisplay();
    displayRounds();
  });
  triggerHaptic('double');
}

export function addToRoundTotal() {
  if (male === 0 && female === 0) {
    showErrorMsg(t('roundNothingToAdd'));
    return;
  }
  rounds.push({ male, female, total: male + female, timestamp: new Date().toISOString() });
  saveRounds();
  displayRounds();
  male = 0;
  female = 0;
  saveLiveCounts();
  updateDisplay();
  showSuccessMsg(t('roundAdded'), 2000);
  triggerHaptic('success');
}

export function removeRound(index) {
  withUndo(t('roundRemoved'), () => {
    rounds.splice(index, 1);
    saveRounds();
    displayRounds();
  });
  triggerHaptic('light');
}

export function clearRounds() {
  withUndo(t('roundsCleared'), () => {
    rounds = [];
    saveRounds();
    displayRounds();
  });
  triggerHaptic('double');
}

export function saveRounds() {
  save(KEYS.rounds, rounds);
}

export function loadRounds() {
  rounds = load(KEYS.rounds, []);
  displayRounds();
}

// With many rounds, only the latest few are listed until expanded, so the
// Save button stays close to the counters.
const ROUNDS_COLLAPSE_AT = 5;
const ROUNDS_SHOWN_COLLAPSED = 3;
let _roundsExpanded = false;

export function toggleRoundsExpanded() {
  _roundsExpanded = !_roundsExpanded;
  displayRounds();
}

function _roundTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function displayRounds() {
  const displayEl = document.getElementById('roundTotalDisplay');
  const badgeEl = document.getElementById('roundBadge');
  if (badgeEl) {
    badgeEl.textContent = rounds.length;
    badgeEl.hidden = rounds.length === 0;
  }
  if (rounds.length === 0) {
    _roundsExpanded = false;
    displayEl.innerHTML = '<div class="round-total-empty" data-i18n="roundEmptyState">'
      + t('roundEmptyState') + '</div>';
    updateDisplay();
    return;
  }

  let totalMale = 0;
  let totalFemale = 0;
  rounds.forEach(r => { totalMale += r.male; totalFemale += r.female; });

  const collapsible = rounds.length >= ROUNDS_COLLAPSE_AT;
  const first = collapsible && !_roundsExpanded ? rounds.length - ROUNDS_SHOWN_COLLAPSED : 0;

  let html = '<table class="round-table"><thead><tr>'
    + '<th scope="col"><span class="sr-only">' + t('roundTitle') + '</span></th>'
    + '<th scope="col" class="male-total" title="' + t('male') + '">♂</th>'
    + '<th scope="col" class="female-total" title="' + t('female') + '">♀</th>'
    + '<th scope="col">' + t('total') + '</th>'
    + '<th scope="col"></th>'
    + '</tr></thead><tbody>';
  if (collapsible) {
    const label = _roundsExpanded ? t('roundShowLess') : t('roundShowAll').replace('{n}', rounds.length);
    html += '<tr class="round-more"><td colspan="5"><button class="round-more-btn" onclick="toggleRoundsExpanded()"'
      + ' aria-expanded="' + _roundsExpanded + '">' + label + '</button></td></tr>';
  }
  for (let i = first; i < rounds.length; i++) {
    const round = rounds[i];
    const name = t('roundN').replace('{n}', i + 1);
    html += '<tr class="round-item">'
      + '<th scope="row">' + name + ' <span class="round-time">' + _roundTime(round.timestamp) + '</span></th>'
      + '<td class="male-total">' + round.male + '</td>'
      + '<td class="female-total">' + round.female + '</td>'
      + '<td>' + (round.male + round.female) + '</td>'
      + '<td><button class="round-item-remove" onclick="removeRound(' + i + ')" aria-label="'
      + t('roundRemoveLabel').replace('{n}', i + 1) + '">' + icon('x') + '</button></td>'
      + '</tr>';
  }
  html += '</tbody><tfoot><tr>'
    + '<th scope="row">' + t('roundsAll') + '</th>'
    + '<td class="male-total">' + totalMale + '</td>'
    + '<td class="female-total">' + totalFemale + '</td>'
    + '<td>' + (totalMale + totalFemale) + '</td>'
    + '<td><button class="clear-rounds-btn" onclick="clearRounds()" aria-label="' + t('clearRoundsBtn')
    + '" title="' + t('clearRoundsBtn') + '">' + icon('trash') + '</button></td>'
    + '</tr></tfoot></table>';

  displayEl.innerHTML = html;
  // The table is redrawn on every change, so re-apply the counting lock.
  displayEl.querySelector('.clear-rounds-btn').inert = isCountingLocked();
  updateDisplay();
}

/** Reset counters without a confirmation prompt (used by loadRecord). */
export function resetCounters(m, f, savedRounds) {
  male   = m;
  female = f;
  rounds = savedRounds ? savedRounds.slice() : [];
  saveLiveCounts();
  saveRounds();
  displayRounds();
  updateDisplay();
}
