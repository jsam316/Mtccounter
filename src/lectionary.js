import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';

// Mar Thoma Sabha Lectionary — 'YYYY-MM-DD' → { occasion?, theme? }.
//
// Source: Malankara Mar Thoma Syrian Church, Diocese of North America,
// "Lectionary for the Christian Year 2026". Themes are transcribed from the
// published lectionary (obvious print/OCR typos corrected, e.g. "Yolk" →
// "Yoke"). Civil holidays without a sermon theme are omitted.
//
// The weekly (Sunday) theme also applies to midweek services on Friday and
// Tuesday — see getLectionaryEntry().
export const LECTIONARY = {
  // ── January 2026 ──
  '2026-01-01': { occasion: 'New Year Day — Circumcision of our Lord', theme: 'Freedom under the Yoke of Christ' },
  '2026-01-04': { occasion: 'Mission Outside Kerala Sunday', theme: "Mission: unveiling God's love to all" },
  '2026-01-06': { occasion: 'Baptism of our Lord (Danaha)', theme: 'Affirmation of Identity and Mission' },
  '2026-01-08': { occasion: "St. Stephen's Day" },
  '2026-01-11': { theme: 'Christian life meant to be fruitful' },
  '2026-01-18': { occasion: 'Unity Octave begins', theme: 'Trusting in a Caring God' },
  '2026-01-25': { occasion: 'Ecumenical Sunday', theme: 'Unity in faith and action' },
  '2026-01-26': { occasion: 'Beginning of Three-day Lent (Fast of Nineveh)', theme: 'Repentance' },
  '2026-01-27': { occasion: 'Three-day Lent', theme: 'Transformation' },
  '2026-01-28': { occasion: 'Three-day Lent', theme: 'The redemption of all creation' },
  '2026-01-29': { occasion: 'Conclusion of Three-day Lent', theme: 'Celebration of redemption' },

  // ── February 2026 ──
  '2026-02-01': { occasion: 'Medical Mission Sunday', theme: 'Compassion: Loving and Suffering Together' },
  '2026-02-02': { occasion: 'Entry of our Lord to the Temple (Mayaltho)' },
  '2026-02-08': { occasion: 'Beginning of the 131st Maramon Convention', theme: 'Sabbath Leads to the Fulness of Creation' },
  '2026-02-15': { occasion: 'Beginning of the Great Lent (Pethurtha)', theme: 'Jesus Christ who Transforms' },
  '2026-02-16': { occasion: 'Shubkono — Ministry of Reconciliation', theme: 'Forgiven to Forgive' },
  '2026-02-22': { occasion: 'Second Sunday of Great Lent', theme: 'Call to be Compassionate' },

  // ── March 2026 ──
  '2026-03-01': { occasion: 'Third Sunday of Great Lent', theme: "Call to Shoulder Each Other's Burdens" },
  '2026-03-06': { occasion: "World Women's Day of Prayer" },
  '2026-03-08': { occasion: 'Fourth Sunday of Great Lent', theme: 'Call to be Inclusive' },
  '2026-03-11': { occasion: 'Mid-Lent', theme: 'The Readiness to Face the Cross' },
  '2026-03-15': { occasion: 'Fifth Sunday of Great Lent', theme: 'Call to be Liberative' },
  '2026-03-22': { theme: 'Cross: Manifestation of Grace' },
  '2026-03-25': { occasion: 'Annunciation to Virgin Mary' },
  '2026-03-27': { occasion: '40th Friday in Great Lent', theme: 'Hunger to be the Will of God' },
  '2026-03-29': { occasion: 'Hosanna Sunday — Vaideeka Seminary Day', theme: 'Entry of the King of Peace' },
  '2026-03-30': { occasion: 'Passion Week (Hasha)' },
  '2026-03-31': { occasion: 'Passion Week (Hasha)' },

  // ── April 2026 ──
  '2026-04-01': { occasion: 'Passion Week (Hasha)' },
  '2026-04-02': { occasion: 'Passover (Maundy) Thursday', theme: 'Holy Qurbana: Life-Giving Love' },
  '2026-04-03': { occasion: 'Good Friday', theme: 'Cross: The Celebration of Life' },
  '2026-04-04': { occasion: 'Holy Saturday', theme: 'Hope in Despair' },
  '2026-04-05': { occasion: 'Easter Sunday — Feast of Resurrection (Kymtho)', theme: 'Resurrection: Victory over Death' },
  '2026-04-12': { occasion: 'New Sunday', theme: 'My Lord and My God' },
  '2026-04-19': { occasion: 'Second Sunday after the Feast of Resurrection', theme: 'Come and Dine: Invitation by the Risen Lord' },
  '2026-04-26': { occasion: 'Third Sunday after the Feast of Resurrection', theme: 'Risen Lord: The Co-Traveller' },

  // ── May 2026 ──
  '2026-05-03': { occasion: "Metropolitan's Fund Sunday", theme: 'Walk with Christ in Passionate Love' },
  '2026-05-08': { occasion: "St. John's Day" },
  '2026-05-10': { occasion: 'Fifth Sunday after the Feast of Resurrection', theme: 'Risen Christ: Assurance of Everlasting Presence' },
  '2026-05-14': { occasion: 'Feast of Ascension of our Lord (Suloko)', theme: 'Ascended Christ: Unseen, Not Absent' },
  '2026-05-17': { theme: 'Holy Spirit: The Lord and Giver of Life' },
  '2026-05-24': { occasion: 'Feast of Pentecost — Sacred Music Sunday', theme: 'Divine Voice in a Noisy World' },
  '2026-05-31': { occasion: 'Trinity Sunday', theme: 'Trinity: The Divine Communion of Love' },

  // ── June 2026 ──
  '2026-06-07': { theme: 'Jesus: The Ultimate Influencer' },
  '2026-06-14': { occasion: 'Environment Sunday', theme: 'Creation Speaks of God' },
  '2026-06-16': { occasion: "Beginning of the Apostles' Lent", theme: "Call and Commission to be Christ's Disciples" },
  '2026-06-21': { theme: "Worship: In God's Presence, for God's Purpose" },
  '2026-06-28': { occasion: 'De-Addiction Day', theme: 'Break the Chain: Finding Freedom from Addictions' },
  '2026-06-29': { occasion: "St. Paul's and St. Peter's Day — Conclusion of Apostles' Lent" },

  // ── July 2026 ──
  '2026-07-03': { occasion: "St. Thomas the Apostle's Day" },
  '2026-07-05': { occasion: 'Tithe Offering Sunday', theme: "Sharing God's Gift with Joy" },
  '2026-07-12': { occasion: 'Clergy Sunday', theme: 'Ordained Ministry: Call to be Sacrifice' },
  '2026-07-19': { theme: 'Edification of the Church through Theological Education' },
  '2026-07-25': { occasion: "St. James the Apostle's Day" },
  '2026-07-26': { theme: 'Marriage: Celebration of Unity and Partnership' },

  // ── August 2026 ──
  '2026-08-01': { occasion: 'Beginning of the 15-day Lent' },
  '2026-08-02': { occasion: 'Mission Sunday', theme: 'Mission: Compassion in Action' },
  '2026-08-06': { occasion: 'Feast of Transfiguration of our Lord', theme: 'Glorification of Messiah through Death' },
  '2026-08-09': { theme: 'Identity in Christ marked by Baptism' },
  '2026-08-15': { occasion: 'Independence Day (India) — Conclusion of 15-day Lent', theme: 'Democracy: Rooted in Justice, Guided by Truth' },
  '2026-08-16': { occasion: 'Reformation Sunday', theme: 'Reformation: A Call for Renewal' },
  '2026-08-23': { theme: 'Holy Qurbana: Table of Reconciliation' },
  '2026-08-30': { theme: 'Embracing the Migrants and Refugees' },

  // ── September 2026 ──
  '2026-09-06': { occasion: 'Education Sunday', theme: 'Education for Transformation of Life' },
  '2026-09-13': { occasion: 'Sevika Sangham Day', theme: 'Women who Trust God: Fearless and Faithful' },
  '2026-09-20': { occasion: 'Senior Citizen Sunday', theme: 'Productive Living: The Best is Yet to Come' },
  '2026-09-21': { occasion: "St. Matthew's Day" },
  '2026-09-27': { theme: "God's Unfailing Presence in Crises" },

  // ── October 2026 ──
  '2026-10-04': { occasion: "Voluntary Evangelists' Association Day (MTVEA)", theme: 'Members of the Church: Ministers of the Kingdom of God' },
  '2026-10-11': { occasion: 'Day of the Differently Abled', theme: "Sufficiency of God's Grace" },
  '2026-10-18': { occasion: 'Youth Sunday', theme: 'Unshaken Faith Life in a Fleeting World' },
  '2026-10-25': { occasion: 'Christian Family Dedication Sunday', theme: 'Family: Celebration of Relationships' },

  // ── November 2026 ──
  '2026-11-01': { occasion: 'World Sunday School Day — Kudosh Eetho (Beginning of the Liturgical Year)', theme: 'Be the Children of Light' },
  '2026-11-08': { occasion: 'Hudos Eetho — Renewal of the Church', theme: 'United in Christ: Witnessing to the World' },
  '2026-11-15': { occasion: 'Annunciation to Zechariah', theme: "God's Salvific Intervention" },
  '2026-11-22': { occasion: 'Annunciation to Virgin Mary — Diaspora Sunday', theme: 'Call to be the Mother of Jesus Christ, the Savior of the World' },
  '2026-11-29': { occasion: 'Meeting of Virgin Mary and Elizabeth', theme: 'Transcending Adversity with Hope' },
  '2026-11-30': { occasion: "St. Andrew's Day" },

  // ── December 2026 ──
  '2026-12-01': { occasion: 'Beginning of the 25-day Lent' },
  '2026-12-06': { occasion: 'Bible Sunday — Birth of St. John the Baptist', theme: 'Word-oriented Wisdom and Discernment' },
  '2026-12-13': { occasion: 'Annunciation to Joseph', theme: "Embracing God's Plan" },
  '2026-12-20': { theme: 'Incarnated Word' },
  '2026-12-21': { occasion: 'Mar Thoma Church Day (Sabha Dinam)' },
  '2026-12-25': { occasion: 'Christmas — Feast of Nativity (Yaldo)', theme: 'Christmas: The Light for All People' },
  '2026-12-27': { theme: 'The Glorious Appearance of our Lord' },
  '2026-12-31': { occasion: "New Year's Eve (Watch Night)", theme: "Praising God's Faithfulness" },
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
 * - The weekly (Sunday) theme also applies to the midweek services on
 *   Friday and Tuesday: those days inherit the preceding Sunday's theme
 *   when they have no theme of their own. The result is then marked
 *   { weekly: true }.
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

  const sundayStr = _shiftDateStr(dateStr, day === 5 ? -5 : -2);
  const sunday = LECTIONARY[sundayStr];
  if (!sunday || !sunday.theme) return exact;

  return {
    occasion: exact ? exact.occasion : null,
    theme:    sunday.theme,
    weekly:   true,
  };
}

