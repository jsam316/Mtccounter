// Stats: period and parish filtering, summaries, comparisons, report text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRecords, summarize, percentChange, comparisonPeriods, parishOptions, buildStatsReport,
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
