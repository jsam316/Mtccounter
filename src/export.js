import { save, load, KEYS } from './state.js';
import { t, getCurrentLang } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg } from './utils.js';
import { getMale, getFemale, getRounds } from './counter.js';
import { getCoCelebrantsValue } from './celebrants.js';
import { getHistory, saveHistory, displayHistory } from './history.js';
import { updateCelebrantDatalist } from './celebrants.js';
import { updateParishDatalist } from './parishes.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function getScriptureText(fallback) {
  const book       = document.getElementById('book').value;
  const chapter    = document.getElementById('chapter').value;
  const verseStart = document.getElementById('verseStart').value;
  const verseEnd   = document.getElementById('verseEnd').value;
  if (!book) return fallback;
  let s = book;
  if (chapter) {
    s += ' ' + chapter;
    if (verseStart) {
      s += ':' + verseStart;
      if (verseEnd && verseEnd !== verseStart) s += '-' + verseEnd;
    }
  }
  return s;
}

function getFormTotals() {
  const rounds = getRounds();
  let totalMale   = getMale();
  let totalFemale = getFemale();
  if (rounds.length > 0) {
    totalMale = 0; totalFemale = 0;
    rounds.forEach(r => { totalMale += r.male; totalFemale += r.female; });
  }
  return { totalMale, totalFemale };
}

function buildReportText() {
  const lang        = getCurrentLang();
  const date        = document.getElementById('date').value;
  const parishName  = document.getElementById('parishName').value || t('notSpecified');
  const celebrant   = document.getElementById('celebrant').value  || t('notSpecified');
  let coCelebrants  = '';
  if (document.getElementById('coCelebrantsToggle').classList.contains('active')) {
    coCelebrants = getCoCelebrantsValue() || t('notSpecified');
  }
  const sermon      = document.getElementById('sermon').value || t('notSpecified');
  const scripture   = getScriptureText(t('notSpecified'));
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString(
    lang === 'ml' ? 'ml-IN' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );
  const { totalMale, totalFemale } = getFormTotals();

  let text = t('serviceDetails') + ' - ' + formattedDate + '\n\n'
    + t('parish')    + ': ' + parishName + '\n'
    + t('celebrant') + ': ' + celebrant  + '\n';
  if (coCelebrants && coCelebrants !== t('notSpecified') && coCelebrants !== '') {
    text += t('coCelebrantsLabel') + ': ' + coCelebrants + '\n';
  }
  text += t('sermon')    + ': ' + sermon    + '\n'
    + t('scripture') + ': ' + scripture + '\n\n'
    + t('attendanceSummary') + ':\n'
    + '• ' + t('male')             + ': ' + totalMale   + '\n'
    + '• ' + t('female')           + ': ' + totalFemale + '\n'
    + '• ' + t('totalAttendanceFull') + ': ' + (totalMale + totalFemale);
  return text;
}

// ── Export functions ──────────────────────────────────────────────────────────

export function exportData() {
  const text = buildReportText();
  navigator.clipboard.writeText(text)
    .then(() => {
      showSuccessMsg(t('copiedToClipboard'), 3000);
      triggerHaptic('success');
    })
    .catch(() => {
      alert('Copy this text:\n\n' + text);
      triggerHaptic('error');
    });
}

export function shareToWhatsApp() {
  const text = buildReportText();
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  triggerHaptic('success');
}

// jsPDF is vendored locally and lazy-loaded on first use so it works
// offline (the service worker precaches it) without slowing page load.
let _jspdfLoader = null;

