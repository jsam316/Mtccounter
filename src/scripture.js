import bibleData from './bibleData.js';

export function resetVerseSelects() {
  const vs = document.getElementById('verseStart');
  const ve = document.getElementById('verseEnd');
  while (vs.options.length > 1) vs.remove(1);
  while (ve.options.length > 1) ve.remove(1);
  vs.value = '';
  ve.value = '';
}

export function updateChapterOptions(book) {
  const chapterSelect = document.getElementById('chapter');
  while (chapterSelect.options.length > 1) chapterSelect.remove(1);
  chapterSelect.value = '';
  resetVerseSelects();

  const chapters = bibleData[book];
  if (!chapters) return;
  for (let i = 0; i < chapters.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i + 1);
    opt.textContent = String(i + 1);
    chapterSelect.appendChild(opt);
  }
}

export function updateVerseOptions(book, chapterNum) {
  resetVerseSelects();
  const chapters = bibleData[book];
  if (!chapters || chapterNum < 1 || chapterNum > chapters.length) return;

  const maxVerse = chapters[chapterNum - 1];
  const vs = document.getElementById('verseStart');
  const ve = document.getElementById('verseEnd');
  for (let i = 1; i <= maxVerse; i++) {
    const o1 = document.createElement('option');
    o1.value = String(i);
    o1.textContent = String(i);
    vs.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = String(i);
    o2.textContent = String(i);
    ve.appendChild(o2);
  }
}

/**
 * Parse a reference such as "Luke 9:1-6", "1 John 3:1", "Psalms 23" or
 * "Ruth". Returns { book, chapter, verseStart, verseEnd } (numbers or null),
 * or null when the book is not in the picker.
 */
export function parseScriptureRef(ref) {
  const m = String(ref || '').trim().match(/^(.+?)(?: (\d+)(?::(\d+)(?:-(\d+))?)?)?$/);
  if (!m || !bibleData[m[1]]) return null;
  const n = v => (v === undefined ? null : Number(v));
  return { book: m[1], chapter: n(m[2]), verseStart: n(m[3]), verseEnd: n(m[4]) ?? n(m[3]) };
}

/** The reference currently chosen in the picker ('' when no book is chosen). */
export function getScriptureRef() {
  const v = id => document.getElementById(id).value;
  const book = v('book'), chapter = v('chapter'), vs = v('verseStart'), ve = v('verseEnd');
  if (!book) return '';
  let s = book;
  if (chapter) {
    s += ' ' + chapter;
    if (vs) s += ':' + vs + (ve && ve !== vs ? '-' + ve : '');
  }
  return s;
}

/** Set the picker to a reference; '' clears it. Returns false if unrecognised. */
export function setScriptureRef(ref) {
  const bookEl = document.getElementById('book');
  if (!ref) { bookEl.value = ''; updateChapterOptions(''); return true; }
  const p = parseScriptureRef(ref);
  if (!p) return false;
  bookEl.value = p.book;
  updateChapterOptions(p.book);
  if (p.chapter) {
    document.getElementById('chapter').value = String(p.chapter);
    updateVerseOptions(p.book, p.chapter);
    if (p.verseStart) {
      document.getElementById('verseStart').value = String(p.verseStart);
      document.getElementById('verseEnd').value = String(p.verseEnd || p.verseStart);
    }
  }
  return true;
}
