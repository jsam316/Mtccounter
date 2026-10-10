// Line icons used across the app (24×24, stroked with currentColor so they
// take the colour of the text around them). Emoji looked different on every
// phone and clashed with each other; these render the same everywhere.
//
// injectIconSprite() adds them to the page once as <symbol>s; markup then
// uses <svg class="icon"><use href="#i-NAME"/></svg>, or icon('NAME') from JS.

export const ICONS = {
  tally:     '<path d="M4 4v16M9 4v16M14 4v16M19 4v16"/><path d="M2 17 22 7"/>',
  calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart:     '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V7M18 17v-8"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  lock:      '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock:    '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  minus:     '<path d="M5 12h14"/>',
  x:         '<path d="M18 6 6 18M6 6l12 12"/>',
  user:      '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  users:     '<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M16 3.13a4 4 0 0 1 0 7.75M22 21v-1a5 5 0 0 0-4-4.9"/>',
  camera:    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  layers:    '<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
  save:      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  filePlus:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
  fileText:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  fileDown:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6M9 15l3 3 3-3"/>',
  message:   '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8z"/>',
  share:     '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  trash:     '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  pencil:    '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  sun:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  chevronR:  '<path d="m9 18 6-6-6-6"/>',
  chevronL:  '<path d="m15 18-6-6 6-6"/>',
  sliders:   '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  table:     '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  cloud:     '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z"/>',
  church:    '<path d="M12 2v4M10 4h4M6 22V11l6-5 6 5v11M2 22h20M10 22v-4a2 2 0 0 1 4 0v4"/>',
  trendUp:   '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  activity:  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
};

/** Inline markup for one icon, e.g. icon('save'). */
export function icon(name, extraClass = '') {
  return '<svg class="icon' + (extraClass ? ' ' + extraClass : '') + '" aria-hidden="true" focusable="false">'
    + '<use href="#i-' + name + '"></use></svg>';
}

/** Add the icon definitions to the page (once). */
export function injectIconSprite(doc = document) {
  if (doc.getElementById('iconSprite')) return;
  const symbols = Object.entries(ICONS).map(([name, body]) =>
    '<symbol id="i-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</symbol>').join('');
  const holder = doc.createElement('div');
  holder.innerHTML = '<svg id="iconSprite" xmlns="http://www.w3.org/2000/svg" style="display:none">' + symbols + '</svg>';
  doc.body.prepend(holder.firstChild);
}
