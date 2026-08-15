import { save, load, KEYS } from './state.js';
import { t } from './translations.js';
import { triggerHaptic, addHapticAnimation } from './haptic.js';
import { showSuccessMsg } from './utils.js';

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
  if (!confirm(t('newRecordConfirm'))) return;
  male = 0;
  female = 0;
  rounds = [];
  saveLiveCounts();
  saveRounds();
  updateDisplay();
  displayRounds();
  triggerHaptic('double');
}

export function addToRoundTotal() {
  if (male === 0 && female === 0) {
    alert(t('selectDateFirst'));
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
  rounds.splice(index, 1);
  saveRounds();
  displayRounds();
  triggerHaptic('light');
}

export function clearRounds() {
  if (!confirm(t('clearRoundsConfirm'))) return;
  rounds = [];
  saveRounds();
  displayRounds();
  showSuccessMsg(t('roundsCleared'), 2000);
  triggerHaptic('double');
}

export function saveRounds() {
  save(KEYS.rounds, rounds);
}

export function loadRounds() {
  rounds = load(KEYS.rounds, []);
  displayRounds();
}

export function displayRounds() {
  const displayEl = document.getElementById('roundTotalDisplay');
  const summaryEl = document.getElementById('roundTotalSummary');
  if (rounds.length === 0) {
    displayEl.innerHTML = '<div class="round-total-empty" data-i18n="roundEmptyState">'
      + t('roundEmptyState') + '</div>';
    summaryEl.style.display = 'none';
    updateDisplay();
    return;
  }

  let totalMale = 0;
  let totalFemale = 0;
  let html = '';
  rounds.forEach((round, index) => {
    totalMale   += round.male;
    totalFemale += round.female;
    html += '<div class="round-item">';
    html += '<span class="round-item-label">Round ' + (index + 1) + ':</span>';
    html += '<div class="round-item-values">';
    html += '<span class="male-total">♂ '   + round.male   + '</span>';
    html += '<span class="female-total">♀ ' + round.female + '</span>';
    html += '<span>= ' + round.total + '</span>';
    html += '</div>';
    html += '<button class="round-item-remove" onclick="removeRound(' + index + ')">✕</button>';
    html += '</div>';
  });

  displayEl.innerHTML = html;
  document.getElementById('roundCount').textContent       = rounds.length;
  document.getElementById('roundMaleTotal').textContent   = totalMale;
  document.getElementById('roundFemaleTotal').textContent = totalFemale;
  document.getElementById('roundGrandTotal').textContent  = totalMale + totalFemale;
  summaryEl.style.display = 'block';
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
