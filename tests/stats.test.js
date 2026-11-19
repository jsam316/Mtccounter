// Stats: period and parish filtering, summaries, comparisons, report text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRecords, summarize, percentChange, comparisonPeriods, parishOptions, buildStatsReport,
  recordOffertory, offertoryCurrencies, summarizeOffertory, offertoryColumnsShown,
} from '../src/stats.js';

const rec = (date, male, female, parishName = 'St. Thomas', service = '') =>
  ({ date, male, female, total: male + female, parishName, service, celebrant: 'Rev. A', timestamp: date + 'T10:00:00Z' });

const history = [
  rec('2026-10-04', 40, 50), rec('2026-10-04', 10, 12, 'St. Thomas', 'Evening'), rec('2026-10-11', 42, 48),
  rec('2026-10-11', 20, 25, 'Ebenezer'),
  rec('2026-09-06', 30, 35), rec('2026-09-13', 31, 36),
  rec('2025-10-05', 35, 40),
  rec('2026-03-01', 25, 30, 'Not specified'),
];
const oct = new Date(2026, 9, 1);

test('filter by month, oldest first', () => {
  const r = filterRecords(history, { period: 'month', cursor: oct });
  assert.deepEqual(r.map(x => x.date), ['2026-10-04', '2026-10-04', '2026-10-11', '2026-10-11']);
});

test('filter by parish', () => {
  const r = filterRecords(history, { period: 'month', cursor: oct, parish: 'St. Thomas' });
  assert.equal(r.length, 3);
  assert.ok(r.every(x => x.parishName === 'St. Thomas'));
});

test('filter by year and all time', () => {
  assert.equal(filterRecords(history, { period: 'year', cursor: new Date(2026, 0, 1) }).length, 7);
  assert.equal(filterRecords(history, { period: 'all', cursor: oct }).length, history.length);
});

test('summary totals, averages, highest and lowest', () => {
  const s = summarize(filterRecords(history, { period: 'month', cursor: oct, parish: 'St. Thomas' }));
  assert.equal(s.n, 3);
  assert.equal(s.total, 90 + 22 + 90);
  assert.equal(s.male, 92);
  assert.equal(s.avg, Math.round(202 / 3));
  assert.equal(s.maxRecord.total, 90);
  assert.equal(s.minRecord.total, 22);
  assert.equal(summarize([]).avg, 0);
});

test('percent change, and nothing to compare with', () => {
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(90, 100), -10);
  assert.equal(percentChange(50, 0), null);
});

test('comparison periods: previous month and same month last year; previous year; none for all time', () => {
  const m = comparisonPeriods('month', oct);
  assert.deepEqual(m.map(c => [c.kind, c.cursor.getFullYear(), c.cursor.getMonth()]), [['prev', 2026, 8], ['lastYear', 2025, 9]]);
  const jan = comparisonPeriods('month', new Date(2026, 0, 1));
  assert.deepEqual([jan[0].cursor.getFullYear(), jan[0].cursor.getMonth()], [2025, 11], 'January compares with December');
  assert.equal(comparisonPeriods('year', new Date(2026, 0, 1))[0].cursor.getFullYear(), 2025);
  assert.deepEqual(comparisonPeriods('all', oct), []);
});

test('parish options: distinct, sorted, skip "Not specified"', () => {
  assert.deepEqual(parishOptions(history), ['Ebenezer', 'St. Thomas']);
});

test('month report lists every service and compares with last month', () => {
  const text = buildStatsReport(history, { period: 'month', cursor: oct, parish: 'St. Thomas' }, 'en');
  assert.match(text, /October 2026/);
  assert.match(text, /Parish: St\. Thomas/);
  assert.match(text, /Total Services: 3/);
  assert.match(text, /Total Communicants: 202 \(Male 92 · Female 110\)/);
  assert.equal((text.match(/^• /gm) || []).length, 3);
  assert.match(text, /Evening/);
  // Average per service: Oct 2026 = round(202 / 3) = 67; Sep 2026 = round(132 / 2) = 66 → +2%
  assert.match(text, /Average per service vs September 2026: \+2%/);
  // Oct 2025 = 75 → (67 - 75) / 75 = -11%
  assert.match(text, /Average per service vs October 2025: -11%/);
});

test('year report groups by month; all-parish report names each parish', () => {
  const year = buildStatsReport(history, { period: 'year', cursor: new Date(2026, 0, 1), parish: '' }, 'en');
  assert.match(year, /By month:/);
  assert.match(year, /• October: 247 \(4 services\)/);
  assert.match(year, /Parish: All parishes/);
  const month = buildStatsReport(history, { period: 'month', cursor: oct, parish: '' }, 'en');
  assert.match(month, /· Ebenezer — 45/);
});

test('report is translated', () => {
  const ml = buildStatsReport(history, { period: 'month', cursor: oct, parish: 'St. Thomas' }, 'ml');
  assert.match(ml, /കുർബ്ബാന \(കൂദാശ\) റിപ്പോർട്ട്/);
});

// ── Offertory analytics ──────────────────────────────────────────────────────

