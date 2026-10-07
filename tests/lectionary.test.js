// Sabha lectionary data and the Friday → Sunday → Tuesday theme rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LECTIONARY, LECTIONARY_YEARS, getLectionaryEntry, isLectionaryYearLoaded,
} from '../src/lectionary.js';

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

test('every key is a real calendar date', () => {
  for (const key of Object.keys(LECTIONARY)) {
    const d = new Date(key + 'T00:00:00');
    assert.ok(!Number.isNaN(d.getTime()), key);
    assert.equal(iso(d), key, 'no rolled-over dates like Feb 30');
  }
});

test('every Sunday of each loaded year has a theme', () => {
  for (const year of LECTIONARY_YEARS) {
    const d = new Date(Number(year), 0, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    for (; d.getFullYear() === Number(year); d.setDate(d.getDate() + 7)) {
      const e = LECTIONARY[iso(d)];
      assert.ok(e && e.theme, 'Sunday ' + iso(d) + ' has no theme');
    }
  }
});

test('a Friday takes the theme of the coming Sunday', () => {
  const fri = getLectionaryEntry('2026-01-16');
  assert.equal(fri.theme, LECTIONARY['2026-01-18'].theme);
  assert.equal(fri.weekly, true);
});

test('a Tuesday takes the theme of the Sunday just past', () => {
  const tue = getLectionaryEntry('2026-01-13');
  assert.equal(tue.theme, LECTIONARY['2026-01-11'].theme);
  assert.equal(tue.weekly, true);
});

test('a Friday with its own occasion keeps it and adds the week theme', () => {
  const e = getLectionaryEntry('2026-07-03'); // St. Thomas the Apostle's Day
  assert.match(e.occasion, /Thomas/);
  assert.equal(e.theme, LECTIONARY['2026-07-05'].theme);
});

test("a day's own theme wins over the weekly theme", () => {
  assert.equal(getLectionaryEntry('2026-04-03').theme, LECTIONARY['2026-04-03'].theme); // Good Friday
  assert.equal(getLectionaryEntry('2026-12-25').theme, LECTIONARY['2026-12-25'].theme); // Christmas
  assert.equal(getLectionaryEntry('2026-06-16').weekly, undefined); // Apostles' Lent Tuesday
});

test('ordinary weekdays and empty input have no entry', () => {
  assert.equal(getLectionaryEntry('2026-01-07'), null); // Wednesday
  assert.equal(getLectionaryEntry(''), null);
});

test('loaded-year check drives the "lectionary not added yet" notice', () => {
  assert.ok(LECTIONARY_YEARS.includes('2026'));
  assert.equal(isLectionaryYearLoaded('2026-10-04'), true);
  assert.equal(isLectionaryYearLoaded('2027-01-03'), LECTIONARY_YEARS.includes('2027'));
  assert.equal(isLectionaryYearLoaded(''), false);
});
