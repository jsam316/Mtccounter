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
