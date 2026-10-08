import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { getScriptureRef, setScriptureRef } from './scripture.js';

// Mar Thoma Sabha Lectionary — 'YYYY-MM-DD' → { occasion?, theme?, gospel? }.
// gospel: the day's Gospel reading in Scripture-picker form ('Luke 9:1-6');
// where a day has several services, the first (morning) service's reading.
//
// Source: Malankara Mar Thoma Syrian Church, Diocese of North America,
// "Lectionary for the Christian Year 2026". Themes are transcribed from the
// published lectionary (obvious print/OCR typos corrected, e.g. "Yolk" →
// "Yoke"). Civil holidays without a sermon theme are omitted.
//
// A Sunday's theme is shared by the surrounding midweek services: the
// preceding Friday and the following Tuesday — see getLectionaryEntry().
export const LECTIONARY = {
  // ── January 2026 ──
  '2026-01-01': { occasion: 'New Year Day — Circumcision of our Lord', theme: 'Freedom under the Yoke of Christ', gospel: 'Luke 2:16-21' },
  '2026-01-04': { occasion: 'Mission Outside Kerala Sunday', theme: "Mission: unveiling God's love to all", gospel: 'Luke 9:1-6' },
  '2026-01-06': { occasion: 'Baptism of our Lord (Danaha)', theme: 'Affirmation of Identity and Mission', gospel: 'Matthew 3:11-17' },
  '2026-01-08': { occasion: "St. Stephen's Day", gospel: 'Matthew 23:34-39' },
  '2026-01-11': { theme: 'Christian life meant to be fruitful', gospel: 'John 15:1-11' },
  '2026-01-18': { occasion: 'Unity Octave begins', theme: 'Trusting in a Caring God', gospel: 'Matthew 6:19-34' },
  '2026-01-25': { occasion: 'Ecumenical Sunday', theme: 'Unity in faith and action', gospel: 'Mark 6:32-44' },
  '2026-01-26': { occasion: 'Beginning of Three-day Lent (Fast of Nineveh)', theme: 'Repentance', gospel: 'Matthew 7:1-12' },
  '2026-01-27': { occasion: 'Three-day Lent', theme: 'Transformation', gospel: 'Matthew 24:36-46' },
  '2026-01-28': { occasion: 'Three-day Lent', theme: 'The redemption of all creation', gospel: 'Matthew 12:38-50' },
  '2026-01-29': { occasion: 'Conclusion of Three-day Lent', theme: 'Celebration of redemption', gospel: 'Luke 13:1-5' },

  // ── February 2026 ──
  '2026-02-01': { occasion: 'Medical Mission Sunday', theme: 'Compassion: Loving and Suffering Together', gospel: 'Matthew 9:35-38' },
  '2026-02-02': { occasion: 'Entry of our Lord to the Temple (Mayaltho)', gospel: 'Luke 2:22-39' },
  '2026-02-08': { occasion: 'Beginning of the 131st Maramon Convention', theme: 'Sabbath Leads to the Fulness of Creation', gospel: 'Mark 3:1-6' },
  '2026-02-15': { occasion: 'Beginning of the Great Lent (Pethurtha)', theme: 'Jesus Christ who Transforms', gospel: 'John 2:1-11' },
  '2026-02-16': { occasion: 'Shubkono — Ministry of Reconciliation', theme: 'Forgiven to Forgive', gospel: 'Matthew 5:21-26' },
  '2026-02-22': { occasion: 'Second Sunday of Great Lent', theme: 'Call to be Compassionate', gospel: 'Mark 1:40-45' },

  // ── March 2026 ──
  '2026-03-01': { occasion: 'Third Sunday of Great Lent', theme: "Call to Shoulder Each Other's Burdens", gospel: 'Mark 2:1-12' },
  '2026-03-06': { occasion: "World Women's Day of Prayer" },
  '2026-03-08': { occasion: 'Fourth Sunday of Great Lent', theme: 'Call to be Inclusive', gospel: 'Matthew 15:21-28' },
  '2026-03-11': { occasion: 'Mid-Lent', theme: 'The Readiness to Face the Cross', gospel: 'Mark 10:32-34' },
  '2026-03-15': { occasion: 'Fifth Sunday of Great Lent', theme: 'Call to be Liberative', gospel: 'Luke 13:10-17' },
  '2026-03-22': { theme: 'Cross: Manifestation of Grace', gospel: 'Mark 10:46-52' },
  '2026-03-25': { occasion: 'Annunciation to Virgin Mary', gospel: 'Luke 1:26-38' },
  '2026-03-27': { occasion: '40th Friday in Great Lent', theme: 'Hunger to be the Will of God', gospel: 'Matthew 4:1-11' },
  '2026-03-29': { occasion: 'Hosanna Sunday — Vaideeka Seminary Day', theme: 'Entry of the King of Peace', gospel: 'Mark 11:1-11' },
  '2026-03-30': { occasion: 'Passion Week (Hasha)', gospel: 'Matthew 22:15-33' },
  '2026-03-31': { occasion: 'Passion Week (Hasha)', gospel: 'Matthew 24:1-28' },

  // ── April 2026 ──
  '2026-04-01': { occasion: 'Passion Week (Hasha)', gospel: 'Matthew 25:14-46' },
  '2026-04-02': { occasion: 'Passover (Maundy) Thursday', theme: 'Holy Qurbana: Life-Giving Love', gospel: 'Matthew 26:17-30' },
  '2026-04-03': { occasion: 'Good Friday', theme: 'Cross: The Celebration of Life', gospel: 'Matthew 26:47-75' },
  '2026-04-04': { occasion: 'Holy Saturday', theme: 'Hope in Despair', gospel: 'Matthew 27:62-66' },
  '2026-04-05': { occasion: 'Easter Sunday — Feast of Resurrection (Kymtho)', theme: 'Resurrection: Victory over Death', gospel: 'Mark 16:1-11' },
  '2026-04-12': { occasion: 'New Sunday', theme: 'My Lord and My God', gospel: 'John 20:24-29' },
  '2026-04-19': { occasion: 'Second Sunday after the Feast of Resurrection', theme: 'Come and Dine: Invitation by the Risen Lord', gospel: 'John 21:1-14' },
  '2026-04-26': { occasion: 'Third Sunday after the Feast of Resurrection', theme: 'Risen Lord: The Co-Traveller', gospel: 'Luke 24:13-35' },

  // ── May 2026 ──
  '2026-05-03': { occasion: "Metropolitan's Fund Sunday", theme: 'Walk with Christ in Passionate Love', gospel: 'John 21:15-19' },
  '2026-05-08': { occasion: "St. John's Day", gospel: 'John 21:20-25' },
  '2026-05-10': { occasion: 'Fifth Sunday after the Feast of Resurrection', theme: 'Risen Christ: Assurance of Everlasting Presence', gospel: 'Matthew 28:16-20' },
  '2026-05-14': { occasion: 'Feast of Ascension of our Lord (Suloko)', theme: 'Ascended Christ: Unseen, Not Absent', gospel: 'Luke 24:44-53' },
  '2026-05-17': { theme: 'Holy Spirit: The Lord and Giver of Life', gospel: 'John 14:15-21' },
  '2026-05-24': { occasion: 'Feast of Pentecost — Sacred Music Sunday', theme: 'Divine Voice in a Noisy World', gospel: 'John 20:19-23' },
  '2026-05-31': { occasion: 'Trinity Sunday', theme: 'Trinity: The Divine Communion of Love', gospel: 'John 3:8-16' },

  // ── June 2026 ──
  '2026-06-07': { theme: 'Jesus: The Ultimate Influencer', gospel: 'John 8:12-20' },
  '2026-06-14': { occasion: 'Environment Sunday', theme: 'Creation Speaks of God', gospel: 'Luke 12:24-27' },
  '2026-06-16': { occasion: "Beginning of the Apostles' Lent", theme: "Call and Commission to be Christ's Disciples", gospel: 'Matthew 4:17-22' },
  '2026-06-21': { theme: "Worship: In God's Presence, for God's Purpose", gospel: 'Mark 12:28-34' },
  '2026-06-28': { occasion: 'De-Addiction Day', theme: 'Break the Chain: Finding Freedom from Addictions', gospel: 'Mark 5:1-20' },
  '2026-06-29': { occasion: "St. Paul's and St. Peter's Day — Conclusion of Apostles' Lent", gospel: 'Matthew 20:25-28' },

  // ── July 2026 ──
  '2026-07-03': { occasion: "St. Thomas the Apostle's Day", gospel: 'John 20:24-29' },
  '2026-07-05': { occasion: 'Tithe Offering Sunday', theme: "Sharing God's Gift with Joy", gospel: 'Luke 16:19-31' },
  '2026-07-12': { occasion: 'Clergy Sunday', theme: 'Ordained Ministry: Call to be Sacrifice', gospel: 'Matthew 20:20-28' },
  '2026-07-19': { theme: 'Edification of the Church through Theological Education', gospel: 'Matthew 13:16-23' },
  '2026-07-25': { occasion: "St. James the Apostle's Day", gospel: 'Mark 10:35-45' },
  '2026-07-26': { theme: 'Marriage: Celebration of Unity and Partnership', gospel: 'Matthew 19:4-6' },

  // ── August 2026 ──
  '2026-08-01': { occasion: 'Beginning of the 15-day Lent', gospel: 'Matthew 5:38-42' },
  '2026-08-02': { occasion: 'Mission Sunday', theme: 'Mission: Compassion in Action', gospel: 'Mark 2:13-17' },
  '2026-08-06': { occasion: 'Feast of Transfiguration of our Lord', theme: 'Glorification of Messiah through Death', gospel: 'Luke 9:28-36' },
  '2026-08-09': { theme: 'Identity in Christ marked by Baptism', gospel: 'John 3:1-8' },
  '2026-08-15': { occasion: 'Independence Day (India) — Conclusion of 15-day Lent', theme: 'Democracy: Rooted in Justice, Guided by Truth', gospel: 'John 8:31-36' },
  '2026-08-16': { occasion: 'Reformation Sunday', theme: 'Reformation: A Call for Renewal', gospel: 'Luke 5:36-39' },
  '2026-08-23': { theme: 'Holy Qurbana: Table of Reconciliation', gospel: 'Matthew 5:23-26' },
  '2026-08-30': { theme: 'Embracing the Migrants and Refugees', gospel: 'Luke 10:25-37' },

  // ── September 2026 ──
  '2026-09-06': { occasion: 'Education Sunday', theme: 'Education for Transformation of Life', gospel: 'Luke 5:1-11' },
  '2026-09-13': { occasion: 'Sevika Sangham Day', theme: 'Women who Trust God: Fearless and Faithful', gospel: 'John 12:1-8' },
  '2026-09-20': { occasion: 'Senior Citizen Sunday', theme: 'Productive Living: The Best is Yet to Come', gospel: 'John 21:18-23' },
  '2026-09-21': { occasion: "St. Matthew's Day", gospel: 'Matthew 13:44-52' },
  '2026-09-27': { theme: "God's Unfailing Presence in Crises", gospel: 'Mark 4:35-41' },

  // ── October 2026 ──
  '2026-10-04': { occasion: "Voluntary Evangelists' Association Day (MTVEA)", theme: 'Members of the Church: Ministers of the Kingdom of God', gospel: 'John 15:12-19' },
  '2026-10-11': { occasion: 'Day of the Differently Abled', theme: "Sufficiency of God's Grace", gospel: 'John 9:1-7' },
  '2026-10-18': { occasion: 'Youth Sunday', theme: 'Unshaken Faith Life in a Fleeting World', gospel: 'Matthew 7:21-27' },
  '2026-10-25': { occasion: 'Christian Family Dedication Sunday', theme: 'Family: Celebration of Relationships', gospel: 'Mark 3:31-35' },

  // ── November 2026 ──
  '2026-11-01': { occasion: 'World Sunday School Day — Kudosh Eetho (Beginning of the Liturgical Year)', theme: 'Be the Children of Light', gospel: 'Matthew 5:13-16' },
  '2026-11-08': { occasion: 'Hudos Eetho — Renewal of the Church', theme: 'United in Christ: Witnessing to the World', gospel: 'Matthew 18:18-20' },
  '2026-11-15': { occasion: 'Annunciation to Zechariah', theme: "God's Salvific Intervention", gospel: 'Luke 1:5-23' },
  '2026-11-22': { occasion: 'Annunciation to Virgin Mary — Diaspora Sunday', theme: 'Call to be the Mother of Jesus Christ, the Savior of the World', gospel: 'Luke 1:26-38' },
  '2026-11-29': { occasion: 'Meeting of Virgin Mary and Elizabeth', theme: 'Transcending Adversity with Hope', gospel: 'Luke 1:39-45' },
  '2026-11-30': { occasion: "St. Andrew's Day", gospel: 'John 1:35-42' },

  // ── December 2026 ──
  '2026-12-01': { occasion: 'Beginning of the 25-day Lent', gospel: 'John 1:1-15' },
  '2026-12-06': { occasion: 'Bible Sunday — Birth of St. John the Baptist', theme: 'Word-oriented Wisdom and Discernment', gospel: 'Luke 1:57-66' },
  '2026-12-13': { occasion: 'Annunciation to Joseph', theme: "Embracing God's Plan", gospel: 'Matthew 1:18-25' },
  '2026-12-20': { theme: 'Incarnated Word', gospel: 'John 1:1-14' },
  '2026-12-21': { occasion: 'Mar Thoma Church Day (Sabha Dinam)', gospel: 'John 11:5-16' },
  '2026-12-25': { occasion: 'Christmas — Feast of Nativity (Yaldo)', theme: 'Christmas: The Light for All People', gospel: 'Luke 2:1-14' },
  '2026-12-27': { theme: 'The Glorious Appearance of our Lord', gospel: 'Matthew 24:42-51' },
  '2026-12-31': { occasion: "New Year's Eve (Watch Night)", theme: "Praising God's Faithfulness", gospel: 'Luke 17:11-19' },
};

