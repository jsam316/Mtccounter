// Offertory counting sheet for the service being recorded, laid out like the
// church's paper form: one row per note or coin, and for each of Offertory,
// Birthday, Wedding and Special the number of units counted. The amounts,
// column totals, the Total column and the amount in words are worked out
// from the counts.
//
// The counts live in localStorage while the service is being recorded (so
// they survive the tab being closed), are saved with the record, and can be
// exported as a PDF in the form's layout.
//
// All money maths is done in whole minor units (fils, paise, cents) so
// totals are exact.

import { save, load, KEYS, getString, setString } from './state.js';
import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg, showErrorMsg, escapeHtml } from './utils.js';
import { withUndo } from './undo.js';

// code → name, plural (for the amount in words), minor unit, notes and coins.
// The KWD list is the church's own form; the others are the notes and coins
// in general use.
const CURRENCY_DATA = {
  KWD: ['Kuwaiti Dinar', 'Kuwaiti Dinars', 'fils', [20, 10, 5, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005]],
  INR: ['Indian Rupee', 'Indian Rupees', 'paise', [500, 200, 100, 50, 20, 10, 5, 2, 1]],
  USD: ['US Dollar', 'US Dollars', 'cents', [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01]],
  GBP: ['British Pound', 'British Pounds', 'pence', [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]],
  EUR: ['Euro', 'Euros', 'cents', [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]],
  AED: ['UAE Dirham', 'UAE Dirhams', 'fils', [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.5, 0.25]],
  SAR: ['Saudi Riyal', 'Saudi Riyals', 'halalas', [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05]],
  QAR: ['Qatari Riyal', 'Qatari Riyals', 'dirhams', [500, 200, 100, 50, 10, 5, 1, 0.5, 0.25]],
  BHD: ['Bahraini Dinar', 'Bahraini Dinars', 'fils', [20, 10, 5, 1, 0.5, 0.1, 0.05, 0.025, 0.01, 0.005]],
  OMR: ['Omani Rial', 'Omani Rials', 'baisa', [50, 20, 10, 5, 1, 0.5, 0.1, 0.05, 0.025, 0.01, 0.005]],
  CAD: ['Canadian Dollar', 'Canadian Dollars', 'cents', [100, 50, 20, 10, 5, 2, 1, 0.25, 0.1, 0.05]],
  AUD: ['Australian Dollar', 'Australian Dollars', 'cents', [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05]],
  NZD: ['New Zealand Dollar', 'New Zealand Dollars', 'cents', [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1]],
  SGD: ['Singapore Dollar', 'Singapore Dollars', 'cents', [100, 50, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05]],
  MYR: ['Malaysian Ringgit', 'Malaysian Ringgit', 'sen', [100, 50, 20, 10, 5, 1, 0.5, 0.2, 0.1, 0.05]],
  ZAR: ['South African Rand', 'South African Rand', 'cents', [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1]],
  CHF: ['Swiss Franc', 'Swiss Francs', 'rappen', [1000, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05]],
};

export const CURRENCIES = Object.freeze(Object.keys(CURRENCY_DATA).map(code => [code, CURRENCY_DATA[code][0]]));
/**
 * The columns that are counted. The first four are the paper form's; Family
 * Day and Upakoshanam are extra ones, printed only when something was counted
 * in them so an ordinary week's sheet still looks like the form.
 */
export const COLUMNS = Object.freeze(['offertory', 'birthday', 'wedding', 'special', 'familyDay', 'upakoshanam']);
const EXTRA_COLUMNS = Object.freeze(['familyDay', 'upakoshanam']);
export const OFFERTORY_LABEL_KEYS = Object.freeze({
  offertory: 'offertoryColOffertory', birthday: 'offertoryBirthday', wedding: 'offertoryWedding',
  special: 'offertorySpecial', familyDay: 'offertoryFamilyDay', upakoshanam: 'offertoryUpakoshanam',
  total: 'offertoryColTotal',
});
const COLUMN_LABEL = OFFERTORY_LABEL_KEYS;
const COLUMN_PDF = {
  offertory: 'OFFERTORY', birthday: 'BIRTHDAY', wedding: 'WEDDING', special: 'SPECIAL',
  familyDay: 'FAMILY DAY', upakoshanam: 'UPAKOSHANAM', total: 'TOTAL',
};
const MAX_UNITS = 99999;

