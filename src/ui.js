import { KEYS, getString, setString, remove } from './state.js';
import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { showSuccessMsg } from './utils.js';

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
let _registration = null;

export function showUpdateNotification() {
  document.getElementById('updateNotification').classList.add('show');
  triggerHaptic('light');
}

export function closeUpdateNotification() {
  document.getElementById('updateNotification').classList.remove('show');
}

export function applyUpdate() {
  closeUpdateNotification();
  _activateNewWorker();
}

// Tell the waiting worker to take over. The inline controllerchange
// listener in index.html reloads the page once it does; the flag lets that
// listener distinguish a requested update from a first-install claim.
function _activateNewWorker() {
  if (!_newWorker) return;
  window.__mtcApplyingUpdate = true;
  _newWorker.postMessage({ type: 'SKIP_WAITING' });
}

// An update discovered this soon after the page loaded means the user just
// launched or refreshed the app and is not mid-count: apply it immediately so
// "refresh" behaves as people expect. Later updates wait for consent.
const AUTO_APPLY_WINDOW_MS = 10000;

function _onNewWorkerReady() {
  if (performance.now() < AUTO_APPLY_WINDOW_MS) {
    _activateNewWorker();
  } else {
    showUpdateNotification();
  }
}

// ── Version line & manual reload ──────────────────────────────────────────────

/** Show the running build in the footer, asked from the controlling worker. */
export function initVersionLine() {
  const el = document.getElementById('appVersion');
  if (!el) return;
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') {
    el.textContent = 'dev';
    return;
  }
  const query = () => {
    const ctrl = navigator.serviceWorker.controller;
    if (!ctrl) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = e => { if (e.data && e.data.version) el.textContent = e.data.version; };
    ctrl.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  };
  query();
  navigator.serviceWorker.addEventListener('controllerchange', query);
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'CACHE_UPDATED' && e.data.version) el.textContent = e.data.version;
  });
  // No worker took control (registration failed / blocked): say so honestly.
  setTimeout(() => { if (el.textContent === '…') el.textContent = '—'; }, 5000);
}

/**
 * Footer "Reload": check for a new version right now. If one is found it is
 * applied (the page reloads into it); otherwise confirm we're current and
 * reload anyway so the button always visibly does something.
 */
export async function checkForUpdates() {
  const btn = document.querySelector('.app-reload-btn');
  if (btn) btn.disabled = true;
  triggerHaptic('light');
  try {
    if (_registration && navigator.onLine) {
      showSuccessMsg(t('checkingUpdates'), 6000);
      await _registration.update();
      const worker = _registration.installing || _registration.waiting;
      if (worker) {
        // Let a freshly discovered worker finish installing (or fail).
        await new Promise(resolve => {
          const done = () => { worker.removeEventListener('statechange', done); resolve(); };
          if (worker.state !== 'installing') return resolve();
          worker.addEventListener('statechange', done);
          setTimeout(done, 8000);
        });
        if (worker.state === 'installed' || worker.state === 'activating' || worker.state === 'activated') {
          _newWorker = worker;
          _activateNewWorker(); // controllerchange → reload into the new version
          return;
        }
      }
      showSuccessMsg(t('upToDate'), 1200);
    }
  } catch { /* fall through to a plain reload */ }
  setTimeout(() => window.location.reload(), 700);
}

export function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  const indicator = document.getElementById('offlineIndicator');
  if (isOnline) {
    indicator.classList.add('online');
    indicator.innerHTML = '<span>🟢</span><span>' + t('online') + '</span>';
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 3000);
  } else {
    indicator.classList.remove('online');
    indicator.innerHTML = '<span>🔴</span><span>' + t('offline') + '</span>';
    indicator.classList.add('show');
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        _registration = registration;
        // An update may already be waiting (downloaded on a previous visit
        // but not yet applied). Offer it again.
        if (registration.waiting && navigator.serviceWorker.controller) {
          _newWorker = registration.waiting;
          _onNewWorkerReady();
        }
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              _newWorker = worker;
              _onNewWorkerReady();
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