/**
 * Refresh the lectionary hint for the currently selected date.
 * If an entry with a theme exists and the sermon field is empty, the theme
 * is filled in automatically; the hint stays visible either way so the
 * user can tap it to (re)apply the theme.
 */
export function updateLectionaryHint() {
  const hint   = document.getElementById('lectionaryHint');
  const sermon = document.getElementById('sermon');
  if (!hint || !sermon) return;

  const entry = getLectionaryEntry(document.getElementById('date').value);
  if (!entry) {
    hint.style.display = 'none';
    return;
  }

  const parts = [];
  if (entry.occasion) parts.push(entry.occasion);
  if (entry.theme) {
    parts.push(entry.weekly ? t('weeklyTheme') + ': ' + entry.theme : entry.theme);
  }
  hint.textContent   = '📖 ' + parts.join(' — ');
  hint.title         = entry.theme ? t('lectionaryTapHint') : '';
  hint.style.display = 'block';

  if (entry.theme && !sermon.value.trim()) sermon.value = entry.theme;
}

/** Fill the sermon field with the lectionary theme for the selected date. */
export function applyLectionaryTheme() {
  const entry = getLectionaryEntry(document.getElementById('date').value);
  if (!entry || !entry.theme) return;
  document.getElementById('sermon').value = entry.theme;
  triggerHaptic('light');
}
