import { save, load, KEYS } from './state.js';
import { t, getCurrentLang } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { isNotSpecified } from './utils.js';
import { getMale, getFemale, getRounds, resetCounters } from './counter.js';
import { getCoCelebrantsValue } from './celebrants.js';
import { updateChapterOptions, updateVerseOptions } from './scripture.js';
import { switchTab } from './ui.js';

export function getHistory() {
  return load(KEYS.history, []);
}

export function saveHistory(records) {
  save(KEYS.history, records);
}

export function saveRecord() {
  const date = document.getElementById('date').value;
  if (!date) { alert(t('selectDateFirst')); return; }

  const parishName = document.getElementById('parishName').value.trim() || '';
  const celebrant  = document.getElementById('celebrant').value.trim() || '';
  let coCelebrants = '';
  if (document.getElementById('coCelebrantsToggle').classList.contains('active')) {
    coCelebrants = getCoCelebrantsValue();
  }
  const sermon     = document.getElementById('sermon').value.trim() || '';
  const book       = document.getElementById('book').value;
  const chapter    = document.getElementById('chapter').value;
  const verseStart = document.getElementById('verseStart').value;
  const verseEnd   = document.getElementById('verseEnd').value;

  let scripture = '';
  if (book) {
    scripture = book;
    if (chapter) {
      scripture += ' ' + chapter;
      if (verseStart) {
        scripture += ':' + verseStart;
        if (verseEnd && verseEnd !== verseStart) scripture += '-' + verseEnd;
      }
    }
  }

  const rounds = getRounds();
  let totalMale   = getMale();
  let totalFemale = getFemale();
  rounds.forEach(r => { totalMale += r.male; totalFemale += r.female; });

  const record = {
    date,
    parishName,
    celebrant,
    coCelebrants,
    sermon,
    scripture,
    male:      totalMale,
    female:    totalFemale,
    total:     totalMale + totalFemale,
    rounds:    rounds.length > 0 ? rounds.slice() : [],
    timestamp: new Date().toISOString()
  };

  let history = getHistory();
  history = history.filter(r => r.date !== date);
  history.unshift(record);
  saveHistory(history);

  const msg = document.getElementById('successMsg');
  msg.style.display = 'block';
  triggerHaptic('success');
  setTimeout(() => { msg.style.display = 'none'; }, 3000);

  displayHistory();
}

export function displayHistory() {
  const searchEl = document.getElementById('historySearch');
  if (searchEl) searchEl.value = '';
  const history = getHistory();
  renderHistoryItems(history, document.getElementById('historyList'));
}

export function filterHistory(query) {
  const history = getHistory();
  const q = (query || '').trim().toLowerCase();
  const filtered = q
    ? history.filter(r =>
        (r.parishName || '').toLowerCase().includes(q)
        || (r.celebrant  || '').toLowerCase().includes(q)
        || (r.sermon     || '').toLowerCase().includes(q)
        || (r.scripture  || '').toLowerCase().includes(q)
        || (r.date       || '').includes(q))
    : history;
  renderHistoryItems(filtered, document.getElementById('historyList'));
}

export function renderHistoryItems(history, listEl) {
  if (!listEl) return;
  const lang = getCurrentLang();

  if (history.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>📋</p>'
      + '<p style="font-size:16px;font-weight:600;">' + t('noRecords') + '</p>'
      + '<p style="font-size:14px;margin-top:8px;opacity:0.7;">' + t('noRecordsDesc') + '</p></div>';
    return;
  }

  const allHistory = getHistory();
  let html = '';
  history.forEach(record => {
    let realIndex = allHistory.findIndex(r => r.date === record.date && r.timestamp === record.timestamp);
    if (realIndex === -1) realIndex = allHistory.findIndex(r => r.date === record.date);

    const formattedDate = new Date(record.date + 'T00:00:00').toLocaleDateString(
      lang === 'ml' ? 'ml-IN' : 'en-US',
      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    );

    html += '<div class="history-item">';
    html += '<div class="history-date">' + formattedDate + '</div>';
    html += '<div class="history-details">';
    html += '<strong>' + t('parish')    + ':</strong> ' + (record.parishName || t('notSpecified')) + '<br>';
    html += '<strong>' + t('celebrant') + ':</strong> ' + (record.celebrant  || t('notSpecified')) + '<br>';
    if (record.coCelebrants && !isNotSpecified(record.coCelebrants)) {
      html += '<strong>' + t('coCelebrantsLabel') + ':</strong> ' + record.coCelebrants + '<br>';
    }
    html += '<strong>' + t('sermon')    + ':</strong> ' + (record.sermon    || t('notSpecified')) + '<br>';
    html += '<strong>' + t('scripture') + ':</strong> ' + (record.scripture || t('notSpecified')) + '<br>';
    html += '<strong>' + t('attendance') + ':</strong> '
      + t('male')   + ': ' + record.male   + ', '
      + t('female') + ': ' + record.female + ', '
      + t('total')  + ': ' + record.total;
    html += '</div>';
    html += '<div class="history-actions">';
    html += '<button class="history-btn load-btn"   onclick="loadRecord('   + realIndex + ')">' + t('loadBtn')   + '</button>';
    html += '<button class="history-btn delete-btn" onclick="deleteRecord(' + realIndex + ')">' + t('deleteBtn') + '</button>';
    html += '</div></div>';
  });
  listEl.innerHTML = html;
}

export function loadRecord(index) {
  const record = getHistory()[index];
  if (!record) return;

  document.getElementById('date').value       = record.date;
  document.getElementById('parishName').value = isNotSpecified(record.parishName) ? '' : record.parishName;
  document.getElementById('celebrant').value  = isNotSpecified(record.celebrant)  ? '' : record.celebrant;

  const coSelect = document.getElementById('coCelebrants');
  Array.from(coSelect.options).forEach(o => { o.selected = false; });
  if (record.coCelebrants && !isNotSpecified(record.coCelebrants)) {
    const names = record.coCelebrants.split(',').map(n => n.trim());
    Array.from(coSelect.options).forEach(o => { if (names.includes(o.value)) o.selected = true; });
    if (!document.getElementById('coCelebrantsToggle').classList.contains('active')) {
      // Import side-effect: toggleCoCelebrants is exposed globally
      window.toggleCoCelebrants && window.toggleCoCelebrants();
    }
  }

  document.getElementById('sermon').value = isNotSpecified(record.sermon) ? '' : record.sermon;

  if (record.scripture && !isNotSpecified(record.scripture)) {
    const parts       = record.scripture.split(' ');
    const bookName    = parts.slice(0, -1).join(' ');
    const chapterVerse = parts[parts.length - 1];
    if (chapterVerse) {
      const cv = chapterVerse.split(':');
      document.getElementById('book').value = bookName;
      updateChapterOptions(bookName);
      const chNum = parseInt(cv[0], 10);
      document.getElementById('chapter').value = cv[0] || '';
      updateVerseOptions(bookName, chNum);
      if (cv[1]) {
        const vParts = cv[1].split('-');
        document.getElementById('verseStart').value = vParts[0] || '';
        document.getElementById('verseEnd').value   = vParts[1] || vParts[0] || '';
      }
    }
  }

  if (record.rounds && record.rounds.length > 0) {
    resetCounters(0, 0, record.rounds);
  } else {
    resetCounters(record.male, record.female, []);
  }

  switchTab('counter');
  triggerHaptic('success');
}

export function deleteRecord(index) {
  if (!confirm(t('deleteConfirm'))) return;
  const history = getHistory();
  history.splice(index, 1);
  saveHistory(history);
  displayHistory();
  triggerHaptic('error');
}