function _shiftDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + days);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/**
 * Lectionary lookup for a date.
 *
 * - An exact entry for the date always wins.
 * - A Sunday's theme is shared by the surrounding midweek services:
 *   the preceding Friday (2 days before) and the following Tuesday
 *   (2 days after) inherit it when they have no theme of their own.
 *   The result is then marked { weekly: true }.
 */
export function getLectionaryEntry(dateStr) {
  if (!dateStr) return null;
  const exact = LECTIONARY[dateStr] || null;
  if (exact && exact.theme) return exact;

  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return exact;
  const day = d.getDay();
  const isMidweekService = day === 5 || day === 2; // Friday or Tuesday
  if (!isMidweekService) return exact;

  // Friday looks ahead to the upcoming Sunday; Tuesday looks back.
  const sundayStr = _shiftDateStr(dateStr, day === 5 ? 2 : -2);
  const sunday = LECTIONARY[sundayStr];
  if (!sunday || !sunday.theme) return exact;

  return {
    occasion: exact ? exact.occasion : null,
    theme:    sunday.theme,
    weekly:   true,
  };
}

// Last value this module wrote into the sermon field. Lets a date change
// replace a theme WE auto-filled while never touching user-typed text.
let _lastAutoFill = null;
// Same idea for the Scripture picker: the Gospel reading we last filled in.
let _lastScriptureFill = null;

