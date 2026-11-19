import { save, load, KEYS } from './state.js';
import { t, getCurrentLang, translations } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg, showErrorMsg, csvCell } from './utils.js';
import { sanitizeBackup, LIMITS } from './sanitize.js';
import { withUndo } from './undo.js';
import { getMale, getFemale, getRounds } from './counter.js';
import { getCoCelebrantsValue } from './celebrants.js';
import { getHistory, saveHistory, displayHistory } from './history.js';
import { updateCelebrantDatalist } from './celebrants.js';
import { updateParishDatalist } from './parishes.js';
import { getCurrentOffertory, offertorySummary, offertoryColumnLabel,
         buildOffertoryReport, drawOffertorySheet, OFFERTORY_LABEL_KEYS } from './offertory.js';

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

// Same total as the screen and the saved record: every round plus whatever
// is on the counters and not yet added to a round.
function getFormTotals() {
  let totalMale   = getMale();
  let totalFemale = getFemale();
  getRounds().forEach(r => { totalMale += r.male; totalFemale += r.female; });
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
  const service     = (document.getElementById('service')?.value || '').trim();

  let text = t('serviceDetails') + ' - ' + formattedDate + (service ? ' (' + service + ')' : '') + '\n\n'
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

  // The offertory, when one was counted: each column's total and the total.
  const offertory = getCurrentOffertory();
  if (offertory) {
    const sum = offertorySummary(offertory);
    text += '\n\n' + t('offertoryTitle') + ':\n'
      + sum.columns.map(c => '• ' + (c.label || offertoryColumnLabel(c.column)) + ': ' + c.amount).join('\n')
      + '\n• ' + t('offertoryTotal') + ': ' + sum.total;
  }
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
      // Clipboard unavailable: a dialog is the only way to show the text
      // so it can be copied by hand.
      alert('Copy this text:\n\n' + text);
      triggerHaptic('error');
    });
}

export function shareToWhatsApp() {
  const text = buildReportText();
  // noopener: the opened page gets no handle back to this app's window.
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  triggerHaptic('success');
}

// jsPDF is vendored locally and lazy-loaded on first use so it works
// offline (the service worker precaches it) without slowing page load.
let _jspdfLoader = null;

