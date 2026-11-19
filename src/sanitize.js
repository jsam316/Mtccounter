// Everything that comes in from outside the app (a backup file, a Google
// Drive backup) passes through here before it is stored. A backup can be
// edited by hand or crafted to cause harm, so nothing in it is trusted: each
// record is rebuilt from known fields only, every value is checked for type
// and size, and anything that doesn't fit is dropped.
//
// (Text is still escaped wherever it is shown; this is the second lock.)

import { normalizeOffertory, offertorySheet, isOffertoryEmpty, currencyDecimals } from './offertory.js';

export const LIMITS = Object.freeze({
  fileBytes: 5 * 1024 * 1024, // largest backup file accepted
  records: 5000,
  names: 500,
  rounds: 500,
  count: 1000000,             // largest head-count in one field
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Control characters (except tab and newline) have no place in a name or title.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** A short piece of text: strings and numbers only, trimmed and capped. */
export function cleanText(value, max) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(CONTROL, '').trim().slice(0, max);
}

/** A whole, non-negative count; anything else is 0. */
export function cleanCount(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, LIMITS.count) : 0;
}

/** "2026-11-10" for a real calendar date; null otherwise. */
export function cleanDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === value ? value : null;
}

function cleanTimestamp(value) {
  const s = cleanText(value, 40);
  return s && Number.isFinite(Date.parse(s)) ? s : '';
}

/** One service record rebuilt from known fields, or null if it has no valid date. */
export function sanitizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const date = cleanDate(raw.date);
  if (!date) return null;

  const male = cleanCount(raw.male);
  const female = cleanCount(raw.female);
  const record = {
    date,
    service:      cleanText(raw.service, 60),
    parishName:   cleanText(raw.parishName, 120),
    celebrant:    cleanText(raw.celebrant, 120),
    coCelebrants: cleanText(raw.coCelebrants, 400),
    sermon:       cleanText(raw.sermon, 200),
    scripture:    cleanText(raw.scripture, 80),
    male,
    female,
    total:        male + female,
    rounds: (Array.isArray(raw.rounds) ? raw.rounds : [])
      .filter(r => r && typeof r === 'object')
      .slice(0, LIMITS.rounds)
      .map(r => {
        const m = cleanCount(r.male), f = cleanCount(r.female);
        return { male: m, female: f, total: m + f, timestamp: cleanTimestamp(r.timestamp) };
      }),
    timestamp: cleanTimestamp(raw.timestamp),
  };
  const notes = cleanText(raw.notes, 2000); // written by the iPhone app
  if (notes) record.notes = notes;

  if (raw.offertory && typeof raw.offertory === 'object' && !Array.isArray(raw.offertory)) {
    const off = normalizeOffertory(raw.offertory);
    if (!isOffertoryEmpty(off)) {
      // Totals are worked out again from the counts, never taken from the file.
      const totalMinor = offertorySheet(off).columnTotals.total;
      record.offertory = { ...off, totalMinor, total: totalMinor / 10 ** currencyDecimals(off.currency) };
    }
  }
  return record;
}

/** A list of names: non-empty text, no repeats, capped. */
export function sanitizeNames(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const item of list) {
    const name = cleanText(item, 120);
    if (name) seen.add(name);
    if (seen.size >= LIMITS.names) break;
  }
  return [...seen];
}

/**
 * A whole backup made safe. Returns null if it isn't an MTC Counter backup.
 * `rejected` counts the records that were present but unusable.
 */
export function sanitizeBackup(backup) {
  if (!backup || typeof backup !== 'object' || backup.app !== 'MTC Counter') return null;
  const data = backup.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const rawHistory = Array.isArray(data.mtcHistory) ? data.mtcHistory.slice(0, LIMITS.records) : [];
  const history = [];
  const seen = new Set(); // one record per date + service, the first one wins
  for (const raw of rawHistory) {
    const r = sanitizeRecord(raw);
    if (!r) continue;
    const key = r.date + '|' + r.service.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    history.push(r);
  }
  return {
    history,
    celebrants: sanitizeNames(data.savedCelebrants),
    parishes: sanitizeNames(data.savedParishes),
    hasHistory: Array.isArray(data.mtcHistory),
    hasCelebrants: Array.isArray(data.savedCelebrants),
    hasParishes: Array.isArray(data.savedParishes),
    rejected: (Array.isArray(data.mtcHistory) ? data.mtcHistory.length : 0) - history.length,
  };
}
