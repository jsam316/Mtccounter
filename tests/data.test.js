// Record identity, backup merging, and HTML escaping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordKey, escapeHtml } from '../src/utils.js';
import { mergeBackups } from '../src/cloud.js';

const rec = (date, total, timestamp, service) => ({ date, total, timestamp, service });

test('record key: blank and missing service are the same main service', () => {
  assert.equal(recordKey({ date: '2026-10-04' }), '2026-10-04|');
  assert.equal(recordKey({ date: '2026-10-04', service: '' }), '2026-10-04|');
});

test('record key: service is trimmed and case-insensitive', () => {
  assert.equal(recordKey({ date: '2026-10-04', service: '  Evening ' }), '2026-10-04|evening');
});

test('merge: union of records, newest first', () => {
  const m = mergeBackups(
    { history: [rec('2026-08-16', 50, '2026-08-16T10:00:00Z'), rec('2026-08-09', 40, '2026-08-09T10:00:00Z')], celebrants: ['Rev. A'], parishes: ['St. Thomas'] },
    { history: [rec('2026-08-16', 55, '2026-08-16T12:00:00Z'), rec('2026-08-23', 60, '2026-08-23T10:00:00Z'), rec('2026-08-09', 41, '2026-08-09T09:00:00Z')], celebrants: ['Rev. B', 'Rev. A'], parishes: [] },
  );
  assert.deepEqual(m.history.map(r => r.date), ['2026-08-23', '2026-08-16', '2026-08-09']);
  assert.equal(m.history.find(r => r.date === '2026-08-16').total, 55, 'newer remote wins');
  assert.equal(m.history.find(r => r.date === '2026-08-09').total, 40, 'older remote does not overwrite');
  assert.equal(m.changed, 2);
  assert.deepEqual(m.celebrants, ['Rev. A', 'Rev. B']);
  assert.deepEqual(m.parishes, ['St. Thomas']);
});

test('merge never deletes local records', () => {
  const m = mergeBackups({ history: [rec('2026-08-16', 50, 'x'), rec('2026-08-09', 40, 'y')] }, { history: [] });
  assert.equal(m.history.length, 2);
  assert.equal(m.changed, 0);
});

test('merge skips malformed entries and keeps local on a timestamp tie', () => {
  assert.deepEqual(
    mergeBackups({ history: [] }, { history: [null, {}, rec('2026-09-01', 5, 'x')] }).history.map(r => r.date),
    ['2026-09-01'],
  );
  const tie = mergeBackups({ history: [{ date: '2026-09-02', total: 1 }] }, { history: [{ date: '2026-09-02', total: 2 }] });
  assert.equal(tie.history[0].total, 1);
});

test('merge: two services on one date stay separate', () => {
  const m = mergeBackups(
    { history: [rec('2026-10-04', 90, '2026-10-04T10:00:00Z', 'Morning')] },
    { history: [rec('2026-10-04', 40, '2026-10-04T18:00:00Z', 'Evening'), rec('2026-10-04', 95, '2026-10-04T11:00:00Z', 'Morning')] },
  );
  assert.equal(m.history.length, 2);
  assert.equal(m.history.find(r => r.service === 'Morning').total, 95);
});

test('merge: a record with no service matches a blank-service record', () => {
  const m = mergeBackups(
    { history: [{ date: '2026-09-06', total: 60, timestamp: '2026-09-06T10:00:00Z' }] },
    { history: [rec('2026-09-06', 65, '2026-09-06T12:00:00Z', '')] },
  );
  assert.equal(m.history.length, 1);
  assert.equal(m.history[0].total, 65);
});

test('escapeHtml neutralises markup and quotes', () => {
  assert.equal(escapeHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(escapeHtml("O'Brien & Sons"), 'O&#39;Brien &amp; Sons');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});