const isCurrency = code => Object.prototype.hasOwnProperty.call(CURRENCY_DATA, code);

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

/** Decimal places a currency uses: 2 for most, 3 for KWD/BHD/OMR. */
export function currencyDecimals(code) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

export function minorUnitName(code) { return CURRENCY_DATA[code][2]; }

/** Notes and coins of a currency, largest first: key/label as printed, value in minor units. */
export function denominations(code) {
  const d = currencyDecimals(code);
  return CURRENCY_DATA[code][3].map(v => {
    const label = Number.isInteger(v) ? String(v) : v.toFixed(d);
    return { key: label, label, minor: Math.round(v * 10 ** d) };
  });
}

/** Minor units → { major: "11", minor: "500" }, the form's two amount cells. */
export function splitAmount(minorUnits, code) {
  const d = currencyDecimals(code);
  const f = 10 ** d;
  return { major: String(Math.floor(minorUnits / f)), minor: String(minorUnits % f).padStart(d, '0') };
}

/** Minor units → "11.500". */
export function formatAmount(minorUnits, code) {
  const { major, minor } = splitAmount(minorUnits, code);
  return Number(major).toLocaleString('en-US') + '.' + minor;
}

/** "KWD 222.200" / "₹1,250.00" for the screen. */
export function formatMoney(minorUnits, code) {
  const amount = minorUnits / 10 ** currencyDecimals(code);
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: code }).format(amount);
  } catch {
    return code + ' ' + formatAmount(minorUnits, code);
  }
}

/** A typed unit count: digits only; anything else is null. */
export function parseUnits(text) {
  const s = String(text ?? '').trim();
  if (s === '') return 0;
  if (!/^\d{1,5}$/.test(s)) return null;
  return Number(s);
}

/** Make stored or imported offertory data safe to use. */
export function normalizeOffertory(raw, fallbackCurrency = 'KWD') {
  const currency = raw && isCurrency(raw.currency) ? raw.currency : fallbackCurrency;
  const keys = denominations(currency).map(d => d.key);
  const counts = {};
  for (const col of COLUMNS) {
    counts[col] = {};
    const src = raw?.counts?.[col] || {};
    for (const key of keys) {
      const n = Math.floor(Number(src[key]));
      if (Number.isFinite(n) && n > 0) counts[col][key] = Math.min(n, MAX_UNITS);
    }
  }
  const text = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    currency, venue: text(raw?.venue, 80), specialLabel: text(raw?.specialLabel, 30), counts,
    signatures: [0, 1].map(i => normalizeSignature(raw?.signatures?.[i])),
  };
}

// A signature is the pen strokes drawn on screen, not a picture: each stroke
// is a flat list x1,y1,x2,y2,… of whole numbers from 0 to SIGN_GRID across a
// box SIGN_ASPECT times as wide as it is tall. That is small to store and
// stays sharp at any size, on screen and in the PDF.
export const SIGN_GRID = 1000;
export const SIGN_ASPECT = 3;
const MAX_STROKES = 150;
const MAX_STROKE_NUMBERS = 4000;

/** Make a stored or imported signature safe to use. */
export function normalizeSignature(raw) {
  const clamp = n => Math.min(SIGN_GRID, Math.max(0, Math.round(Number(n)) || 0));
  const strokes = (Array.isArray(raw?.strokes) ? raw.strokes : [])
    .filter(Array.isArray)
    .map(s => s.slice(0, MAX_STROKE_NUMBERS))
    .map(s => (s.length % 2 ? s.slice(0, -1) : s).map(clamp)) // whole x,y pairs only
    .filter(s => s.length >= 2)
    .slice(0, MAX_STROKES);
  return { name: String(raw?.name ?? '').trim().slice(0, 60), strokes };
}

/** True once at least one of the two people has signed. */
export function isSigned(off) {
  return !!off?.signatures?.some(s => s.strokes.length > 0);
}

/**
 * The whole sheet worked out: for every denomination the units and amount in
 * each column and in Total, plus each column's total (all in minor units).
 */
