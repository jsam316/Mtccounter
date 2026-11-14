// Offertory counting sheet: amounts, totals, words and the PDF contents.
// The sample is the church's own filled-in form of 10 November 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUnits, denominations, splitAmount, formatAmount, formatMoney, normalizeOffertory, offertorySheet,
  isOffertoryEmpty, numberToWords, amountInWords, currencyDecimals, minorUnitName, guessCurrency,
  formDate, buildOffertoryReport, CURRENCIES, COLUMNS,
} from '../src/offertory.js';
import { translations } from '../src/translations.js';

const sample = normalizeOffertory({
  currency: 'KWD', venue: 'NECK - Hall of Peace', specialLabel: 'Family Day',
  counts: {
    offertory: { '10': 2, '1': 36, '0.500': 23, '0.250': 18, '0.100': 1, '0.050': 2 },
    birthday: { '5': 2 },
    wedding: { '10': 4 },
    special: { '20': 2, '10': 6 },
  },
});

test('KWD notes and coins match the paper form', () => {
  assert.deepEqual(denominations('KWD').map(d => d.label),
    ['20', '10', '5', '1', '0.500', '0.250', '0.100', '0.050', '0.020', '0.010', '0.005']);
  assert.equal(denominations('KWD')[4].minor, 500);
  assert.equal(minorUnitName('KWD'), 'fils');
});

test('every currency has sensible, descending denominations', () => {
  for (const [code] of CURRENCIES) {
    const d = denominations(code);
    assert.ok(d.length >= 9 && d.length <= 14, code + ' has ' + d.length);
    for (let i = 1; i < d.length; i++) assert.ok(d[i].minor < d[i - 1].minor, code + ' order');
    assert.ok(d.every(x => Number.isInteger(x.minor) && x.minor > 0), code + ' whole minor units');
    assert.equal(new Set(d.map(x => x.key)).size, d.length, code + ' unique');
    assert.ok(minorUnitName(code).length > 0);
  }
  assert.equal(currencyDecimals('INR'), 2);
  for (const c of ['KWD', 'BHD', 'OMR']) assert.equal(currencyDecimals(c), 3, c);
});

test('column totals and the Total column match the filled-in form', () => {
  const s = offertorySheet(sample);
  assert.equal(formatAmount(s.columnTotals.offertory, 'KWD'), '72.200');
  assert.equal(formatAmount(s.columnTotals.birthday, 'KWD'), '10.000');
  assert.equal(formatAmount(s.columnTotals.wedding, 'KWD'), '40.000');
  assert.equal(formatAmount(s.columnTotals.special, 'KWD'), '100.000');
  assert.equal(formatAmount(s.columnTotals.total, 'KWD'), '222.200');
  const row = key => s.rows.find(r => r.key === key).cells;
  assert.deepEqual(row('10').total, { units: 12, amount: 120000 });
  assert.deepEqual(row('20').total, { units: 2, amount: 40000 });
  assert.deepEqual(row('0.500').offertory, { units: 23, amount: 11500 });
  assert.deepEqual(row('0.250').total, { units: 18, amount: 4500 });
  assert.deepEqual(row('0.005').total, { units: 0, amount: 0 });
});

test('amounts split into the form\'s two cells', () => {
  assert.deepEqual(splitAmount(11500, 'KWD'), { major: '11', minor: '500' });
  assert.deepEqual(splitAmount(100, 'KWD'), { major: '0', minor: '100' });
  assert.deepEqual(splitAmount(125050, 'INR'), { major: '1250', minor: '50' });
  assert.equal(formatAmount(125050, 'INR'), '1,250.50');
  assert.equal(formatMoney(12500000, 'INR'), '₹1,25,000.00');
  assert.match(formatMoney(222200, 'KWD'), /222\.200/);
});

test('unit counts: whole numbers only', () => {
  assert.equal(parseUnits('36'), 36);
  assert.equal(parseUnits(''), 0);
  assert.equal(parseUnits(' 2 '), 2);
  for (const bad of ['2.5', '-1', 'x', '1e3', '123456']) assert.equal(parseUnits(bad), null, bad);
});

test('amount in words', () => {
  assert.equal(amountInWords(222200, 'KWD'), 'Two hundred and twenty-two Kuwaiti Dinars and 200/1000 fils');
  assert.equal(amountInWords(1000, 'KWD'), 'One Kuwaiti Dinar only');
  assert.equal(amountInWords(125050, 'INR'), 'One thousand two hundred and fifty Indian Rupees and 50/100 paise');
  assert.equal(amountInWords(500, 'KWD'), 'Zero Kuwaiti Dinars and 500/1000 fils');
  assert.equal(numberToWords(0), 'zero');
  assert.equal(numberToWords(19), 'nineteen');
  assert.equal(numberToWords(40), 'forty');
  assert.equal(numberToWords(101), 'one hundred and one');
  assert.equal(numberToWords(1005), 'one thousand and five');
  assert.equal(numberToWords(12345), 'twelve thousand three hundred and forty-five');
  assert.equal(numberToWords(2000000), 'two million');
});

