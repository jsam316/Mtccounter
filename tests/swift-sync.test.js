// The iOS app's lectionary is generated from the web app's; keep them equal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LECTIONARY } from '../src/lectionary.js';
import { renderSwiftLectionary, SWIFT_PATH } from '../tools/generate-swift-lectionary.js';

test('iOS LectionaryData.swift matches src/lectionary.js (run: node tools/generate-swift-lectionary.js)', () => {
  assert.equal(readFileSync(SWIFT_PATH, 'utf8'), renderSwiftLectionary(LECTIONARY));
});
