// Cloud backup — automatic backup of records to the user's own cloud
// storage, with merge-on-restore so several devices can converge.
//
// Provider design: a provider exposes { connect, disconnect, upload,
// download } over a single backup JSON document. Google Drive (app-data
// folder, hidden from the user's normal files) is implemented below; a
// second provider (e.g. Firebase) can be added with the same shape.
//
// The backup document is the same shape as the manual Backup/Restore file
// (see export.js buildBackupPayload), so the two paths stay compatible.

import { save, load, KEYS } from './state.js';
import { t } from './translations.js';
import { showSuccessMsg, escapeHtml } from './utils.js';
import { triggerHaptic } from './haptic.js';
import { getHistory, saveHistory, displayHistory } from './history.js';
import { updateCelebrantDatalist } from './celebrants.js';
import { updateParishDatalist } from './parishes.js';
import { buildBackupPayload } from './export.js';
import { GOOGLE_CLIENT_ID } from './config.js';

// ── Merge (pure, unit-tested) ─────────────────────────────────────────────────

/**
 * Merge a remote backup into local data. Records are keyed by date; when
 * both sides have the same date the newer `timestamp` wins. Name lists are
 * unioned. Nothing is ever deleted by a merge.
 * Returns { history, celebrants, parishes, changed } where `changed` is the
 * number of records added or replaced from the remote side.
 */
export function mergeBackups(local, remote) {
  const byDate = new Map();
  for (const r of local.history || []) if (r && r.date) byDate.set(r.date, r);

  let changed = 0;
  for (const r of remote.history || []) {
    if (!r || !r.date) continue;
    const cur = byDate.get(r.date);
    if (!cur) { byDate.set(r.date, r); changed++; continue; }
    const curTs = Date.parse(cur.timestamp || 0) || 0;
    const remTs = Date.parse(r.timestamp || 0) || 0;
    if (remTs > curTs) { byDate.set(r.date, r); changed++; }
  }

  const history = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])].filter(Boolean))].sort();
  return {
    history,
    celebrants: union(local.celebrants, remote.celebrants),
    parishes:   union(local.parishes, remote.parishes),
    changed,
  };
}

// ── Google Drive provider ─────────────────────────────────────────────────────

const CLIENT_ID = (typeof window !== 'undefined' && window.__MTC_GOOGLE_CLIENT_ID) || GOOGLE_CLIENT_ID;
const FILE_NAME = 'mtc-counter-backup.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'mtcCloudToken'; // sessionStorage: survives reloads, not sessions

let _token = null;
let _tokenExpiresAt = 0;

function _loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('gis-load-failed')); };
    document.head.appendChild(s);
  });
}

function _restoreToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (saved && saved.token && saved.expiresAt > Date.now()) {
      _token = saved.token; _tokenExpiresAt = saved.expiresAt;
    }
  } catch { /* ignore */ }
}

function _storeToken(token, expiresInSec) {
  _token = token;
  _tokenExpiresAt = Date.now() + (expiresInSec * 1000);
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: _tokenExpiresAt })); } catch { /* ignore */ }
}

function _clearToken() {
  _token = null; _tokenExpiresAt = 0;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

/**
 * Get an access token. `interactive` shows the Google consent prompt;
 * otherwise a silent request is attempted (works when the user already
 * consented and is signed in; must run close to a user gesture).
 */
async function _getToken(interactive) {
  if (_token && Date.now() < _tokenExpiresAt - 60000) return _token;
  await _loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: resp => {
        if (!resp || resp.error) { reject(new Error(resp?.error || 'auth-failed')); return; }
        _storeToken(resp.access_token, Number(resp.expires_in) || 3600);
        resolve(_token);
      },
      error_callback: err => reject(new Error(err?.type || 'auth-failed')),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function _driveFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) },
  });
  if (res.status === 401) { _clearToken(); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error('drive-' + res.status);
  return res;
}

async function _findFile(token) {
  const q = encodeURIComponent("name='" + FILE_NAME + "'");
  const res = await _driveFetch(token,
    DRIVE_API + '/files?spaces=appDataFolder&q=' + q + '&fields=files(id,modifiedTime)&pageSize=1');
  const data = await res.json();
  return (data.files && data.files[0]) || null;
}

