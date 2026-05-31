// Entry point — imports all modules and wires up the app.

import { updateLanguage, toggleLanguage }                       from './language.js';
import { updateChapterOptions, updateVerseOptions }             from './scripture.js';
import { changeMale, changeFemale, newRecord, addToRoundTotal,
         removeRound, clearRounds, loadRounds }                 from './counter.js';
import { saveRecord, displayHistory, loadRecord, deleteRecord,
         filterHistory }                                        from './history.js';
import { toggleDarkMode, initDarkMode, installApp,
         closeInstallPrompt, initInstallPrompt,
         showUpdateNotification, closeUpdateNotification,
         applyUpdate, updateOnlineStatus, syncData,
         registerServiceWorker, setTabSwitchCallback,
         switchTab }                                            from './ui.js';
import { openCelebrantManager, closeCelebrantManager,
         addCelebrant, deleteCelebrant, toggleCoCelebrants,
         initCoCelebrantsToggle, updateCelebrantDatalist }      from './celebrants.js';
import { openParishManager, closeParishManager,
         addParish, deleteParish, updateParishDatalist }        from './parishes.js';
import { exportData, shareToWhatsApp, exportPDF,
         exportCSV, exportBackupJSON, importBackup }            from './export.js';
import { displayStats }                                         from './stats.js';

// Wire switchTab to also trigger renders.
setTabSwitchCallback(tab => {
  if (tab === 'history') displayHistory();
  if (tab === 'stats')   displayStats();
});

// Expose everything called from inline HTML onclick handlers.
Object.assign(window, {
  changeMale, changeFemale, newRecord, addToRoundTotal,
  removeRound, clearRounds,
  saveRecord, loadRecord, deleteRecord, filterHistory,
  switchTab,
  toggleDarkMode, installApp, closeInstallPrompt,
  showUpdateNotification, closeUpdateNotification, applyUpdate,
  syncData,
  toggleLanguage,
  openCelebrantManager, closeCelebrantManager,
  addCelebrant, deleteCelebrant, toggleCoCelebrants,
  openParishManager, closeParishManager,
  addParish, deleteParish,
  exportData, shareToWhatsApp, exportPDF,
  exportCSV, exportBackupJSON, importBackup,
  displayStats,
});

// ── Initialisation ────────────────────────────────────────────────────────────

// Set today's date immediately (before DOMContentLoaded since the element exists).
document.getElementById('date').valueAsDate = new Date();

// Swipe detection state.
let touchStartX = 0, touchEndX = 0, touchStartY = 0, touchEndY = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  _handleSwipe();
}, { passive: true });

function _handleSwipe() {
  const swipeDist = touchEndX - touchStartX;
  const vertDist  = Math.abs(touchEndY - touchStartY);
  if (vertDist >= 100 || Math.abs(swipeDist) <= 100) return;

  const isCounter = document.getElementById('counterTab').classList.contains('active');
  const isHistory = document.getElementById('historyTab').classList.contains('active');
  const isStats   = document.getElementById('statsTab').classList.contains('active');

  if (swipeDist > 0) {
    if (isHistory) { switchTab('counter'); _showSwipeIndicator('right'); }
    else if (isStats) { switchTab('history'); _showSwipeIndicator('right'); }
  } else {
    if (isCounter) { switchTab('history'); _showSwipeIndicator('left'); }
    else if (isHistory) { switchTab('stats'); _showSwipeIndicator('left'); }
  }
}

function _showSwipeIndicator(direction) {
  const el = document.getElementById('swipe' + (direction === 'left' ? 'Left' : 'Right'));
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 500);
}

// Online/offline listeners.
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
setTimeout(() => { if (!navigator.onLine) updateOnlineStatus(); }, 1000);

document.addEventListener('DOMContentLoaded', () => {
  updateLanguage();
  initDarkMode();
  initInstallPrompt();
  initCoCelebrantsToggle();
  loadRounds();
  updateCelebrantDatalist();
  updateParishDatalist();
  displayHistory();

  // Scripture cascade selectors.
  document.getElementById('book').addEventListener('change', function () {
    updateChapterOptions(this.value);
  });
  document.getElementById('chapter').addEventListener('change', function () {
    const book = document.getElementById('book').value;
    updateVerseOptions(book, parseInt(this.value, 10));
  });

  // Enter key support for manager inputs.
  document.getElementById('newCelebrantName')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') addCelebrant();
  });
  document.getElementById('newParishName')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') addParish();
  });
});

registerServiceWorker();
