// The iOS app's lectionary and offertory currencies are generated from the
// web app's; keep them equal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LECTIONARY } from '../src/lectionary.js';
import { renderSwiftLectionary, SWIFT_PATH } from '../tools/generate-swift-lectionary.js';

test('iOS LectionaryData.swift matches src/lectionary.js (run: node tools/generate-swift-lectionary.js)', () => {
  assert.equal(readFileSync(SWIFT_PATH, 'utf8'), renderSwiftLectionary(LECTIONARY));
});

import { currencyTable } from '../src/offertory.js';
import { renderSwiftOffertory, SWIFT_PATH as OFFERTORY_SWIFT_PATH } from '../tools/generate-swift-offertory.js';

test('iOS OffertoryData.swift matches src/offertory.js (run: node tools/generate-swift-offertory.js)', () => {
  assert.equal(readFileSync(OFFERTORY_SWIFT_PATH, 'utf8'), renderSwiftOffertory(currencyTable()));
});