async function _uploadFile(token, fileId, payload) {
  const body = JSON.stringify(payload);
  if (fileId) {
    const res = await _driveFetch(token,
      DRIVE_UPLOAD + '/files/' + fileId + '?uploadType=media&fields=id',
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    return (await res.json()).id || fileId;
  }
  const boundary = 'mtc' + Date.now();
  const multipart =
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
    + JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) + '\r\n'
    + '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n'
    + body + '\r\n--' + boundary + '--';
  const res = await _driveFetch(token,
    DRIVE_UPLOAD + '/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart });
  return (await res.json()).id;
}

async function _downloadFile(token, fileId) {
  const res = await _driveFetch(token, DRIVE_API + '/files/' + fileId + '?alt=media');
  return res.json();
}

const gdriveProvider = {
  id: 'gdrive',
  isConfigured: () => !!CLIENT_ID,
  connect: () => _getToken(true),
  disconnect: () => {
    const tok = _token;
    _clearToken();
    try { if (tok && window.google?.accounts?.oauth2?.revoke) window.google.accounts.oauth2.revoke(tok, () => {}); } catch { /* ignore */ }
  },
  async upload(payload, fileId) {
    const token = await _getToken(false);
    const id = fileId || (await _findFile(token))?.id || null;
    return _uploadFile(token, id, payload);
  },
  async download(fileId) {
    const token = await _getToken(false);
    const id = fileId || (await _findFile(token))?.id;
    if (!id) return { fileId: null, payload: null };
    return { fileId: id, payload: await _downloadFile(token, id) };
  },
};

const provider = gdriveProvider;

// ── Orchestration ─────────────────────────────────────────────────────────────

function _getState() {
  return load(KEYS.cloud, { connected: false, autoBackup: true, lastBackupAt: null, pending: false, fileId: null });
}

function _setState(patch) {
  const s = { ..._getState(), ...patch };
  try { save(KEYS.cloud, s); } catch { /* best-effort */ }
  renderCloudCard();
  return s;
}

let _uploading = false;
let _dirty = false;
let _busyLabel = null; // transient status text while working

export function isCloudConfigured() { return provider.isConfigured(); }

/** Upload the current data. Silent unless `interactive`. */
export async function backupNow(interactive = false) {
  if (!provider.isConfigured()) return false;
  const st = _getState();
  if (!st.connected) return false;
  if (_uploading) { _dirty = true; return false; }
  if (!navigator.onLine) { _setState({ pending: true }); return false; }

  _uploading = true;
  _busyLabel = t('cloudBackingUp');
  renderCloudCard();
  try {
    const fileId = await provider.upload(buildBackupPayload(), st.fileId);
    _setState({ fileId, lastBackupAt: new Date().toISOString(), pending: false });
    if (interactive) { showSuccessMsg(t('cloudBackupDone'), 2500); triggerHaptic('success'); }
    return true;
  } catch (err) {
    _setState({ pending: true });
    if (interactive) {
      alert(err.message === 'auth-failed' || err.message === 'unauthorized' ? t('cloudAuthFailed') : t('cloudBackupFailed'));
      triggerHaptic('error');
    }
    return false;
  } finally {
    _uploading = false;
    _busyLabel = null;
    renderCloudCard();
    if (_dirty) { _dirty = false; backupNow(false); }
  }
}

/** Sign in, then take a first backup (and offer a restore if this device is empty). */
export async function connectCloud() {
  if (!provider.isConfigured()) return;
  try {
    await provider.connect();
  } catch {
    alert(t('cloudAuthFailed')); triggerHaptic('error'); return;
  }
  _setState({ connected: true });
  triggerHaptic('success');

  // New device with nothing local yet: pull the existing backup first.
  if (getHistory().length === 0) {
    try {
      const { fileId, payload } = await provider.download(null);
      if (payload && payload.data) {
        _setState({ fileId });
        _applyRemote(payload);
        return;
      }
    } catch { /* fall through to a fresh backup */ }
  }
  await backupNow(true);
}

export function disconnectCloud() {
  if (!confirm(t('cloudDisconnectConfirm'))) return;
  provider.disconnect();
  _setState({ connected: false, pending: false, fileId: null, lastBackupAt: null });
  triggerHaptic('light');
}

export async function restoreFromCloud() {
  if (!_getState().connected) return;
  if (!confirm(t('cloudRestoreConfirm'))) return;
  _busyLabel = t('cloudRestoring');
  renderCloudCard();
  try {
    const { fileId, payload } = await provider.download(_getState().fileId);
    if (!payload || !payload.data) { alert(t('cloudNoBackup')); return; }
    _setState({ fileId });
    _applyRemote(payload);
  } catch (err) {
    alert(err.message === 'auth-failed' || err.message === 'unauthorized' ? t('cloudAuthFailed') : t('cloudBackupFailed'));
    triggerHaptic('error');
  } finally {
    _busyLabel = null;
    renderCloudCard();
  }
}

function _applyRemote(payload) {
  const local = {
    history:    getHistory(),
    celebrants: load(KEYS.celebrants, []),
    parishes:   load(KEYS.parishes, []),
  };
  const remote = {
    history:    payload.data.mtcHistory      || [],
    celebrants: payload.data.savedCelebrants || [],
    parishes:   payload.data.savedParishes   || [],
  };
  const merged = mergeBackups(local, remote);
  saveHistory(merged.history);
  save(KEYS.celebrants, merged.celebrants);
  save(KEYS.parishes,   merged.parishes);
  displayHistory();
  updateCelebrantDatalist();
  updateParishDatalist();
  showSuccessMsg(t('cloudRestoreDone').replace('{n}', merged.changed), 3000);
  triggerHaptic('success');
  // The merged set is the new truth — push it back up (silent).
  backupNow(false);
}

export function toggleCloudAuto() {
  const st = _getState();
  _setState({ autoBackup: !st.autoBackup });
  triggerHaptic('light');
  if (!st.autoBackup) backupNow(false);
}

// ── UI ────────────────────────────────────────────────────────────────────────

function _fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
}

