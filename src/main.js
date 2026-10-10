// Entry point — imports all modules and wires up the app.

import { updateLanguage, toggleLanguage }                       from './language.js';
import { updateChapterOptions, updateVerseOptions }             from './scripture.js';
import { changeMale, changeFemale, newRecord, addToRoundTotal,
         removeRound, clearRounds, loadRounds, loadLiveCounts,
         tapCounterBox, displayRounds, toggleRoundsExpanded }   from './counter.js';
import { saveRecord, displayHistory, loadRecord, deleteRecord,
         filterHistory }                                        from './history.js';
import { toggleDarkMode, initDarkMode, installApp,
         closeInstallPrompt, initInstallPrompt,
         showUpdateNotification, closeUpdateNotification,
         applyUpdate, updateOnlineStatus,
         registerServiceWorker, setTabSwitchCallback,
         switchTab, initWakeLock, initVersionLine,
         checkForUpdates }                                      from './ui.js';
import { openCelebrantManager, closeCelebrantManager,
         addCelebrant, deleteCelebrant, toggleCoCelebrants,
         initCoCelebrantsToggle, updateCelebrantDatalist,
         displayCelebrantList }      from './celebrants.js';
import { openParishManager, closeParishManager,
         addParish, deleteParish, updateParishDatalist,
         displayParishList }                                    from './parishes.js';
import { exportData, shareToWhatsApp, exportPDF,
         exportCSV, exportBackupJSON, importBackup }            from './export.js';
import { displayStats, setStatsPeriod, shiftStatsPeriod,
         exportStatsCSV, setStatsParish, shareStatsReport,
         exportStatsPDF }                                       from './stats.js';
import { updateLectionaryHint, applyLectionaryTheme }           from './lectionary.js';
import { openAssist, closeAssist, resetAssist,
         changeAssistDirection, assistAddMale, assistAddFemale,
         assistStageTap, assistTagPerson, toggleAssistChildren,
         assistAddDelta, openAssistGuide, closeAssistGuide }    from './assist.js';
import { initServiceDetails, refreshServiceSummary }           from './details.js';
import { toggleCountingLock, isCountingLocked,
         refreshCountingLock }                                  from './lock.js';
import { initCloud, connectCloud, disconnectCloud, backupNow,
         restoreFromCloud, toggleCloudAuto, renderCloudCard }   from './cloud.js';

import { injectIconSprite }                                  from './icons.js';

// Icons first: markup and every render below reference them.
injectIconSprite();

// Wire switchTab to also trigger renders.
setTabSwitchCallback(tab => {
  if (tab === 'history') { displayHistory(); renderCloudCard(); }
  if (tab === 'stats')   displayStats();
});

// Re-render dynamic views in the new language.
// Undo put back an earlier snapshot of the stored data: reload everything
// that shows it.
document.addEventListener('mtc:data-restored', () => {
  loadLiveCounts();
  loadRounds();
  updateCelebrantDatalist();
  updateParishDatalist();
  displayHistory();
  if (document.getElementById('celebrantManager').classList.contains('show')) displayCelebrantList();
  if (document.getElementById('parishManager').classList.contains('show')) displayParishList();
  if (document.getElementById('statsTab').classList.contains('active')) displayStats();
  refreshServiceSummary();
});

document.addEventListener('mtc:language-changed', () => {
  refreshCountingLock();
  displayRounds();
  if (document.getElementById('statsTab').classList.contains('active')) displayStats();
  if (document.getElementById('historyTab').classList.contains('active')) { displayHistory(); renderCloudCard(); }
});

// Expose everything called from inline HTML onclick handlers.
Object.assign(window, {
  toggleCountingLock,
  changeMale, changeFemale, newRecord, addToRoundTotal,
  removeRound, clearRounds, tapCounterBox, toggleRoundsExpanded,
  saveRecord, loadRecord, deleteRecord, filterHistory,
  switchTab,
  toggleDarkMode, installApp, closeInstallPrompt,
  showUpdateNotification, closeUpdateNotification, applyUpdate,
  checkForUpdates,
  toggleLanguage,
  openCelebrantManager, closeCelebrantManager,
  addCelebrant, deleteCelebrant, toggleCoCelebrants,
  openParishManager, closeParishManager,
  addParish, deleteParish,
  exportData, shareToWhatsApp, exportPDF,
  exportCSV, exportBackupJSON, importBackup,
  displayStats, setStatsPeriod, shiftStatsPeriod, exportStatsCSV,
  setStatsParish, shareStatsReport, exportStatsPDF,
  applyLectionaryTheme,
  openAssist, closeAssist, resetAssist, changeAssistDirection,
  assistAddMale, assistAddFemale, assistStageTap, assistTagPerson,
  toggleAssistChildren, assistAddDelta, openAssistGuide, closeAssistGuide,
  connectCloud, disconnectCloud, backupNow, restoreFromCloud, toggleCloudAuto,
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
  if (isCountingLocked()) return; // no tab switching while counting is locked
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
  loadLiveCounts();
  loadRounds();
  initWakeLock();
  updateCelebrantDatalist();
  updateParishDatalist();
  displayHistory();
  initCloud();
  initServiceDetails();

  // Keyboard support for the toggle switches (role="switch").
  const keyToggle = (id, fn) => document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn(e); }
  });
  keyToggle('coCelebrantsToggle', () => toggleCoCelebrants());
  keyToggle('assistChildToggle', e => toggleAssistChildren(e));

  // Keyboard support for the tap-anywhere counter boxes.
  [['maleBox', 'male'], ['femaleBox', 'female']].forEach(([id, which]) => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tapCounterBox({ currentTarget: e.currentTarget }, which);
      }
    });
  });

  // Sabha lectionary: suggest the sermon theme for the selected date.
  updateLectionaryHint();
  document.getElementById('date').addEventListener('change', updateLectionaryHint);

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
initVersionLine();

// Ask the browser not to evict our data (attendance history lives in
// localStorage). Best-effort: ignored where unsupported or denied.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then(persisted => { if (!persisted) return navigator.storage.persist(); })
    .catch(() => {});
}
