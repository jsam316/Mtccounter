// Count Assist: line-crossing tracker, child height filter, tap-to-tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineCounter, createHeightFilter } from '../src/assist.js';

const W = 640; // frame width; default line at x = 320

/** Feed one person's x positions as consecutive frames, 200 ms apart. */
function walk(counter, xs, { y = 200, start = 0, lineX } = {}) {
  xs.forEach((x, i) => counter.update([{ x, y }], W, start + i * 200, lineX));
}

test('a walker crossing left to right counts once', () => {
  const c = createLineCounter('lr');
  walk(c, [100, 180, 260, 340, 420]);
  assert.equal(c.count, 1);
  c.update([{ x: 300, y: 200 }], W, 1200); // turns back
  assert.equal(c.count, 1);
});

test('right-to-left mode ignores left-to-right walkers', () => {
  const c = createLineCounter('rl');
  walk(c, [100, 200, 300, 400]);
  assert.equal(c.count, 0);
  const c2 = createLineCounter('rl');
  walk(c2, [500, 420, 340, 260]);
  assert.equal(c2.count, 1);
});

test('two people crossing together both count', () => {
  const c = createLineCounter('lr');
  [[100, 120], [200, 210], [300, 305], [380, 390]].forEach(([a, b], i) =>
    c.update([{ x: a, y: 100 }, { x: b, y: 420 }], W, i * 200));
  assert.equal(c.count, 2);
});

test('someone standing still on the line is never counted (choir case)', () => {
  for (const dir of ['lr', 'both']) {
    const c = createLineCounter(dir);
    walk(c, [318, 322, 317, 324, 319, 323, 316, 325]);
    assert.equal(c.count, 0, dir);
  }
});

test('opposing streams: only the chosen direction counts', () => {
  const A = [100, 175, 250, 325, 400, 475, 550]; // arriving
  const B = [550, 475, 400, 325, 250, 175, 100]; // returning
  for (const [dir, want] of [['lr', 1], ['rl', 1]]) {
    const c = createLineCounter(dir);
    A.forEach((ax, i) => c.update([{ x: ax, y: 180 }, { x: B[i], y: 300 }], W, i * 200));
    assert.equal(c.count, want, dir);
  }
});

test('a moved counting line counts walkers there, not bystanders at the old line', () => {
  const c = createLineCounter('lr');
  const lineX = W * 0.25;
  [[60, 318], [110, 322], [165, 317], [220, 323]].forEach(([wx, jx], i) =>
    c.update([{ x: wx, y: 100 }, { x: jx, y: 400 }], W, i * 200, lineX));
  assert.equal(c.count, 1);
});

test('tracks expire, so a later person at the same spot is new', () => {
  const c = createLineCounter('lr');
  walk(c, [220, 300, 380]);
  c.update([], W, 3000);
  walk(c, [220, 300, 380], { start: 3100 });
  assert.equal(c.count, 2);
});

test('a distant detection is a new person, not a jump', () => {
  const c = createLineCounter('lr');
  c.update([{ x: 100, y: 100 }], W, 0);
  c.update([{ x: 600, y: 500 }], W, 200);
  assert.equal(c.count, 0);
});

test('a person can be tagged male or female only once', () => {
  const c = createLineCounter('lr');
  const persons = [{ x: 100, y: 200 }];
  c.update(persons, W, 0);
  const id = persons[0].trackId;
  assert.equal(typeof id, 'number');
  assert.equal(c.tag(id, 'male'), true);
  assert.equal(c.tag(id, 'female'), false);
  assert.equal(c.tag(999, 'male'), false);
  const next = [{ x: 160, y: 200 }];
  c.update(next, W, 200);
  assert.equal(next[0].sex, 'male', 'tag follows the person across frames');
});

test('height filter skips children once it has learned adult height', () => {
  const f = createHeightFilter();
  let out;
  for (let i = 0; i < 6; i++) out = f.filter([{ h: 200 }, { h: 195 }], true);
  out = f.filter([{ h: 200, id: 'adult' }, { h: 105, id: 'child' }], true);
  assert.deepEqual(out.skipped.map(p => p.id), ['child']);
  assert.equal(f.filter([{ h: 140 }], true).kept.length, 1, 'teens are kept');
  assert.equal(f.filter([{ h: 200 }, { h: 105 }], false).kept.length, 2, 'toggle off keeps all');
});

test('height filter keeps everyone until it has enough history', () => {
  const f = createHeightFilter();
  assert.equal(f.filter([{ h: 200 }, { h: 100 }], true).kept.length, 2);
});
