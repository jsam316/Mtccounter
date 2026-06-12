import { KEYS, getString, setString, remove } from './state.js';
import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';

// Callback wired by main.js to avoid circular deps.
let _onTabSwitch = null;
export function setTabSwitchCallback(cb) { _onTabSwitch = cb; }

export function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', (tab === 'counter' && i === 0)
      || (tab === 'history' && i === 1)
      || (tab === 'stats'   && i === 2));
  });
  document.getElementById('counterTab').classList.toggle('active', tab === 'counter');
  document.getElementById('historyTab').classList.toggle('active', tab === 'history');
  document.getElementById('statsTab').classList.toggle('active',   tab === 'stats');

  if (_onTabSwitch) _onTabSwitch(tab);

  // Keep the screen awake only while counting.
  if (tab === 'counter') _requestWakeLock();
  else _releaseWakeLock();

  triggerHaptic('light');
}

// ── Screen wake lock (keeps the display on during a count) ───────────────────

let _wakeLock = null;

async function _requestWakeLock() {
  if (!('wakeLock' in navigator) || _wakeLock) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    // The browser releases the lock automatically when the page is hidden.
    _wakeLock.addEventListener('release', () => { _wakeLock = null; });
  } catch {
    _wakeLock = null; // denied (e.g. low battery) — not critical
  }
}

function _releaseWakeLock() {
  if (_wakeLock) {
    _wakeLock.release().catch(() => {});
    _wakeLock = null;
  }
}

export function initWakeLock() {
  _requestWakeLock(); // counter is the initial tab
  document.addEventListener('visibilitychange', () => {
    const counterActive = document.getElementById('counterTab')?.classList.contains('active');
    if (!document.hidden && counterActive) _requestWakeLock();
  });
}

export function toggleDarkMode() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  const btn = document.querySelector('.dark-mode-toggle');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
  setString(KEYS.darkMode, isLight ? 'disabled' : 'enabled');
  triggerHaptic('light');
}

export function initDarkMode() {
  if (getString(KEYS.darkMode) === 'disabled') {
    document.body.classList.add('light-mode');
    const btn = document.querySelector('.dark-mode-toggle');
    if (btn) btn.textContent = '🌙';
  }
}

let _deferredPrompt = null;

export function initInstallPrompt() {
  if (getString(KEYS.installPromptDismissed) === 'true') {
    window.addEventListener('beforeinstallprompt', e => e.preventDefault());
    return;
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        document.getElementById('installPrompt').classList.add('show');
      }
    }, 3000);
  });
}

export function installApp() {
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(result => {
      _deferredPrompt = null;
      closeInstallPrompt();
    });
  }
}

export function closeInstallPrompt() {
  document.getElementById('installPrompt').classList.remove('show');
  setString(KEYS.installPromptDismissed, 'true');
}

let _newWorker = null;

export function showUpdateNotification() {
  document.getElementById('updateNotification').classList.add('show');
  triggerHaptic('light');
}

export function closeUpdateNotification() {
  document.getElementById('updateNotification').classList.remove('show');
}

export function applyUpdate() {
  if (_newWorker) _newWorker.postMessage({ type: 'SKIP_WAITING' });
  closeUpdateNotification();
}

export function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  const indicator = document.getElementById('offlineIndicator');
  if (isOnline) {
    indicator.classList.add('online');
    indicator.innerHTML = '<span>🟢</span><span>' + t('online') + '</span>';
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 3000);
    syncData();
  } else {
    indicator.classList.remove('online');
    indicator.innerHTML = '<span>🔴</span><span>' + t('offline') + '</span>';
    indicator.classList.add('show');
  }
}

export function syncData() {
  const syncStatus = document.getElementById('syncStatus');
  const span = syncStatus.querySelector('[data-i18n="syncing"]');
  if (span) span.textContent = t('syncing');
  syncStatus.classList.add('show');
  setTimeout(() => {
    syncStatus.innerHTML = '<span>✓</span><span>' + t('synced') + '</span>';
    syncStatus.style.background = 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
    setTimeout(() => {
      syncStatus.classList.remove('show');
      syncStatus.innerHTML = '<span>🔄</span><span data-i18n="syncing">' + t('syncing') + '</span>';
      syncStatus.style.background = 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)';
    }, 2000);
  }, 1000);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        // An update may already be waiting (downloaded on a previous visit
        // but not yet applied). Offer it again.
        if (registration.waiting && navigator.serviceWorker.controller) {
          _newWorker = registration.waiting;
          showUpdateNotification();
        }
        registration.addEventListener('updatefound', () => {
          _newWorker = registration.installing;
          _newWorker.addEventListener('statechange', () => {
            if (_newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateNotification();
            }
          });
        });
        setInterval(() => registration.update(), 60000);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) registration.update();
        });
      })
      .catch(err => console.log('Service Worker registration failed:', err));

    // controllerchange → reload is handled by the inline script in index.html
    // so it fires even when this module fails to load.
  });
}
