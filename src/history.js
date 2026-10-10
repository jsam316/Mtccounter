import { save, load, KEYS } from './state.js';
import { t, getCurrentLang } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { isNotSpecified, escapeHtml, recordKey, showSuccessMsg, showErrorMsg } from './utils.js';
import { withUndo } from './undo.js';
import { getMale, getFemale, getRounds, resetCounters } from './counter.js';
import { getCoCelebrantsValue } from './celebrants.js';
import { updateChapterOptions, updateVerseOptions } from './scripture.js';
import { switchTab } from './ui.js';
import { updateLectionaryHint } from './lectionary.js';
import { refreshServiceSummary, rememberLastDetails } from './details.js';
import { icon } from './icons.js';

export function getHistory() {
  return load(KEYS.history, []);
}

export function saveHistory(records) {
  save(KEYS.history, records);
}

export function saveRecord() {
  const date = document.getElementById('date').value;
  if (!date) { showErrorMsg(t('selectDateFirst')); return; }
  const service = (document.getElementById('service')?.value || '').trim();

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
    service,
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

  const key = recordKey(record);
  const commit = () => {
    const history = getHistory().filter(r => recordKey(r) !== key);
    history.unshift(record);
    saveHistory(history);
    document.dispatchEvent(new CustomEvent('mtc:data-changed'));
    displayHistory();
  };
  rememberLastDetails(parishName, celebrant);

  if (getHistory().some(r => recordKey(r) === key)) {
    // Replacing an earlier record for the same date and service: do it, and
    // offer Undo instead of asking first.
    withUndo(t('savedReplaced'), commit);
  } else {
    commit();
    showSuccessMsg(t('successMsg'));
  }
  triggerHaptic('success');
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
        || (r.service    || '').toLowerCase().includes(q)
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
    listEl.innerHTML = '<div class="empty-state"><p class="empty-icon">' + icon('clipboard') + '</p>'
      + '<p style="font-size:16px;font-weight:600;">' + t('noRecords') + '</p>'
      + '<p style="font-size:14px;margin-top:8px;opacity:0.7;">' + t('noRecordsDesc') + '</p></div>';
    return;
  }

  const allHistory = getHistory();
  const has = v => v && !isNotSpecified(v);
  let html = '';
  history.forEach(record => {
    let realIndex = allHistory.findIndex(r => r.date === record.date && r.timestamp === record.timestamp);
    if (realIndex === -1) realIndex = allHistory.findIndex(r => recordKey(r) === recordKey(record));

    const formattedDate = new Date(record.date + 'T00:00:00').toLocaleDateString(
      lang === 'ml' ? 'ml-IN' : 'en-US',
      { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
    );
    const male = Number(record.male) || 0;
    const female = Number(record.female) || 0;
    const total = Number(record.total) || male + female;
    const malePct = total > 0 ? Math.round((male / total) * 100) : 50;
    const who = [record.parishName, record.celebrant].filter(has).map(escapeHtml).join(' · ');
    const reading = [record.sermon, record.scripture].filter(has).map(escapeHtml).join(' · ');

    // Date and total up top; then who, the male/female split and the
    // sermon, each on one line; blank fields are simply left out.
    html += '<div class="history-item">'
      + '<div class="history-head">'
      +   '<div class="history-when">'
      +     '<div class="history-date">' + escapeHtml(formattedDate)
      +       (record.service ? ' <span class="history-service">' + escapeHtml(record.service) + '</span>' : '')
      +     '</div>'
      +     (who ? '<div class="history-meta">' + who + '</div>' : '')
      +   '</div>'
      +   '<div class="history-total"><span class="history-total-num">' + total + '</span>'
      +     '<span class="history-total-label">' + t('total') + '</span></div>'
      + '</div>'
      + '<div class="history-split" aria-label="' + escapeHtml(t('male') + ' ' + male + ', ' + t('female') + ' ' + female) + '">'
      +   '<span class="male-total">' + t('male') + ' <b>' + male + '</b></span>'
      +   '<span class="history-bar"><span style="width:' + malePct + '%"></span></span>'
      +   '<span class="female-total">' + t('female') + ' <b>' + female + '</b></span>'
      + '</div>'
      + (reading ? '<div class="history-reading">' + reading + '</div>' : '')
      + (has(record.coCelebrants) ? '<div class="history-reading">' + escapeHtml(t('coCelebrantsLabel')) + ': ' + escapeHtml(record.coCelebrants) + '</div>' : '')
      + '<div class="history-actions">'
      +   '<button class="history-btn load-btn" onclick="loadRecord(' + realIndex + ')">' + icon('pencil') + '<span>' + t('loadBtn') + '</span></button>'
      +   '<button class="history-btn delete-btn" onclick="deleteRecord(' + realIndex + ')" aria-label="' + escapeHtml(t('deleteBtn')) + '" title="' + escapeHtml(t('deleteBtn')) + '">' + icon('trash') + '</button>'
      + '</div></div>';
  });
  listEl.innerHTML = html;
}

export function loadRecord(index) {
  const record = getHistory()[index];
  if (!record) return;

  document.getElementById('date').value       = record.date;
  const serviceEl = document.getElementById('service');
  if (serviceEl) serviceEl.value = record.service || '';
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

  updateLectionaryHint();
  refreshServiceSummary(); // fields were set in code, so no input event fired
  switchTab('counter');
  triggerHaptic('success');
}

export function deleteRecord(index) {
  const history = getHistory();
  if (!history[index]) return;
  withUndo(t('recordDeleted'), () => {
    history.splice(index, 1);
    saveHistory(history);
    document.dispatchEvent(new CustomEvent('mtc:data-changed'));
    displayHistory();
  });
  triggerHaptic('error');
}
