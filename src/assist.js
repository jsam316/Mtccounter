// Count Assist (Beta) — on-device camera people counting as a cross-check.
//
// A person detector (TensorFlow.js + COCO-SSD lite, vendored) runs on the
// live camera feed and counts people crossing a virtual center line in the
// chosen direction. Everything runs on the device: no frames are stored or
// uploaded. The assist count is display-only and is NEVER written into
// attendance records.
//
// The detection model (~6 MB) downloads from Google's model CDN on first
// use and is then cached in IndexedDB, so later sessions work offline.

import { t } from './translations.js';
import { triggerHaptic } from './haptic.js';
import { getMale, getFemale, getRounds } from './counter.js';

const MODEL_IDB_URL = 'indexeddb://mtc-coco-ssd-lite';
const DETECT_INTERVAL_MS = 180;
const TRACK_EXPIRY_MS = 1500;

/**
 * Line-crossing counter over per-frame person detections.
 * Pure logic (no DOM) so it can be unit-tested.
 *
 * direction: 'lr' | 'rl' | 'both' — which crossings of the vertical
 * center line increment the count. Each tracked person counts at most
 * once while their track is alive.
 */
export function createLineCounter(direction = 'lr') {
  const tracks = [];
  let nextId = 1;
  let count = 0;

  return {
    get count() { return count; },

    /** persons: [{x, y}] centroids in frame pixels. Returns running count. */
    update(persons, frameWidth, now) {
      const lineX = frameWidth / 2;
      const maxMatchDist = frameWidth * 0.22;

      for (const p of persons) {
        let best = null;
        let bestDist = Infinity;
        for (const tr of tracks) {
          if (tr.matched) continue;
          const d = Math.hypot(tr.x - p.x, tr.y - p.y);
          if (d < bestDist) { bestDist = d; best = tr; }
        }

        if (best && bestDist <= maxMatchDist) {
          const prevX = best.x;
          best.x = p.x; best.y = p.y;
          best.lastSeen = now; best.matched = true;
          if (!best.counted) {
            const crossedLR = prevX < lineX && p.x >= lineX;
            const crossedRL = prevX > lineX && p.x <= lineX;
            if ((direction === 'lr' && crossedLR)
              || (direction === 'rl' && crossedRL)
              || (direction === 'both' && (crossedLR || crossedRL))) {
              best.counted = true;
              count++;
            }
          }
        } else {
          tracks.push({ id: nextId++, x: p.x, y: p.y, lastSeen: now, counted: false, matched: true });
        }
      }

      for (let i = tracks.length - 1; i >= 0; i--) {
        tracks[i].matched = false;
        if (now - tracks[i].lastSeen > TRACK_EXPIRY_MS) tracks.splice(i, 1);
      }
      return count;
    },

    reset() { count = 0; tracks.length = 0; },
  };
}

// ── Runtime state ─────────────────────────────────────────────────────────────

let _model = null;
let _stream = null;
let _running = false;
let _loopTimer = null;
let _manualTimer = null;
let _tracker = null;
let _libsLoader = null;

function _inject(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
}

function _loadLibs() {
  if (window.cocoSsd) return Promise.resolve();
  if (!_libsLoader) {
    _libsLoader = _inject('./vendor/tf.min.js')
      .then(() => _inject('./vendor/coco-ssd.min.js'))
      .catch(err => { _libsLoader = null; throw err; });
  }
  return _libsLoader;
}

function _withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function _loadModel(setStatus) {
  if (_model) return;
  await _loadLibs();
  try {
    // Cached copy from a previous session (works offline).
    _model = await window.cocoSsd.load({ modelUrl: MODEL_IDB_URL });
  } catch {
    setStatus(t('assistDownloading'));
    // Time-box the download so a stalled connection surfaces an error
    // instead of an endless "downloading" state.
    _model = await _withTimeout(window.cocoSsd.load({ base: 'lite_mobilenet_v2' }), 45000);
    try { await _model.model.save(MODEL_IDB_URL); } catch { /* cache is best-effort */ }
  }
}

function _manualTotal() {
  let male = getMale();
  let female = getFemale();
  getRounds().forEach(r => { male += r.male; female += r.female; });
  return male + female;
}

function _setStatus(msg) {
  const el = document.getElementById('assistStatus');
  el.textContent = msg;
  el.style.display = msg ? 'flex' : 'none';
}

// ── Public UI entry points (wired to window by main.js) ───────────────────────

export async function openAssist() {
  const overlay = document.getElementById('assistOverlay');
  overlay.classList.add('show');
  document.getElementById('assistCount').textContent = '0';
  document.getElementById('assistManualVal').textContent = _manualTotal();
  _manualTimer = setInterval(() => {
    document.getElementById('assistManualVal').textContent = _manualTotal();
  }, 1000);

  try {
    _setStatus(t('assistLoading'));
    await _loadModel(_setStatus);
  } catch {
    _setStatus(t('assistModelError'));
    return;
  }

  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 } },
      audio: false,
    });
  } catch {
    _setStatus(t('assistCameraError'));
    return;
  }

  const video = document.getElementById('assistVideo');
  video.srcObject = _stream;
  await video.play();
  _setStatus('');

  _tracker = createLineCounter(document.getElementById('assistDirection').value);
  _running = true;
  triggerHaptic('light');
  _detectLoop();
}

export function closeAssist() {
  _running = false;
  if (_loopTimer) { clearTimeout(_loopTimer); _loopTimer = null; }
  if (_manualTimer) { clearInterval(_manualTimer); _manualTimer = null; }
  if (_stream) {
    _stream.getTracks().forEach(tr => tr.stop());
    _stream = null;
  }
  const video = document.getElementById('assistVideo');
  video.srcObject = null;
  document.getElementById('assistOverlay').classList.remove('show');
  triggerHaptic('light');
}

export function resetAssist() {
  if (_tracker) _tracker.reset();
  document.getElementById('assistCount').textContent = '0';
  triggerHaptic('light');
}

export function changeAssistDirection() {
  // New direction starts a fresh count — old crossings used the old rule.
  _tracker = createLineCounter(document.getElementById('assistDirection').value);
  document.getElementById('assistCount').textContent = '0';
}

// ── Detection loop ────────────────────────────────────────────────────────────

async function _detectLoop() {
  if (!_running) return;
  const video = document.getElementById('assistVideo');

  if (video.readyState >= 2 && video.videoWidth > 0) {
    let predictions = [];
    try {
      predictions = await _model.detect(video, 20, 0.45);
    } catch { /* skip frame */ }

    const persons = predictions
      .filter(p => p.class === 'person')
      .map(p => ({
        x: p.bbox[0] + p.bbox[2] / 2,
        y: p.bbox[1] + p.bbox[3] / 2,
        bbox: p.bbox,
      }));

    if (_tracker) {
      const count = _tracker.update(persons, video.videoWidth, performance.now());
      document.getElementById('assistCount').textContent = count;
    }
    _drawOverlay(persons, video);
  }

  _loopTimer = setTimeout(_detectLoop, DETECT_INTERVAL_MS);
}

function _drawOverlay(persons, video) {
  const canvas = document.getElementById('assistCanvas');
  const w = video.clientWidth;
  const h = video.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const scaleX = w / video.videoWidth;
  const scaleY = h / video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Counting line
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Person boxes
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
  ctx.lineWidth = 2;
  for (const p of persons) {
    const [bx, by, bw, bh] = p.bbox;
    ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
  }
}