export function loadJsPDF() {
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
    showErrorMsg(t('pdfLoadFailed'));
    triggerHaptic('error');
    return;
  }
  // English throughout: the PDF fonts cannot draw Malayalam (or emoji).
  const en          = key => translations.en[key];
  const date        = document.getElementById('date').value;
  const parishName  = document.getElementById('parishName').value || en('notSpecified');
  const celebrant   = document.getElementById('celebrant').value  || en('notSpecified');
  let coCelebrants  = '';
  if (document.getElementById('coCelebrantsToggle').classList.contains('active')) {
    coCelebrants = getCoCelebrantsValue() || en('notSpecified');
  }
  const sermon      = document.getElementById('sermon').value || en('notSpecified');
  const scripture   = getScriptureText(en('notSpecified'));
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString(
    'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );
  const { totalMale, totalFemale } = getFormTotals();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  // Plain Latin text only: the PDF fonts cannot draw emoji or Malayalam.
  doc.text('MarThoma Church', 105, 20, { align: 'center' });
  doc.setFontSize(16);
  doc.text(en('serviceDetails'), 105, 30, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(20, 35, 190, 35);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(en('serviceDetails'), 20, 45);
  doc.setFont(undefined, 'normal');

  let y = 55;
  doc.text(en('dateLabel')   + ': ' + formattedDate, 20, y); y += 8;
  const service = (document.getElementById('service')?.value || '').trim();
  if (service) { doc.text(en('service') + ': ' + service, 20, y); y += 8; }
  doc.text(en('parish')      + ': ' + parishName,    20, y); y += 8;
  doc.text(en('celebrant')   + ': ' + celebrant,     20, y);
  if (coCelebrants && coCelebrants !== en('notSpecified') && coCelebrants !== '') {
    y += 8;
    doc.text(en('coCelebrantsLabel') + ': ' + coCelebrants, 20, y);
  }
  y += 8; doc.text(en('sermon')    + ': ' + sermon,    20, y);
  y += 8; doc.text(en('scripture') + ': ' + scripture, 20, y);
  y += 13;

  doc.setFont(undefined, 'bold');
  doc.text(en('attendanceSummary'), 20, y); y += 10;
  doc.setFont(undefined, 'normal');
  doc.text(en('male')   + ': ' + totalMale,   20, y); y += 8;
  doc.text(en('female') + ': ' + totalFemale, 20, y); y += 12;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(14);
  doc.text(en('totalAttendanceFull') + ': ' + (totalMale + totalFemale), 20, y);

  // Offertory, when one was counted: totals here, the full sheet on page 2.
  const offertory = getCurrentOffertory();
  if (offertory) {
    const sum = offertorySummary(offertory);
    const colName = c => c.label || en(OFFERTORY_LABEL_KEYS[c.column]);
    y += 16;
    doc.setFontSize(12);
    doc.text('Offertory Summary', 20, y); y += 10;
    doc.setFont(undefined, 'normal');
    for (const c of sum.columns) { doc.text(colName(c) + ': ' + c.amount, 20, y); y += 8; }
    y += 4;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text('Total Offertory: ' + sum.total, 20, y); y += 8;
    doc.setFont(undefined, 'italic');
    doc.setFontSize(10);
    doc.splitTextToSize('(' + sum.words + ')', 170).slice(0, 2).forEach(line => { doc.text(line, 20, y); y += 5; });
    y += 3;
    doc.setFontSize(9);
    doc.text('The counting sheet is on the next page.', 20, y);
  }

  doc.setFontSize(8);
  doc.setFont(undefined, 'italic');
  doc.text('Generated by MTC Counter App', 105, 280, { align: 'center' });
  doc.text(new Date().toLocaleString(),     105, 285, { align: 'center' });
  if (offertory) {
    doc.addPage('a4', 'landscape');
    drawOffertorySheet(doc, buildOffertoryReport(offertory,
      { date, parish: document.getElementById('parishName').value.trim() }));
  }
  doc.save('MTC_Attendance_' + date + '.pdf');

  showSuccessMsg(t('pdfDownloaded'), 3000);
  triggerHaptic('success');
}

export function exportCSV() {
  const history = getHistory();
  if (history.length === 0) { showErrorMsg(t('noDataForStats')); return; }

  const headers = ['Date','Service','Parish','Celebrant','Co-Celebrants','Sermon','Scripture','Male','Female','Total'];
  const rows = history.map(r => [
    csvCell(r.date), csvCell(r.service), csvCell(r.parishName), csvCell(r.celebrant),
    csvCell(r.coCelebrants), csvCell(r.sermon), csvCell(r.scripture),
    Number(r.male) || 0, Number(r.female) || 0, Number(r.total) || 0
  ].join(','));

  _download(
    [headers.join(','), ...rows].join('\n'),
    'text/csv;charset=utf-8;',
    'MTC_Attendance_' + new Date().toISOString().slice(0, 10) + '.csv'
  );
  showSuccessMsg(t('csvExported'));
  triggerHaptic('success');
}

/** The backup document — shared by the file export and cloud backup. */
export function buildBackupPayload() {
  return {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    app:        'MTC Counter',
    data: {
      mtcHistory:       getHistory(),
      savedCelebrants:  load(KEYS.celebrants, []),
      savedParishes:    load(KEYS.parishes, [])
    }
  };
}

export function exportBackupJSON() {
  const backup = buildBackupPayload();
  _download(JSON.stringify(backup, null, 2), 'application/json',
    'MTC_Backup_' + new Date().toISOString().slice(0, 10) + '.json');
  showSuccessMsg(t('backupSuccess'));
  triggerHaptic('success');
}

export function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fail = () => { showErrorMsg(t('restoreError')); triggerHaptic('error'); event.target.value = ''; };
  // A real backup is a few hundred KB at most; refuse anything huge unread.
  if (file.size > LIMITS.fileBytes) { fail(); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      // Nothing in the file is trusted: it is rebuilt field by field.
      const clean = sanitizeBackup(JSON.parse(e.target.result));
      const empty = !clean || (!clean.hasHistory && !clean.hasCelebrants && !clean.hasParishes);
      // A file whose records are all unusable must not wipe the real ones.
      if (empty || (clean.hasHistory && clean.history.length === 0 && clean.rejected > 0)) { fail(); return; }
      // Replaces all records; Undo puts the previous data back.
      withUndo(t('restoreSuccess'), () => {
        if (clean.hasHistory)    save(KEYS.history,    clean.history);
        if (clean.hasCelebrants) save(KEYS.celebrants, clean.celebrants);
        if (clean.hasParishes)   save(KEYS.parishes,   clean.parishes);
        displayHistory();
        updateCelebrantDatalist();
        updateParishDatalist();
        document.dispatchEvent(new CustomEvent('mtc:data-changed'));
      });
      triggerHaptic('success');
    } catch {
      showErrorMsg(t('restoreError')); triggerHaptic('error');
    }
    event.target.value = '';
  };
  reader.onerror = fail;
  reader.readAsText(file);
}

/** Trigger a browser download of text content (shared with stats export). */
export function downloadFile(content, mimeType, filename) {
  return _download(content, mimeType, filename);
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