export function offertorySheet(off) {
  const columnTotals = { total: 0 };
  for (const col of COLUMNS) columnTotals[col] = 0;
  const rows = denominations(off.currency).map(d => {
    const cells = {};
    let units = 0;
    for (const col of COLUMNS) {
      const n = off.counts[col][d.key] || 0;
      cells[col] = { units: n, amount: n * d.minor };
      columnTotals[col] += n * d.minor;
      units += n;
    }
    cells.total = { units, amount: units * d.minor };
    columnTotals.total += units * d.minor;
    return { key: d.key, label: d.label, cells };
  });
  return { rows, columnTotals };
}

export function isOffertoryEmpty(off) {
  return !off || COLUMNS.every(col => Object.keys(off.counts?.[col] || {}).length === 0);
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 222 → "two hundred and twenty-two" (whole numbers below a trillion). */
export function numberToWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberToWords(n % 100) : '');
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= size) {
      const rest = n % size;
      return numberToWords(Math.floor(n / size)) + ' ' + name
        + (rest ? (rest < 100 ? ' and ' : ' ') + numberToWords(rest) : '');
    }
  }
  return String(n);
}

/** "Two hundred and twenty-two Kuwaiti Dinars and 200/1000 fils", as written on the form. */
export function amountInWords(minorUnits, code) {
  const [single, plural, minorName] = CURRENCY_DATA[code];
  const f = 10 ** currencyDecimals(code);
  const major = Math.floor(minorUnits / f);
  const minor = minorUnits % f;
  const words = numberToWords(major);
  return words.charAt(0).toUpperCase() + words.slice(1) + ' ' + (major === 1 ? single : plural)
    + (minor ? ' and ' + minor + '/' + f + ' ' + minorName : ' only');
}

/** Starting currency from the phone's region; KWD (the form's) when unsure. */
export function guessCurrency(locale) {
  const region = (String(locale || '').split(/[-_]/)[1] || '').toUpperCase();
  const map = {
    KW: 'KWD', IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SA: 'SAR', QA: 'QAR', BH: 'BHD', OM: 'OMR',
    CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', MY: 'MYR', ZA: 'ZAR', CH: 'CHF',
    DE: 'EUR', FR: 'EUR', IE: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', AT: 'EUR', BE: 'EUR',
  };
  return map[region] || 'KWD';
}

/** "10 November 2026", the way the form's date is written. */
export function formDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The form's four columns, plus an extra column only when it has a count. */
export function printedColumns(off, sheet = offertorySheet(off)) {
  return COLUMNS.filter(col => !EXTRA_COLUMNS.includes(col) || sheet.columnTotals[col] > 0);
}

/**
 * Everything the PDF prints, in the paper form's layout. English only: the
 * PDF fonts cannot draw Malayalam.
 */
export function buildOffertoryReport(off, details = {}) {
  const sheet = offertorySheet(off);
  const cols = [...printedColumns(off, sheet), 'total'];
  const cell = c => c.units === 0 ? { unit: '', major: '', minor: '' } : { unit: String(c.units), ...splitAmount(c.amount, off.currency) };
  return {
    church: (details.parish || 'Mar Thoma Church').toUpperCase(),
    date: details.date ? formDate(details.date) : '',
    venue: off.venue,
    columns: cols.map(c => c === 'special' && off.specialLabel ? off.specialLabel.toUpperCase() : COLUMN_PDF[c]),
    subheads: ['UNIT', off.currency, minorUnitName(off.currency).toUpperCase()],
    rows: sheet.rows.map(r => ({ label: r.label, cells: cols.map(c => cell(r.cells[c])) })),
    totalLabel: 'TOTAL ' + off.currency,
    totals: cols.map(c => sheet.columnTotals[c] === 0 && c !== 'total' ? { major: '', minor: '' } : splitAmount(sheet.columnTotals[c], off.currency)),
    wordsLabel: '(Amount in words) ' + CURRENCY_DATA[off.currency][0] + ' :',
    words: amountInWords(sheet.columnTotals.total, off.currency),
    signatures: (off.signatures || []).map(s => ({ name: s.name, strokes: s.strokes })),
  };
}