test('bad stored data is cleaned up, not trusted', () => {
  const o = normalizeOffertory({
    currency: 'XXX', venue: 7,
    counts: { offertory: { '20': '3', '7': 5, '10': -2, '5': 'abc', '1': 2.9 }, bogus: { '20': 1 } },
  }, 'KWD');
  assert.equal(o.currency, 'KWD');
  assert.equal(o.venue, '7');
  assert.deepEqual(o.counts.offertory, { '20': 3, '1': 2 }); // unknown coin, negative and text dropped
  assert.deepEqual(Object.keys(o.counts), [...COLUMNS]);
  assert.ok(isOffertoryEmpty(normalizeOffertory(null)));
  assert.ok(isOffertoryEmpty(normalizeOffertory({ venue: 'Hall' })));
  assert.ok(!isOffertoryEmpty(sample));
});

test('changing currency keeps counts only for notes and coins both have', () => {
  const inr = normalizeOffertory({ ...sample, currency: 'INR' }, 'INR');
  assert.deepEqual(inr.counts.offertory, { '10': 2, '1': 36 }); // no half or quarter in INR
  assert.deepEqual(inr.counts.special, { '20': 2, '10': 6 });
});

test('starting currency follows the phone region', () => {
  assert.equal(guessCurrency('en-KW'), 'KWD');
  assert.equal(guessCurrency('en-US'), 'USD');
  assert.equal(guessCurrency('ml-IN'), 'INR');
  assert.equal(guessCurrency('en'), 'KWD');
});

test('PDF contents reproduce the form', () => {
  const r = buildOffertoryReport(sample, { date: '2026-11-10', parish: 'St. Thomas Mar Thoma Church - Kuwait' });
  assert.equal(r.church, 'ST. THOMAS MAR THOMA CHURCH - KUWAIT');
  assert.equal(r.date, '10 November 2026');
  assert.equal(formDate('2026-11-10'), '10 November 2026');
  assert.equal(r.venue, 'NECK - Hall of Peace');
  assert.deepEqual(r.columns, ['OFFERTORY', 'BIRTHDAY', 'WEDDING', 'FAMILY DAY', 'TOTAL']);
  assert.deepEqual(r.subheads, ['UNIT', 'KWD', 'FILS']);
  assert.equal(r.rows.length, 11);
  const ten = r.rows[1];
  assert.equal(ten.label, '10');
  assert.deepEqual(ten.cells, [
    { unit: '2', major: '20', minor: '000' },
    { unit: '', major: '', minor: '' },
    { unit: '4', major: '40', minor: '000' },
    { unit: '6', major: '60', minor: '000' },
    { unit: '12', major: '120', minor: '000' },
  ]);
  assert.deepEqual(r.rows[4].cells[0], { unit: '23', major: '11', minor: '500' });
  assert.deepEqual(r.rows[6].cells[4], { unit: '1', major: '0', minor: '100' });
  assert.equal(r.totalLabel, 'TOTAL KWD');
  assert.deepEqual(r.totals.map(x => x.major + '.' + x.minor), ['72.200', '10.000', '40.000', '100.000', '222.200']);
  assert.equal(r.wordsLabel, '(Amount in words) Kuwaiti Dinar :');
  assert.equal(r.words, 'Two hundred and twenty-two Kuwaiti Dinars and 200/1000 fils');
  // Defaults when the parish and special name are blank
  const plain = buildOffertoryReport(normalizeOffertory({ currency: 'INR', counts: { offertory: { '500': 1 } } }));
  assert.equal(plain.church, 'MAR THOMA CHURCH');
  assert.equal(plain.columns[3], 'SPECIAL');
  assert.deepEqual(plain.subheads, ['UNIT', 'INR', 'PAISE']);
  assert.deepEqual(plain.totals[1], { major: '', minor: '' }); // empty column left blank
});

test('offertory strings exist in both languages', () => {
  const keys = Object.keys(translations.en).filter(k => k.startsWith('offertory'));
  assert.ok(keys.length >= 15);
  for (const k of keys) assert.ok(translations.ml[k], 'missing Malayalam: ' + k);
});
