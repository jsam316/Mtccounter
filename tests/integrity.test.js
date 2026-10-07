// Project integrity checks that would otherwise only fail on users' phones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { translations } from '../src/translations.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

function precacheList() {
  const sw = read('sw.js');
  const block = sw.match(/const urlsToCache = \[([\s\S]*?)\];/);
  assert.ok(block, 'urlsToCache not found in sw.js');
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

test('every precached file exists (a missing one blocks all app updates)', () => {
  for (const url of precacheList()) {
    const path = url === './' ? 'index.html' : url.replace(/^\.\//, '');
    assert.ok(existsSync(join(root, path)), 'sw.js precaches a missing file: ' + url);
  }
});

test('every app module and the stylesheet are precached (so the app works offline)', () => {
  const cached = new Set(precacheList());
  const required = [
    ...readdirSync(join(root, 'src')).filter(f => f.endsWith('.js')).map(f => './src/' + f),
    './styles.css',
    './index.html',
  ];
  for (const f of required) assert.ok(cached.has(f), f + ' is not in sw.js urlsToCache');
});

test('local files referenced by index.html exist', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
    .filter(u => !/^(https?:|data:|mailto:|#)/.test(u));
  assert.ok(refs.includes('styles.css'), 'index.html should link styles.css');
  for (const ref of refs) assert.ok(existsSync(join(root, ref.replace(/^\.\//, ''))), 'missing: ' + ref);
});

test('every inline handler calls a function main.js exposes', () => {
  const main = read('src/main.js');
  const block = main.match(/Object\.assign\(window, \{([\s\S]*?)\}\);/);
  assert.ok(block, 'window exports not found in main.js');
  const exposed = new Set(block[1].match(/[A-Za-z_$][\w$]*/g));

  const sources = ['index.html', ...readdirSync(join(root, 'src')).map(f => 'src/' + f)];
  const missing = [];
  let checked = 0;
  for (const file of sources) {
    const text = read(file);
    for (const m of text.matchAll(/on(?:click|change|input|keydown)=\\?"([^"]*?)\\?"/g)) {
      for (const call of m[1].matchAll(/(?<![\w.$'])([A-Za-z_$][\w$]*)\(/g)) {
        checked++;
        if (!exposed.has(call[1])) missing.push(file + ': ' + call[1]);
      }
    }
  }
  // Guard against this test passing vacuously if the patterns stop matching.
  assert.ok(checked >= 40, 'only ' + checked + ' handler calls found; the scan is broken');
  assert.deepEqual(missing, [], 'handlers calling functions not on window');
});

test('English and Malayalam have the same translation keys', () => {
  const en = Object.keys(translations.en), ml = Object.keys(translations.ml);
  assert.deepEqual(en.filter(k => !ml.includes(k)), [], 'missing in Malayalam');
  assert.deepEqual(ml.filter(k => !en.includes(k)), [], 'missing in English');
});

test('every data-i18n key in index.html has a translation', () => {
  const html = read('index.html');
  const keys = [...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)].map(m => m[1]);
  const missing = [...new Set(keys)].filter(k => !(k in translations.en));
  assert.deepEqual(missing, []);
});

test('the web manifest is valid and its icons exist', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) assert.ok(existsSync(join(root, icon.src)), icon.src);
});
