import { t, getCurrentLang, translations } from './translations.js';
import { getHistory } from './history.js';
import { downloadFile, loadJsPDF } from './export.js';
import { showSuccessMsg, showErrorMsg, escapeHtml, isNotSpecified } from './utils.js';
import { triggerHaptic } from './haptic.js';
import { getString, setString } from './state.js';
import { icon } from './icons.js';

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Date prefix for a period: 'YYYY-MM' (month), 'YYYY' (year), '' (all). */
export function periodPrefix(period, cursor) {
  if (period === 'month') return cursor.getFullYear() + '-' + pad(cursor.getMonth() + 1);
  if (period === 'year') return String(cursor.getFullYear());
  return '';
}

/** Records in the period and parish ('' = all parishes), oldest first. */
export function filterRecords(history, { period, cursor, parish = '' }) {
  const prefix = periodPrefix(period, cursor);
  return history
    .filter(r => r && r.date && (!prefix || r.date.startsWith(prefix)))
    .filter(r => !parish || (r.parishName || '') === parish)
    .sort(byDate);
}

/** Totals, averages, highest and lowest service for a set of records. */
export function summarize(records) {
  const num = v => Number(v) || 0;
  const n = records.length;
  const total = records.reduce((s, r) => s + num(r.total), 0);
  const male = records.reduce((s, r) => s + num(r.male), 0);
  const female = records.reduce((s, r) => s + num(r.female), 0);
  let maxRecord = null, minRecord = null;
  for (const r of records) {
    if (!maxRecord || num(r.total) > num(maxRecord.total)) maxRecord = r;
    if (!minRecord || num(r.total) < num(minRecord.total)) minRecord = r;
  }
  return {
    n, total, male, female,
    avg: n ? Math.round(total / n) : 0,
    avgMale: n ? Math.round(male / n) : 0,
    avgFemale: n ? Math.round(female / n) : 0,
    maxRecord, minRecord,
  };
}

/** Whole-percent change from prev to cur; null when there's nothing to compare with. */
export function percentChange(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/**
 * Periods to compare against: the previous month and the same month last
 * year (month view), or the previous year (year view). None for all time.
 */
export function comparisonPeriods(period, cursor) {
  if (period === 'month') {
    return [
      { kind: 'prev', period, cursor: new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1) },
      { kind: 'lastYear', period, cursor: new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1) },
    ];
  }
  if (period === 'year') return [{ kind: 'prev', period, cursor: new Date(cursor.getFullYear() - 1, 0, 1) }];
  return [];
}

/** Distinct parish names found in the records, sorted. */
export function parishOptions(history) {
  const names = new Set();
  for (const r of history) if (r && r.parishName && !isNotSpecified(r.parishName)) names.add(r.parishName);
  return [...names].sort((a, b) => a.localeCompare(b));
}

// ── View state ────────────────────────────────────────────────────────────────

const PARISH_KEY = 'mtcStatsParish';
let _period = 'month';
let _cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let _parish = null; // loaded lazily from storage

function _locale(lang = getCurrentLang()) { return lang === 'ml' ? 'ml-IN' : 'en-US'; }

function _currentParish(history) {
  if (_parish === null) {
    try { _parish = getString(PARISH_KEY) || ''; } catch { _parish = ''; }
  }
  if (_parish && !parishOptions(history).includes(_parish)) _parish = '';
  return _parish;
}

function _periodLabel(period = _period, cursor = _cursor, lang = getCurrentLang(), long = true) {
  if (period === 'all') return lang === 'en' ? translations.en.statsAllTime : t('statsAllTime');
  if (period === 'year') return String(cursor.getFullYear());
  return cursor.toLocaleDateString(_locale(lang), { month: long ? 'long' : 'short', year: 'numeric' });
}

/** Short label for a comparison period, e.g. "Sep", "Oct 2025", "2025". */
function _compareLabel(c) {
  if (c.period === 'year') return String(c.cursor.getFullYear());
  return c.cursor.toLocaleDateString(_locale(), c.kind === 'prev' ? { month: 'short' } : { month: 'short', year: 'numeric' });
}

function _periodSlug() {
  const p = periodPrefix(_period, _cursor) || 'all';
  return p + (_parish ? '_' + _parish.replace(/[^\w-]+/g, '-') : '');
}

function _selection(history) {
  return { period: _period, cursor: _cursor, parish: _currentParish(history) };
}