function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  if (!_jspdfLoader) {
    _jspdfLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './vendor/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        _jspdfLoader = null; // allow retry
        reject(new Error('jsPDF failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return _jspdfLoader;
}

export async function exportPDF() {
  try {
    await loadJsPDF();
  } catch {
    alert('PDF library failed to load. Please refresh the page and try again.');
    triggerHaptic('error');
    return;
  }
  const lang        = getCurrentLang();
  const date        = document.getElementById('date').value;
  const parishName  = document.getElementById('parishName').value || t('notSpecified');
  const celebrant   = document.getElementById('celebrant').value  || t('notSpecified');
  let coCelebrants  = '';
  if (document.getElementById('coCelebrantsToggle').classList.contains('active')) {
    coCelebrants = getCoCelebrantsValue() || t('notSpecified');
  }
  const sermon      = document.getElementById('sermon').value || t('notSpecified');
  const scripture   = getScriptureText(t('notSpecified'));
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString(
    lang === 'ml' ? 'ml-IN' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );
  const { totalMale, totalFemale } = getFormTotals();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text(lang === 'ml' ? 'മാർത്തോമ്മാ പള്ളി' : '⛪ MarThoma Church', 105, 20, { align: 'center' });
  doc.setFontSize(16);
  doc.text(t('serviceDetails'), 105, 30, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(20, 35, 190, 35);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(t('serviceDetails'), 20, 45);
  doc.setFont(undefined, 'normal');

  let y = 55;
  doc.text(t('dateLabel')   + ': ' + formattedDate, 20, y); y += 8;
  doc.text(t('parish')      + ': ' + parishName,    20, y); y += 8;
  doc.text(t('celebrant')   + ': ' + celebrant,     20, y);
  if (coCelebrants && coCelebrants !== t('notSpecified') && coCelebrants !== '') {
    y += 8;
    doc.text(t('coCelebrantsLabel') + ': ' + coCelebrants, 20, y);
  }
  y += 8; doc.text(t('sermon')    + ': ' + sermon,    20, y);
  y += 8; doc.text(t('scripture') + ': ' + scripture, 20, y);
  y += 13;

  doc.setFont(undefined, 'bold');
  doc.text(t('attendanceSummary'), 20, y); y += 10;
  doc.setFont(undefined, 'normal');
  doc.text(t('male')   + ': ' + totalMale,   20, y); y += 8;
  doc.text(t('female') + ': ' + totalFemale, 20, y); y += 12;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(14);
  doc.text(t('totalAttendanceFull') + ': ' + (totalMale + totalFemale), 20, y);

  doc.setFontSize(8);
  doc.setFont(undefined, 'italic');
  doc.text('Generated by MTC Counter App', 105, 280, { align: 'center' });
  doc.text(new Date().toLocaleString(),     105, 285, { align: 'center' });
  doc.save('MTC_Attendance_' + date + '.pdf');

  showSuccessMsg(t('pdfDownloaded'), 3000);
  triggerHaptic('success');
}

export function exportCSV() {
  const history = getHistory();
  if (history.length === 0) { alert(t('noDataForStats')); return; }

  const headers = ['Date','Parish','Celebrant','Co-Celebrants','Sermon','Scripture','Male','Female','Total'];
  const rows = history.map(r => [
    r.date,
    '"' + (r.parishName   || '').replace(/"/g, '""') + '"',
    '"' + (r.celebrant    || '').replace(/"/g, '""') + '"',
    '"' + (r.coCelebrants || '').replace(/"/g, '""') + '"',
    '"' + (r.sermon       || '').replace(/"/g, '""') + '"',
    '"' + (r.scripture    || '').replace(/"/g, '""') + '"',
    r.male, r.female, r.total
  ].join(','));

  _download(
    [headers.join(','), ...rows].join('\n'),
    'text/csv;charset=utf-8;',
    'MTC_Attendance_' + new Date().toISOString().slice(0, 10) + '.csv'
  );
  showSuccessMsg(t('csvExported'));
  triggerHaptic('success');
}

export function exportBackupJSON() {
  const backup = {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    app:        'MTC Counter',
    data: {
      mtcHistory:       getHistory(),
      savedCelebrants:  load(KEYS.celebrants, []),
      savedParishes:    load(KEYS.parishes, [])
    }
  };
  _download(JSON.stringify(backup, null, 2), 'application/json',
    'MTC_Backup_' + new Date().toISOString().slice(0, 10) + '.json');
  showSuccessMsg(t('backupSuccess'));
  triggerHaptic('success');
}

export function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup?.data || backup.app !== 'MTC Counter') {
        alert(t('restoreError')); triggerHaptic('error'); return;
      }
      if (!confirm(t('confirmRestore'))) { event.target.value = ''; return; }

      if (backup.data.mtcHistory)      save(KEYS.history,    backup.data.mtcHistory);
      if (backup.data.savedCelebrants) save(KEYS.celebrants, backup.data.savedCelebrants);
      if (backup.data.savedParishes)   save(KEYS.parishes,   backup.data.savedParishes);

      displayHistory();
      updateCelebrantDatalist();
      updateParishDatalist();
      showSuccessMsg(t('restoreSuccess'));
      triggerHaptic('success');
    } catch {
      alert(t('restoreError')); triggerHaptic('error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function _download(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