/**
 * Column totals for the service exports (text, WhatsApp, service PDF), as
 * plain "KWD 72.200" text. `label` is set only for a renamed Special column.
 */
export function offertorySummary(off) {
  const sheet = offertorySheet(off);
  const { columnTotals } = sheet;
  const money = minor => off.currency + ' ' + formatAmount(minor, off.currency);
  return {
    currency: off.currency,
    venue: off.venue,
    columns: printedColumns(off, sheet).map(col => ({
      column: col,
      label: col === 'special' ? off.specialLabel : '',
      amount: money(columnTotals[col]),
    })),
    total: money(columnTotals.total),
    words: amountInWords(columnTotals.total, off.currency),
  };
}

// ── State ─────────────────────────────────────────────────────────────────────

let _off = normalizeOffertory(null);
let _tab = 'offertory'; // which column is on screen: one of COLUMNS, or 'total'

function _preferredCurrency() {
  const saved = getString(KEYS.currency);
  return isCurrency(saved) ? saved : guessCurrency(typeof navigator !== 'undefined' ? navigator.language : '');
}

function _persist() {
  try { save(KEYS.offertory, _off); } catch { /* keep working */ }
}

/** The offertory to store on a saved record, or null when nothing was counted. */
export function getOffertoryForRecord() {
  if (isOffertoryEmpty(_off)) return null;
  const total = offertorySheet(_off).columnTotals.total;
  return { ...JSON.parse(JSON.stringify(_off)), totalMinor: total, total: total / 10 ** currencyDecimals(_off.currency) };
}

export function hasOffertory() { return !isOffertoryEmpty(_off); }

/** A copy of the sheet being counted, or null when nothing was counted. */
export function getCurrentOffertory() {
  return isOffertoryEmpty(_off) ? null : JSON.parse(JSON.stringify(_off));
}

/** Translated name of a column key, for the text exports. */
export function offertoryColumnLabel(col) { return t(COLUMN_LABEL[col]); }

/** Show a saved record's offertory (or none) in the form. */
export function setOffertoryFromRecord(recordOffertory) {
  _off = normalizeOffertory(recordOffertory || { venue: _off.venue }, _preferredCurrency());
  _persist();
  renderOffertory();
}

/** Empty the sheet for a new service; the currency and venue stay. */
export function clearOffertory() {
  _off = normalizeOffertory({ venue: _off.venue }, _preferredCurrency());
  _persist();
  renderOffertory();
}