/**
 * Fill the Scripture picker with the day's Gospel reading when it is empty
 * or still holds a reading we filled; clear our own stale fill otherwise.
 * Readings come only from the day's own entry (weekly Friday/Tuesday
 * themes don't carry the Sunday readings).
 */
function _syncScripture(gospel) {
  const current = getScriptureRef();
  const ours = _lastScriptureFill && current === _lastScriptureFill;
  if (gospel) {
    if (!current || ours) { if (setScriptureRef(gospel)) _lastScriptureFill = gospel; }
  } else if (ours) {
    setScriptureRef('');
    _lastScriptureFill = null;
  }
}

/**
 * Refresh the lectionary hint for the currently selected date.
 * If an entry with a theme exists and the sermon field is empty (or still
 * holds a previously auto-filled theme), the theme is filled in
 * automatically; the hint stays visible either way so the user can tap it
 * to (re)apply the theme.
 */
/** Years (as 'YYYY' strings) that have lectionary data loaded. */
export const LECTIONARY_YEARS = [...new Set(Object.keys(LECTIONARY).map(k => k.slice(0, 4)))].sort();

/** True when the lectionary for this date's year has been added. */
export function isLectionaryYearLoaded(dateStr) {
  return LECTIONARY_YEARS.includes(String(dateStr || '').slice(0, 4));
}

