import { t, getCurrentLang } from './translations.js';
import { getHistory } from './history.js';
import { downloadFile } from './export.js';
import { showSuccessMsg, escapeHtml } from './utils.js';
import { triggerHaptic } from './haptic.js';

// ── Period state ──────────────────────────────────────────────────────────────
// 'month' | 'year' | 'all'. The cursor is the first day of the selected
// month/year (ignored for 'all').

let _period = 'month';
let _cursor = _startOfMonth(new Date());

function _startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function _pad(n) { return String(n).padStart(2, '0'); }
function _locale() { return getCurrentLang() === 'ml' ? 'ml-IN' : 'en-US'; }

/** Records whose date falls in the current period, oldest first. */
function _recordsInPeriod(history) {
  let prefix = '';
  if (_period === 'month') prefix = _cursor.getFullYear() + '-' + _pad(_cursor.getMonth() + 1);
  else if (_period === 'year') prefix = String(_cursor.getFullYear());
  return history
    .filter(r => r && r.date && (!prefix || r.date.startsWith(prefix)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function _periodLabel() {
  if (_period === 'all') return t('statsAllTime');
  if (_period === 'year') return String(_cursor.getFullYear());
  return _cursor.toLocaleDateString(_locale(), { month: 'long', year: 'numeric' });
}

function _periodSlug() {
  if (_period === 'all') return 'all';
  if (_period === 'year') return String(_cursor.getFullYear());
  return _cursor.getFullYear() + '-' + _pad(_cursor.getMonth() + 1);
}

// ── Public controls (wired to window by main.js) ──────────────────────────────

export function setStatsPeriod(period) {
  _period = period;
  const now = new Date();
  _cursor = period === 'year' ? new Date(now.getFullYear(), 0, 1) : _startOfMonth(now);
  displayStats();
  triggerHaptic('light');
}

export function shiftStatsPeriod(delta) {
  if (_period === 'month') _cursor = new Date(_cursor.getFullYear(), _cursor.getMonth() + delta, 1);
  else if (_period === 'year') _cursor = new Date(_cursor.getFullYear() + delta, 0, 1);
  displayStats();
  triggerHaptic('light');
}

export function exportStatsCSV() {
  const records = _recordsInPeriod(getHistory());
  if (records.length === 0) { alert(t('statsNoRecordsPeriod')); return; }
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

// ── Rendering ─────────────────────────────────────────────────────────────────

function statCard(icon, value, label, sub, extraClass = '') {
  return '<div class="stat-card' + (extraClass ? ' ' + extraClass : '') + '">'
    + '<div class="stat-icon">'   + icon  + '</div>'
    + '<div class="stat-value">'  + value + '</div>'
    + '<div class="stat-label">'  + label + '</div>'
    + (sub ? '<div class="stat-sub">' + sub + '</div>' : '')
    + '</div>';
}

function _controlsHtml() {
  const seg = (p, key) =>
    '<button class="stats-seg' + (_period === p ? ' active' : '') + '" onclick="setStatsPeriod(\'' + p + '\')">' + t(key) + '</button>';
  const nav = _period === 'all' ? '' :
    '<div class="stats-nav">'
    + '<button class="stats-nav-btn" onclick="shiftStatsPeriod(-1)" aria-label="Previous">‹</button>'
    + '<span class="stats-period-label">' + escapeHtml(_periodLabel()) + '</span>'
    + '<button class="stats-nav-btn" onclick="shiftStatsPeriod(1)" aria-label="Next">›</button>'
    + '</div>';
  return '<div class="stats-controls">'
    + '<div class="stats-segments">' + seg('month', 'statsPeriodMonth') + seg('year', 'statsPeriodYear') + seg('all', 'statsPeriodAll') + '</div>'
    + nav
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
      const key = y + '-' + _pad(i + 1);
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
    contentEl.innerHTML = '<div class="stats-empty">📊<br><br>' + t('noDataForStats') + '</div>';
    return;
  }

  const records = _recordsInPeriod(history);
  let html = '<div class="stats-section-title">' + t('statsTitle') + '</div>' + _controlsHtml();

  if (records.length === 0) {
    contentEl.innerHTML = html + '<div class="stats-empty">' + t('statsNoRecordsPeriod') + '</div>';
    return;
  }

  const totals  = records.map(r => Number(r.total)  || 0);
  const males   = records.map(r => Number(r.male)   || 0);
  const females = records.map(r => Number(r.female) || 0);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const sumTotal = sum(totals), sumMale = sum(males), sumFemale = sum(females);
  const n = records.length;
  const maxTotal = Math.max(...totals), minTotal = Math.min(...totals);
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString(_locale(), { month: 'short', day: 'numeric', year: 'numeric' });

  html += '<div class="stats-grid">'
    + statCard('🙏', sumTotal, t('statsTotalCommunicants'), t('male') + ': ' + sumMale + ' · ' + t('female') + ': ' + sumFemale, 'full-width')
    + statCard('⛪', n, t('totalServices'), '')
    + statCard('👥', Math.round(sumTotal / n), t('avgAttendance'), t('male') + ': ' + Math.round(sumMale / n) + ' · ' + t('female') + ': ' + Math.round(sumFemale / n))
    + statCard('📈', maxTotal, t('highestService'), fmtDate(records[totals.indexOf(maxTotal)].date))
    + statCard('📉', minTotal, t('lowestService'), fmtDate(records[totals.indexOf(minTotal)].date))
    + '</div>'
    + _chartHtml(records)
    + '<button class="stats-export-btn" onclick="exportStatsCSV()">' + t('statsExportCsv') + ' · ' + escapeHtml(_periodLabel()) + '</button>';

  contentEl.innerHTML = html;
}