/** Read the in-progress offertory back from storage (start-up and Undo). */
export function loadOffertory() {
  _off = normalizeOffertory(load(KEYS.offertory, null), _preferredCurrency());
  renderOffertory();
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function setOffertoryCurrency(code) {
  if (!isCurrency(code) || code === _off.currency) return;
  const apply = () => {
    // Counts carry over for notes and coins the new currency also has.
    _off = normalizeOffertory({ ..._off, currency: code }, code);
    try { setString(KEYS.currency, code); } catch { /* keep working */ }
    _persist();
    renderOffertory();
  };
  const kept = new Set(denominations(code).map(d => d.key));
  const loses = COLUMNS.some(col => Object.keys(_off.counts[col]).some(k => !kept.has(k)));
  if (loses) withUndo(t('offertoryCurrencyChanged'), apply); else apply();
  triggerHaptic('light');
}

export function setOffertoryTab(tab) {
  if (tab !== 'total' && !COLUMNS.includes(tab)) return;
  _tab = tab;
  _renderRows();
  triggerHaptic('light');
}

function _onUnitsInput(e) {
  const input = e.target.closest('.off-units');
  if (!input || _tab === 'total' || isSigned(_off)) return;
  const key = input.closest('.off-row').dataset.key;
  const units = parseUnits(input.value);
  input.classList.toggle('input-invalid', units === null);
  if (units === null) return;
  if (units > 0) _off.counts[_tab][key] = units; else delete _off.counts[_tab][key];
  _persist();
  _updateComputed();
}

function _onTextInput(e) {
  if (isSigned(_off)) return;
  if (e.target.id === 'offVenue') _off.venue = e.target.value.trim().slice(0, 80);
  else if (e.target.id === 'offSpecialName') { _off.specialLabel = e.target.value.trim().slice(0, 30); _renderTabs(); }
  else return;
  _persist();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function _columnLabel(col) {
  return col === 'special' && _off.specialLabel ? _off.specialLabel : t(COLUMN_LABEL[col]);
}

function _renderTabs() {
  document.getElementById('offTabs').innerHTML = [...COLUMNS, 'total'].map(col =>
    '<button type="button" class="stats-seg' + (col === _tab ? ' active' : '') + '" aria-pressed="' + (col === _tab)
    + '" onclick="setOffertoryTab(\'' + col + '\')">' + escapeHtml(_columnLabel(col)) + '</button>').join('');
}

/** The denomination rows for the column on screen (inputs, or read-only for Total). */
function _renderRows() {
  _renderTabs();
  const sheet = offertorySheet(_off);
  const readOnly = _tab === 'total';
  const locked = isSigned(_off) ? ' disabled' : '';
  document.getElementById('offRows').innerHTML =
    '<div class="off-row off-row-head"><span>' + t('offertoryDenomination') + '</span><span>'
    + t('offertoryUnit') + '</span><span>' + _off.currency + '</span></div>'
    + sheet.rows.map(r => {
      const c = r.cells[_tab];
      return '<div class="off-row" data-key="' + r.key + '">'
        + '<span class="off-denom">' + r.label + '</span><span class="off-x">×</span>'
        + (readOnly
          ? '<span class="off-units-total">' + (c.units || '–') + '</span>'
          : '<input class="off-units" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="0"'
            + ' autocomplete="off"' + locked + ' value="' + (c.units || '') + '" aria-label="' + r.label + ' × ' + escapeHtml(t('offertoryUnit')) + '">')
        + '<span class="off-row-amount"></span></div>';
    }).join('')
    + '<div class="off-row off-row-foot"><span>' + escapeHtml(_columnLabel(_tab)) + ' ' + _off.currency + '</span>'
    + '<span class="off-col-total"></span></div>';
  _updateComputed();
}

/** Refresh everything worked out from the counts, without touching the inputs. */
function _updateComputed() {
  const sheet = offertorySheet(_off);
  const code = _off.currency;
  document.querySelectorAll('#offRows .off-row[data-key]').forEach((rowEl, i) => {
    const c = sheet.rows[i].cells[_tab];
    rowEl.querySelector('.off-row-amount').textContent = c.units ? formatAmount(c.amount, code) : '–';
    rowEl.classList.toggle('has-units', c.units > 0);
    if (_tab === 'total') rowEl.querySelector('.off-units-total').textContent = c.units || '–';
  });
  document.querySelector('#offRows .off-col-total').textContent = formatAmount(sheet.columnTotals[_tab], code);

  const row = (label, minor, cls = '') =>
    '<div class="off-total-row' + cls + '"><span>' + escapeHtml(label) + '</span><span>' + formatAmount(minor, code) + '</span></div>';
  const empty = isOffertoryEmpty(_off);
  document.getElementById('offTotals').innerHTML =
    COLUMNS.map(col => row(_columnLabel(col), sheet.columnTotals[col])).join('')
    + row(t('offertoryTotal') + ' ' + code, sheet.columnTotals.total, ' off-grand')
    + (empty ? '' : '<div class="off-words"><span>' + t('offertoryInWords') + '</span>'
        + escapeHtml(amountInWords(sheet.columnTotals.total, code)) + '</div>');

  const recap = document.getElementById('offertorySummary');
  recap.textContent = empty ? t('offertoryTapToAdd') : formatMoney(sheet.columnTotals.total, code);
  recap.classList.toggle('is-empty', empty);
}

export function renderOffertory() {
  const select = document.getElementById('offCurrency');
  if (!select) return;
  if (!select.options.length) {
    select.innerHTML = CURRENCIES.map(([code, name]) =>
      '<option value="' + code + '">' + code + ' – ' + name + '</option>').join('');
  }
  select.value = _off.currency;
  document.getElementById('offVenue').value = _off.venue;
  document.getElementById('offSpecialName').value = _off.specialLabel;
  _renderRows();
  _renderSignatures();
}

// ── Signatures ────────────────────────────────────────────────────────────────

const INK = '#1e293b';

/** Draw one signature's strokes on its pad (always dark ink on white, like paper). */
function _paintPad(canvas, strokes) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(1.5, w / 190);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    const X = i => (s[i] / SIGN_GRID) * w, Y = i => (s[i + 1] / SIGN_GRID) * h;
    if (s.length === 2) { ctx.beginPath(); ctx.arc(X(0), Y(0), ctx.lineWidth * 0.7, 0, 6.3); ctx.fill(); continue; }
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    for (let i = 2; i < s.length; i += 2) ctx.lineTo(X(i), Y(i));
    ctx.stroke();
  }
}