export function updateLectionaryHint() {
  const hint   = document.getElementById('lectionaryHint');
  const sermon = document.getElementById('sermon');
  if (!hint || !sermon) return;

  const dateStr = document.getElementById('date').value;
  const entry = getLectionaryEntry(dateStr);
  hint.classList.remove('lectionary-missing');
  if (!entry) {
    // A date in a year with no lectionary data: say so, rather than
    // silently not suggesting a theme (e.g. January before the next
    // year's lectionary has been added).
    if (dateStr && !isLectionaryYearLoaded(dateStr)) {
      hint.textContent   = '📖 ' + t('lectionaryMissing').replace('{year}', dateStr.slice(0, 4));
      hint.title         = '';
      hint.classList.add('lectionary-missing');
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
    // Clear a stale auto-filled theme; leave user-typed text alone.
    if (_lastAutoFill && sermon.value === _lastAutoFill) {
      sermon.value = '';
      _lastAutoFill = null;
    }
    _syncScripture(null);
    return;
  }

  const parts = [];
  if (entry.occasion) parts.push(entry.occasion);
  if (entry.theme) {
    parts.push(entry.weekly ? t('weeklyTheme') + ': ' + entry.theme : entry.theme);
  }
  hint.textContent   = '📖 ' + parts.join(' — ')
    + (entry.gospel ? ' · ' + t('lectionaryGospel') + ': ' + entry.gospel : '');
  hint.title         = entry.theme || entry.gospel ? t('lectionaryTapHint') : '';
  hint.style.display = 'block';
  _syncScripture(entry.gospel || null);

  const replaceable = !sermon.value.trim() || (_lastAutoFill && sermon.value === _lastAutoFill);
  if (entry.theme && replaceable) {
    sermon.value = entry.theme;
    _lastAutoFill = entry.theme;
  }
}

/** Fill the sermon field with the lectionary theme for the selected date. */
export function applyLectionaryTheme() {
  const entry = getLectionaryEntry(document.getElementById('date').value);
  if (!entry || (!entry.theme && !entry.gospel)) return;
  if (entry.theme) {
    document.getElementById('sermon').value = entry.theme;
    _lastAutoFill = entry.theme;
  }
  if (entry.gospel && setScriptureRef(entry.gospel)) _lastScriptureFill = entry.gospel;
  triggerHaptic('light');
}