export function renderCloudCard() {
  const card = document.getElementById('cloudCard');
  if (!card) return;
  const status = document.getElementById('cloudStatus');
  const body = document.getElementById('cloudBody');

  if (!provider.isConfigured()) {
    status.textContent = '';
    body.innerHTML = '<p class="cloud-text">' + t('cloudNotConfigured') + '</p>';
    return;
  }

  const st = _getState();
  if (!st.connected) {
    status.textContent = '';
    body.innerHTML = '<p class="cloud-text">' + t('cloudNotConnected') + '</p>'
      + '<button class="cloud-btn cloud-btn-primary" onclick="connectCloud()">' + t('cloudConnect') + '</button>';
    return;
  }

  let line;
  if (_busyLabel) line = _busyLabel;
  else if (st.pending) line = t('cloudPending');
  else if (st.lastBackupAt) line = t('cloudLastBackup').replace('{t}', escapeHtml(_fmtTime(st.lastBackupAt)));
  else line = t('cloudNeverBacked');
  status.textContent = st.pending ? '⏳' : (_busyLabel ? '…' : '✓');

  body.innerHTML =
    '<p class="cloud-text">' + line + '</p>'
    + '<div class="cloud-auto" onclick="toggleCloudAuto()">'
    +   '<span>' + t('cloudAuto') + '</span>'
    +   '<div class="toggle-switch' + (st.autoBackup ? ' active' : '') + '" role="switch" aria-checked="' + st.autoBackup + '" tabindex="0"><div class="toggle-slider"></div></div>'
    + '</div>'
    + '<div class="cloud-actions">'
    +   '<button class="cloud-btn cloud-btn-primary" onclick="backupNow(true)">' + t('cloudBackupNow') + '</button>'
    +   '<button class="cloud-btn" onclick="restoreFromCloud()">' + t('cloudRestore') + '</button>'
    +   '<button class="cloud-btn cloud-btn-quiet" onclick="disconnectCloud()">' + t('cloudDisconnect') + '</button>'
    + '</div>';
}

export function initCloud() {
  _restoreToken();
  renderCloudCard();

  // Auto-backup whenever records or name lists change.
  document.addEventListener('mtc:data-changed', () => {
    const st = _getState();
    if (st.connected && st.autoBackup) backupNow(false);
  });

  // Flush a pending backup once we're back online.
  window.addEventListener('online', () => {
    const st = _getState();
    if (st.connected && st.pending) backupNow(false);
  });
}