/** Show the stored signatures and names, and lock the sheet's fields while signed. */
function _renderSignatures() {
  const signed = isSigned(_off);
  document.querySelectorAll('.off-sign-box').forEach(box => {
    const sig = _off.signatures[Number(box.dataset.sig)];
    _paintPad(box.querySelector('.off-sign-pad'), sig.strokes);
    box.classList.toggle('is-signed', sig.strokes.length > 0);
    const name = box.querySelector('.off-sign-name');
    if (document.activeElement !== name) name.value = sig.name;
  });
  for (const id of ['offCurrency', 'offVenue', 'offSpecialName']) document.getElementById(id).disabled = signed;
  document.getElementById('offSignedNote').hidden = !signed;
}

let _pen = null; // the stroke being drawn: { index, canvas, points }

function _penPoint(e, canvas) {
  const r = canvas.getBoundingClientRect();
  const clamp = n => Math.min(SIGN_GRID, Math.max(0, Math.round(n)));
  return [clamp(((e.clientX - r.left) / r.width) * SIGN_GRID), clamp(((e.clientY - r.top) / r.height) * SIGN_GRID)];
}

function _onPenDown(e) {
  const canvas = e.target.closest('.off-sign-pad');
  if (!canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  if (isOffertoryEmpty(_off)) {
    showErrorMsg(t('offertorySignCountFirst'));
    triggerHaptic('error');
    return;
  }
  const index = Number(canvas.closest('.off-sign-box').dataset.sig);
  if (_off.signatures[index].strokes.length >= MAX_STROKES) return;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not supported: still draws */ }
  _pen = { index, canvas, points: _penPoint(e, canvas) };
  _paintPad(canvas, [..._off.signatures[index].strokes, _pen.points]);
}

function _onPenMove(e) {
  if (!_pen) return;
  e.preventDefault();
  const [x, y] = _penPoint(e, _pen.canvas);
  const n = _pen.points.length;
  // Skip tiny movements so a signature stays a few hundred numbers.
  if (Math.abs(x - _pen.points[n - 2]) < 3 && Math.abs(y - _pen.points[n - 1]) < 6) return;
  if (n >= MAX_STROKE_NUMBERS) return;
  _pen.points.push(x, y);
  _paintPad(_pen.canvas, [..._off.signatures[_pen.index].strokes, _pen.points]);
}

function _onPenUp() {
  if (!_pen) return;
  const wasSigned = isSigned(_off);
  _off.signatures[_pen.index].strokes.push(_pen.points);
  _pen = null;
  _persist();
  if (!wasSigned) _renderRows(); // first signature: the counts become read-only
  _renderSignatures();
}

function _onSignNameInput(e) {
  const input = e.target.closest('.off-sign-name');
  if (!input) return;
  _off.signatures[Number(input.closest('.off-sign-box').dataset.sig)].name = input.value.trim().slice(0, 60);
  _persist();
}

/** Remove one person's signature (their name stays); Undo puts it back. */
export function clearSignature(index) {
  if (!_off.signatures[index] || _off.signatures[index].strokes.length === 0) return;
  withUndo(t('offertorySignCleared'), () => {
    _off.signatures[index].strokes = [];
    _persist();
    _renderRows();
    _renderSignatures();
  });
  triggerHaptic('light');
}