const svc = (date, counts, extra = {}) => ({
  date, service: '', parishName: 'St. Thomas', celebrant: 'Rev. A', male: 40, female: 50, total: 90,
  timestamp: date + 'T10:00:00Z', ...extra,
  ...(counts ? { offertory: { currency: extra.currency || 'KWD', counts } } : {}),
});
const offHistory = [
  // 10 Nov: the church's own sheet, 222.200
  svc('2026-11-10', {
    offertory: { '10': 2, '1': 36, '0.500': 23, '0.250': 18, '0.100': 1, '0.050': 2 },
    birthday: { '5': 2 }, wedding: { '10': 4 }, special: { '20': 2, '10': 6 },
  }),
  svc('2026-11-17', { offertory: { '20': 3, '0.500': 1 }, upakoshanam: { '5': 2 } }),   // 60.500 + 10.000
  svc('2026-11-24', null),                                                              // no offertory counted
  svc('2026-11-29', { offertory: { '500': 4, '100': 5 } }, { currency: 'INR' }),        // INR 2,500.00
  svc('2026-10-06', { offertory: { '20': 5 } }),                                        // October: 100.000
];
const nov = new Date(2026, 10, 1);
const novRecords = filterRecords(offHistory, { period: 'month', cursor: nov, parish: '' });

test('a record\'s offertory is worked out from its counts, not a stored total', () => {
  const o = recordOffertory({ offertory: { currency: 'KWD', total: 999, totalMinor: 999000, counts: { offertory: { '1': 5 } } } });
  assert.deepEqual([o.currency, o.total, o.columns.offertory], ['KWD', 5000, 5000]);
  assert.equal(recordOffertory(svc('2026-11-24', null)), null);
  assert.equal(recordOffertory({ offertory: { currency: 'KWD', counts: {} } }), null);
  assert.equal(recordOffertory({ offertory: 'junk' }), null);
  assert.equal(recordOffertory(null), null);
});

test('offertory totals for a period, one currency at a time', () => {
  assert.deepEqual(offertoryCurrencies(novRecords), [['KWD', 2], ['INR', 1]]);
  const kwd = summarizeOffertory(novRecords, 'KWD');
  assert.equal(kwd.n, 2);                 // the uncounted service and the INR one are left out
  assert.equal(kwd.total, 292700);        // 222.200 + 70.500
  assert.equal(kwd.avg, 146350);
  assert.equal(kwd.columns.offertory, 72200 + 60500);
  assert.equal(kwd.columns.birthday, 10000);
  assert.equal(kwd.columns.wedding, 40000);
  assert.equal(kwd.columns.special, 100000);
  assert.equal(kwd.columns.upakoshanam, 10000);
  assert.equal(kwd.columns.familyDay, 0);
  assert.equal(Object.values(kwd.columns).reduce((a, b) => a + b, 0), kwd.total); // columns add up to the total
  assert.equal(kwd.maxRecord.date, '2026-11-10');
  assert.equal(kwd.max, 222200);
  assert.equal(kwd.minRecord.date, '2026-11-17');
  assert.equal(kwd.min, 70500);

  const inr = summarizeOffertory(novRecords, 'INR');
  assert.deepEqual([inr.n, inr.total, inr.avg], [1, 250000, 250000]);
  // Nothing in that currency
  const none = summarizeOffertory(novRecords, 'USD');
  assert.deepEqual([none.n, none.total, none.avg, none.maxRecord], [0, 0, 0, null]);
});

test('offertory columns listed: the form\'s four always, the extra two only when used', () => {
  assert.deepEqual(offertoryColumnsShown(summarizeOffertory(novRecords, 'KWD')),
    ['offertory', 'birthday', 'wedding', 'special', 'upakoshanam']);
  assert.deepEqual(offertoryColumnsShown(summarizeOffertory(novRecords, 'INR')),
    ['offertory', 'birthday', 'wedding', 'special']);
});

test('offertory comparison uses the average per service', () => {
  const oct = summarizeOffertory(filterRecords(offHistory, { period: 'month', cursor: new Date(2026, 9, 1), parish: '' }), 'KWD');
  assert.equal(oct.avg, 100000);
  assert.equal(percentChange(summarizeOffertory(novRecords, 'KWD').avg, oct.avg), 46); // 146.350 vs 100.000
});

test('the shared report includes the offertory, per currency', () => {
  const text = buildStatsReport(offHistory, { period: 'month', cursor: nov, parish: '' }, 'en');
  assert.ok(text.includes('Offertory (KWD):'), text);
  assert.ok(text.includes('Total offertory: KWD 292.700 (2 services)'), text);
  assert.ok(text.includes('Average per service: KWD 146.350'), text);
  assert.ok(text.includes('• Wedding: KWD 40.000'));
  assert.ok(text.includes('• Upakoshanam: KWD 10.000'));
  assert.ok(!text.includes('Family Day'));
  assert.ok(text.includes('Offertory (INR):') && text.includes('Total offertory: INR 2,500.00 (1 service)'));
  // Each service line carries its own offertory; the uncounted one does not.
  const lines = text.split('\n').filter(l => l.startsWith('• ') && l.includes('Nov'));
  assert.ok(lines.find(l => l.includes('Nov 10')).endsWith('· KWD 222.200'), lines.join(' | '));
  assert.ok(!lines.find(l => l.includes('Nov 24')).includes('KWD'));
  // A period with no offertory has no offertory section.
  const plain = buildStatsReport([svc('2026-11-24', null)], { period: 'month', cursor: nov, parish: '' }, 'en');
  assert.ok(!plain.includes('Offertory'));
});