// ── Public controls (wired to window by main.js) ──────────────────────────────

export function setStatsPeriod(period) {
  _period = period;
  const now = new Date();
  _cursor = period === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  displayStats();
  triggerHaptic('light');
}

export function shiftStatsPeriod(delta) {
  if (_period === 'month') _cursor = new Date(_cursor.getFullYear(), _cursor.getMonth() + delta, 1);
  else if (_period === 'year') _cursor = new Date(_cursor.getFullYear() + delta, 0, 1);
  displayStats();
  triggerHaptic('light');
}

export function setStatsParish(parish) {
  _parish = parish || '';
  try { setString(PARISH_KEY, _parish); } catch { /* best-effort */ }
  displayStats();
  triggerHaptic('light');
}

function _periodRecordsOrWarn() {
  const history = getHistory();
  const records = filterRecords(history, _selection(history));
  if (records.length === 0) { showErrorMsg(t('statsNoRecordsPeriod')); return null; }
  return records;
}

export function exportStatsCSV() {
  const records = _periodRecordsOrWarn();
  if (!records) return;
  const headers = ['Date', 'Service', 'Parish', 'Celebrant', 'Co-Celebrants', 'Sermon', 'Scripture', 'Male', 'Female', 'Total'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = records.map(r => [
    r.date, q(r.service), q(r.parishName), q(r.celebrant), q(r.coCelebrants), q(r.sermon), q(r.scripture),
    Number(r.male) || 0, Number(r.female) || 0, Number(r.total) || 0,
  ].join(','));
  downloadFile([headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;',
    'MTC_Attendance_' + _periodSlug() + '.csv');
  showSuccessMsg(t('csvExported'));
  triggerHaptic('success');
}

// ── Report (shared text and PDF) ──────────────────────────────────────────────

/**
 * Plain-text report for the selected period and parish, in the current
 * language. Month: every service. Year: totals by month. All time: by year.
 */
export function buildStatsReport(history, sel, lang = getCurrentLang()) {
  const tr = k => (translations[lang] && translations[lang][k]) || translations.en[k] || k;
  const locale = _locale(lang);
  const records = filterRecords(history, sel);
  const s = summarize(records);
  const fmt = (d, opts) => new Date(d + 'T00:00:00').toLocaleDateString(locale, opts);
  const lines = [];

  lines.push(tr('statsReportTitle') + ' — ' + _periodLabel(sel.period, sel.cursor, lang));
  lines.push(tr('parish') + ': ' + (sel.parish || (parishOptions(records).length === 1 ? parishOptions(records)[0] : tr('statsAllParishes'))));
  lines.push('');
  lines.push(tr('totalServices') + ': ' + s.n);
  lines.push(tr('statsTotalCommunicants') + ': ' + s.total + ' (' + tr('male') + ' ' + s.male + ' · ' + tr('female') + ' ' + s.female + ')');
  if (s.n) {
    lines.push(tr('statsAveragePerService') + ': ' + s.avg);
    lines.push(tr('highestService') + ': ' + (Number(s.maxRecord.total) || 0) + ' — ' + fmt(s.maxRecord.date, { weekday: 'short', day: 'numeric', month: 'short' }));
    lines.push(tr('lowestService') + ': ' + (Number(s.minRecord.total) || 0) + ' — ' + fmt(s.minRecord.date, { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  for (const c of comparisonPeriods(sel.period, sel.cursor)) {
    const prev = summarize(filterRecords(history, { ...sel, period: c.period, cursor: c.cursor }));
    const pc = percentChange(s.avg, prev.avg);
    if (pc !== null) lines.push(tr('statsAveragePerService') + ' ' + tr('statsCompareVs').replace('{label}', _periodLabel(c.period, c.cursor, lang)) + ': ' + (pc > 0 ? '+' : '') + pc + '%');
  }

  if (s.n) {
    lines.push('');
    if (sel.period === 'month') {
      lines.push(tr('statsReportServices') + ':');
      for (const r of records) {
        lines.push('• ' + fmt(r.date, { weekday: 'short', day: 'numeric', month: 'short' })
          + (r.service ? ' · ' + r.service : '')
          + (!sel.parish && r.parishName ? ' · ' + r.parishName : '')
          + ' — ' + (Number(r.total) || 0)
          + ' (' + tr('male') + ' ' + (Number(r.male) || 0) + ' · ' + tr('female') + ' ' + (Number(r.female) || 0) + ')');
      }
    } else {
      lines.push(tr(sel.period === 'year' ? 'statsReportByMonth' : 'statsReportByYear') + ':');
      const groups = new Map();
      for (const r of records) {
        const key = sel.period === 'year' ? r.date.slice(0, 7) : r.date.slice(0, 4);
        const g = groups.get(key) || { total: 0, n: 0 };
        g.total += Number(r.total) || 0; g.n += 1;
        groups.set(key, g);
      }
      for (const [key, g] of [...groups].sort()) {
        const label = sel.period === 'year'
          ? new Date(key + '-01T00:00:00').toLocaleDateString(locale, { month: 'long' })
          : key;
        lines.push('• ' + label + ': ' + g.total + ' (' + g.n + ' ' + tr('statsServicesWord') + ')');
      }
    }
  }
  lines.push('');
  lines.push('— MTC Counter');
  return lines.join('\n');
}

/** Share the report (phone share sheet, or WhatsApp where sharing isn't available). */
export async function shareStatsReport() {
  if (!_periodRecordsOrWarn()) return;
  const text = buildStatsReport(getHistory(), _selection(getHistory()));
  triggerHaptic('success');
  if (navigator.share) {
    try { await navigator.share({ title: t('statsReportTitle'), text }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; /* fall back to WhatsApp */ }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

/**
 * PDF version of the report. Written in English: the PDF library's built-in
 * fonts can't draw Malayalam script.
 */
export async function exportStatsPDF() {
  const records = _periodRecordsOrWarn();
  if (!records) return;
  try { await loadJsPDF(); } catch { showErrorMsg(t('pdfLoadFailed')); triggerHaptic('error'); return; }

  const history = getHistory();
  const sel = _selection(history);
  const en = k => translations.en[k];
  const s = summarize(records);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  let y = 20;
  const line = (txt, x = 20, size = 11, style = 'normal') => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.setFontSize(size); doc.setFont(undefined, style); doc.text(String(txt), x, y);
  };

  doc.setFontSize(18); doc.setFont(undefined, 'bold');
  y = 20; doc.text('MarThoma Church - ' + en('statsReportTitle'), 105, y, { align: 'center' });
  y += 9; doc.setFontSize(13); doc.text(_periodLabel(sel.period, sel.cursor, 'en'), 105, y, { align: 'center' });
  y += 7; doc.setFontSize(11); doc.setFont(undefined, 'normal');
  doc.text(en('parish') + ': ' + (sel.parish || (parishOptions(records).length === 1 ? parishOptions(records)[0] : en('statsAllParishes'))), 105, y, { align: 'center' });
  y += 5; doc.setLineWidth(0.4); doc.line(20, y, 190, y); y += 10;

  const summary = [
    [en('totalServices'), s.n],
    [en('statsTotalCommunicants'), s.total + '  (Male ' + s.male + ' / Female ' + s.female + ')'],
    [en('statsAveragePerService'), s.avg + '  (Male ' + s.avgMale + ' / Female ' + s.avgFemale + ')'],
    [en('highestService'), (Number(s.maxRecord.total) || 0) + '  -  ' + fmt(s.maxRecord.date)],
    [en('lowestService'), (Number(s.minRecord.total) || 0) + '  -  ' + fmt(s.minRecord.date)],
  ];
  for (const c of comparisonPeriods(sel.period, sel.cursor)) {
    const prev = summarize(filterRecords(history, { ...sel, period: c.period, cursor: c.cursor }));
    const pc = percentChange(s.avg, prev.avg);
    if (pc !== null) summary.push(['Average ' + en('statsCompareVs').replace('{label}', _periodLabel(c.period, c.cursor, 'en')), (pc > 0 ? '+' : '') + pc + '%']);
  }
  for (const [k, v] of summary) {
    line(k + ':', 20, 11, 'bold'); line(String(v), 80, 11, 'normal'); y += 7;
  }

  // Table of services
  y += 6;
  const showParish = !sel.parish && parishOptions(records).length > 1;
  const cols = showParish
    ? [['Date', 20], ['Service', 62], ['Parish', 92], ['Celebrant', 128], ['M', 166], ['F', 176], ['Total', 186]]
    : [['Date', 20], ['Service', 62], ['Celebrant', 100], ['Male', 156], ['Female', 168], ['Total', 186]];
  const header = () => {
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    for (const [h, x] of cols) doc.text(h, x, y, h.length <= 6 && x > 150 ? { align: 'right' } : undefined);
    y += 2; doc.line(20, y, 190, y); y += 6; doc.setFont(undefined, 'normal');
  };
  header();
  const clip = (txt, n) => (txt.length > n ? txt.slice(0, n - 1) + '…' : txt);
  for (const r of records) {
    if (y > 280) { doc.addPage(); y = 20; header(); }
    const cells = showParish
      ? [fmt(r.date), clip(r.service || '', 14), clip(r.parishName || '', 16), clip(r.celebrant || '', 18), r.male || 0, r.female || 0, r.total || 0]
      : [fmt(r.date), clip(r.service || '', 16), clip(r.celebrant || '', 26), r.male || 0, r.female || 0, r.total || 0];
    cells.forEach((c, i) => {
      const [, x] = cols[i];
      doc.text(String(c), x, y, typeof c === 'number' ? { align: 'right' } : undefined);
    });
    y += 6;
  }

  doc.setFontSize(8); doc.setFont(undefined, 'italic');
  doc.text('Generated by MTC Counter · ' + new Date().toLocaleString('en-US'), 105, 290, { align: 'center' });
  doc.save('MTC_Report_' + _periodSlug() + '.pdf');
  showSuccessMsg(t('pdfDownloaded'), 3000);
  triggerHaptic('success');
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function statCard(iconName, value, label, sub, extraClass = '', extraHtml = '') {
  return '<div class="stat-card' + (extraClass ? ' ' + extraClass : '') + '">'
    + '<div class="stat-icon">'   + icon(iconName) + '</div>'
    + '<div class="stat-value">'  + value + '</div>'
    + '<div class="stat-label">'  + label + '</div>'
    + (sub ? '<div class="stat-sub">' + sub + '</div>' : '')
    + extraHtml
    + '</div>';
}

/**
 * "▲ 12% vs Sep" lines, one per comparison period with data. Compares the
 * average per service: totals would mislead whenever the periods have a
 * different number of services, e.g. the current month part-way through.
 */
function _compareHtml(history, sel, metric, current) {
  let html = '';
  for (const c of comparisonPeriods(sel.period, sel.cursor)) {
    const prev = summarize(filterRecords(history, { ...sel, period: c.period, cursor: c.cursor }))[metric];
    const pc = percentChange(current, prev);
    if (pc === null) continue;
    const cls = pc > 0 ? 'up' : pc < 0 ? 'down' : 'same';
    const arrow = pc > 0 ? '▲' : pc < 0 ? '▼' : '=';
    html += '<div class="stat-compare ' + cls + '">' + arrow + ' ' + Math.abs(pc) + '% '
      + escapeHtml(t('statsCompareVs').replace('{label}', _compareLabel(c))) + '</div>';
  }
  return html;
}

function _controlsHtml(history) {
  const seg = (p, key) =>
    '<button class="stats-seg' + (_period === p ? ' active' : '') + '" onclick="setStatsPeriod(\'' + p + '\')">' + t(key) + '</button>';
  const nav = _period === 'all' ? '' :
    '<div class="stats-nav">'
    + '<button class="stats-nav-btn" onclick="shiftStatsPeriod(-1)" aria-label="Previous">' + icon('chevronL') + '</button>'
    + '<span class="stats-period-label">' + escapeHtml(_periodLabel()) + '</span>'
    + '<button class="stats-nav-btn" onclick="shiftStatsPeriod(1)" aria-label="Next">' + icon('chevronR') + '</button>'
    + '</div>';
  const parishes = parishOptions(history);
  const current = _currentParish(history);
  const parishPicker = parishes.length < 2 ? '' :
    '<select class="stats-parish" aria-label="' + escapeHtml(t('parish')) + '" onchange="setStatsParish(this.value)">'
    + '<option value="">' + escapeHtml(t('statsAllParishes')) + '</option>'
    + parishes.map(p => '<option value="' + escapeHtml(p) + '"' + (p === current ? ' selected' : '') + '>' + escapeHtml(p) + '</option>').join('')
    + '</select>';
  return '<div class="stats-controls">'
    + '<div class="stats-segments">' + seg('month', 'statsPeriodMonth') + seg('year', 'statsPeriodYear') + seg('all', 'statsPeriodAll') + '</div>'
    + nav
    + parishPicker
    + '</div>';
}

/** Bars for the chart: per service (month), per month (year), per year (all). */
function _chartGroups(records) {
  if (_period === 'month') {
    return records.map(r => ({
      label: new Date(r.date + 'T00:00:00').toLocaleDateString(_locale(), { day: 'numeric', month: 'short' })
        + (r.service ? ' ' + r.service : ''),
      value: Number(r.total) || 0,
    }));
  }
  const sums = new Map();
  for (const r of records) {
    const key = _period === 'year' ? r.date.slice(0, 7) : r.date.slice(0, 4);
    sums.set(key, (sums.get(key) || 0) + (Number(r.total) || 0));
  }
  if (_period === 'year') {
    // Always show all 12 months so gaps are visible.
    const y = _cursor.getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const key = y + '-' + pad(i + 1);
      return {
        label: new Date(y, i, 1).toLocaleDateString(_locale(), { month: 'short' }),
        value: sums.get(key) || 0,
      };
    });
  }
  return [...sums.keys()].sort().map(k => ({ label: k, value: sums.get(k) }));
}

function _chartHtml(records) {
  const groups = _chartGroups(records);
  if (groups.length === 0) return '';
  const max = Math.max(...groups.map(g => g.value), 0);
  const title = _period === 'month' ? t('statsChartMonth') : _period === 'year' ? t('statsChartYear') : t('statsChartAll');
  let html = '<div class="trend-section"><div class="trend-title">' + title + '</div><div class="trend-bars">';
  for (const g of groups) {
    const px = max > 0 ? Math.max(g.value > 0 ? 4 : 2, Math.round((g.value / max) * 60)) : 2;
    html += '<div class="trend-bar-wrap">'
      + '<div class="trend-bar-val">' + (g.value || '') + '</div>'
      + '<div class="trend-bar-inner"><div class="trend-bar" style="height:' + px + 'px"></div></div>'
      + '<div class="trend-bar-label">' + escapeHtml(g.label) + '</div>'
      + '</div>';
  }
  return html + '</div></div>';
}

export function displayStats() {
  const contentEl = document.getElementById('statsContent');
  const history = getHistory();

  if (history.length === 0) {
    contentEl.innerHTML = '<div class="stats-empty"><div class="empty-icon">' + icon('chart') + '</div>' + t('noDataForStats') + '</div>';
    return;
  }

  const sel = _selection(history);
  const records = filterRecords(history, sel);
  let html = '<div class="stats-section-title">' + t('statsTitle') + '</div>' + _controlsHtml(history);

  if (records.length === 0) {
    contentEl.innerHTML = html + '<div class="stats-empty">' + t('statsNoRecordsPeriod') + '</div>';
    return;
  }

  const s = summarize(records);
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString(_locale(), { month: 'short', day: 'numeric', year: 'numeric' });

  html += '<div class="stats-grid">'
    + statCard('users', s.total, t('statsTotalCommunicants'), t('male') + ': ' + s.male + ' · ' + t('female') + ': ' + s.female, 'full-width')
    + statCard('church', s.n, t('totalServices'), '')
    + statCard('activity', s.avg, t('avgAttendance'), t('male') + ': ' + s.avgMale + ' · ' + t('female') + ': ' + s.avgFemale, '',
        _compareHtml(history, sel, 'avg', s.avg))
    + statCard('trendUp', Number(s.maxRecord.total) || 0, t('highestService'), fmtDate(s.maxRecord.date))
    + statCard('trendDown', Number(s.minRecord.total) || 0, t('lowestService'), fmtDate(s.minRecord.date))
    + '</div>'
    + _chartHtml(records)
    + '<div class="stats-actions">'
    +   '<button class="stats-action-btn stats-share-btn" onclick="shareStatsReport()">' + icon('share') + '<span>' + t('statsShare') + '</span></button>'
    +   '<button class="stats-action-btn stats-pdf-btn" onclick="exportStatsPDF()">' + icon('fileDown') + '<span>' + t('statsPdf') + '</span></button>'
    +   '<button class="stats-action-btn stats-export-btn" onclick="exportStatsCSV()">' + icon('table') + '<span>' + t('statsCsvShort') + '</span></button>'
    + '</div>';

  contentEl.innerHTML = html;
}