export function initOffertory() {
  document.getElementById('offRows').addEventListener('input', _onUnitsInput);
  document.getElementById('offVenue').addEventListener('input', _onTextInput);
  document.getElementById('offSpecialName').addEventListener('input', _onTextInput);
  const sign = document.getElementById('offSign');
  sign.addEventListener('pointerdown', _onPenDown);
  sign.addEventListener('pointermove', _onPenMove);
  sign.addEventListener('pointerup', _onPenUp);
  sign.addEventListener('pointercancel', _onPenUp);
  sign.addEventListener('input', _onSignNameInput);
  // The pads are sized by the page: repaint when the card opens or the width changes.
  document.getElementById('offertoryDetails').addEventListener('toggle', _renderSignatures);
  window.addEventListener('resize', _renderSignatures);
  loadOffertory();
}

// ── PDF (the paper form's layout, landscape) ──────────────────────────────────

/**
 * Draw the counting sheet on the current page of `doc`, which must be
 * landscape A4. `r` comes from buildOffertoryReport(). Also used by the
 * service PDF, which adds the sheet as its second page.
 */
export function drawOffertorySheet(doc, r) {
  const W = 297, LEFT = 15, RIGHT = W - 15;
  const center = (text, x, y) => doc.text(String(text), x, y, { align: 'center' });

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  center(r.church, W / 2, 18);
  doc.setFontSize(8);
  doc.text('OFFERTORY COLLECTION ON', LEFT + 12, 28);
  doc.text('Venue :', 150, 28);
  doc.setLineWidth(0.2);
  doc.line(LEFT + 54, 28.8, 143, 28.8);
  doc.line(163, 28.8, RIGHT - 12, 28.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(r.date, LEFT + 56, 27.6);
  doc.text(doc.splitTextToSize(r.venue, RIGHT - 12 - 165)[0] || '', 165, 27.6);

  // Table geometry: Denomination (value + X), then one group of UNIT | major |
  // minor per column (5 as on the paper form, up to 7 with the extra columns).
  const groups = r.columns.length;
  // Draw centred text, shrinking it when a narrow cell needs it.
  const fit = (text, x, y, width, size) => {
    let s = size;
    doc.setFontSize(s);
    while (s > 5 && doc.getTextWidth(String(text)) > width - 1) { s -= 0.5; doc.setFontSize(s); }
    center(text, x, y);
    doc.setFontSize(size);
  };
  const top = 34, headH = 8, subH = 6.5;
  const rowH = Math.min(7.6, (150 - top - headH - subH) / (r.rows.length + 1));
  const denomW = 22, xW = 11;
  const groupW = (RIGHT - LEFT - denomW - xW) / groups;
  const subW = [groupW * 0.27, groupW * 0.40, groupW * 0.33];
  const groupX = g => LEFT + denomW + xW + g * groupW;
  const subX = (g, s) => groupX(g) + subW.slice(0, s).reduce((a, b) => a + b, 0);
  const bodyTop = top + headH + subH;
  const bottom = bodyTop + rowH * (r.rows.length + 1);

  // Column headings
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  center('Denomination', LEFT + (denomW + xW) / 2, top + 5.4);
  r.columns.forEach((name, g) => fit(name, groupX(g) + groupW / 2, top + 5.4, groupW, 9.5));
  doc.setFont('helvetica', 'normal');
  for (let g = 0; g < groups; g++) {
    r.subheads.forEach((h, s) => fit(h, subX(g, s) + subW[s] / 2, top + headH + 4.4, subW[s], 8));
  }

  // Rows
  doc.setFontSize(10.5);
  r.rows.forEach((row, i) => {
    const y = bodyTop + rowH * i + rowH * 0.68;
    center(row.label, LEFT + denomW / 2, y);
    center('X', LEFT + denomW + xW / 2, y);
    row.cells.forEach((c, g) => {
      doc.setFont('helvetica', g === groups - 1 ? 'bold' : 'normal');
      [c.unit, c.major, c.minor].forEach((text, s) => { if (text !== '') fit(text, subX(g, s) + subW[s] / 2, y, subW[s], 10.5); });
    });
    doc.setFont('helvetica', 'normal');
  });

  // Total row
  const totalY = bodyTop + rowH * r.rows.length + rowH * 0.68;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  center(r.totalLabel, LEFT + (denomW + xW) / 2, totalY);
  r.totals.forEach((tot, g) => {
    if (tot.major === '') return;
    fit(tot.major, subX(g, 1) + subW[1] / 2, totalY, subW[1], 11);
    fit(tot.minor, subX(g, 2) + subW[2] / 2, totalY, subW[2], 11);
  });

  // Grid lines: thick frame and group dividers, thin cell lines
  doc.setLineWidth(0.5);
  doc.rect(LEFT, top, RIGHT - LEFT, bottom - top);
  doc.line(LEFT, top + headH, RIGHT, top + headH);
  doc.line(LEFT, bottom - rowH, RIGHT, bottom - rowH);
  for (let g = 0; g < groups; g++) doc.line(groupX(g), top, groupX(g), bottom);
  doc.setLineWidth(0.2);
  doc.line(LEFT + denomW, bodyTop, LEFT + denomW, bottom - rowH);
  doc.line(LEFT, bodyTop, RIGHT, bodyTop);
  for (let i = 1; i < r.rows.length; i++) doc.line(LEFT, bodyTop + rowH * i, RIGHT, bodyTop + rowH * i);
  for (let g = 0; g < groups; g++) {
    for (let s = 1; s < 3; s++) doc.line(subX(g, s), top + headH, subX(g, s), bottom);
  }

  // Amount in words and signatures
  let y = bottom + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(r.wordsLabel, LEFT + 2, y);
  const wordsX = LEFT + 4 + doc.getTextWidth(r.wordsLabel);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const lines = doc.splitTextToSize(r.words, RIGHT - 12 - wordsX).slice(0, 2);
  lines.forEach((line, i) => {
    doc.text(line, wordsX + 2, y + i * 9 - 0.6);
    doc.line(wordsX, y + i * 9 + 0.8, RIGHT - 12, y + i * 9 + 0.8);
  });
  y += lines.length * 9 + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Signature (1):', LEFT + 2, y);
  doc.line(LEFT + 26, y + 0.8, 125, y + 0.8);
  doc.text('Signature (2):', 160, y);
  doc.line(184, y + 0.8, RIGHT - 12, y + 0.8);

  // Signatures drawn on screen sit on their lines, with the name underneath.
  const signH = 15, signW = signH * SIGN_ASPECT;
  [[LEFT + 26, 125], [184, RIGHT - 12]].forEach(([x1, x2], i) => {
    const sig = r.signatures && r.signatures[i];
    if (!sig) return;
    const left = (x1 + x2) / 2 - signW / 2, topY = y + 0.8 - signH;
    const X = n => left + (n / SIGN_GRID) * signW, Y = n => topY + (n / SIGN_GRID) * signH;
    doc.setLineWidth(0.35);
    doc.setLineCap('round');
    doc.setLineJoin('round');
    for (const s of sig.strokes) {
      if (s.length === 2) { doc.circle(X(s[0]), Y(s[1]), 0.2, 'F'); continue; }
      for (let k = 2; k < s.length; k += 2) doc.line(X(s[k - 2]), Y(s[k - 1]), X(s[k]), Y(s[k + 1]));
    }
    doc.setLineCap('butt');
    doc.setLineJoin('miter');
    if (sig.name) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      center(doc.splitTextToSize(sig.name, x2 - x1)[0], (x1 + x2) / 2, y + 5);
    }
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  center('Generated by MTC Counter App · ' + new Date().toLocaleString(), W / 2, 204);
}

export async function exportOffertoryPDF() {
  if (isOffertoryEmpty(_off)) {
    showErrorMsg(t('offertoryNothing'));
    triggerHaptic('error');
    return;
  }
  try {
    const { loadJsPDF } = await import('./export.js');
    await loadJsPDF();
  } catch {
    showErrorMsg(t('pdfLoadFailed'));
    triggerHaptic('error');
    return;
  }
  const val = id => (document.getElementById(id)?.value || '').trim();
  const date = val('date');
  const r = buildOffertoryReport(_off, { date, parish: val('parishName') });

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawOffertorySheet(doc, r);
  doc.save('MTC_Offertory_' + (date || new Date().toISOString().slice(0, 10)) + '.pdf');

  showSuccessMsg(t('pdfDownloaded'), 3000);
  triggerHaptic('success');
}
