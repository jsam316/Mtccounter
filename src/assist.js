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
import { getMale, getFemale, getRounds, changeMale, changeFemale } from './counter.js';
import { save, load, KEYS } from './state.js';

const MODEL_IDB_URL = 'indexeddb://mtc-coco-ssd-lite';
const DETECT_INTERVAL_MS = 180;
const TRACK_EXPIRY_MS = 1500;
const MAX_DETECTIONS = 40;
// A crossing only counts if the person has actually travelled this fraction
// of the frame width horizontally. Stationary people near the line (e.g. a
// choir standing beside the communion path) jitter a few pixels between
// frames — far below this — so they are never counted.
const MIN_TRAVEL_RATIO = 0.12;

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

    /**
     * persons: [{x, y}] centroids in frame pixels. lineX: the counting
     * line's x position in frame pixels (defaults to center). Returns the
     * running count.
     */
    update(persons, frameWidth, now, lineX = frameWidth / 2) {
      const maxMatchDist = frameWidth * 0.22;
      const minTravel = frameWidth * MIN_TRAVEL_RATIO;

      for (const p of persons) {
        let best = null;
        let bestDist = Infinity;
        for (const tr of tracks) {
          if (tr.matched) continue;
          // Match against the track's PREDICTED position so two people
          // passing each other in opposite directions (one line going up
          // while the previous returns) don't swap identities.
          const dtSec = Math.max(0, (now - tr.lastSeen) / 1000);
          const px = tr.x + tr.vx * dtSec;
          const py = tr.y + tr.vy * dtSec;
          const d = Math.hypot(px - p.x, py - p.y);
          if (d < bestDist) { bestDist = d; best = tr; }
        }

        if (best && bestDist <= maxMatchDist) {
          const prevX = best.x;
          const dtSec = (now - best.lastSeen) / 1000;
          if (dtSec > 0) {
            // Smoothed velocity (EMA) for motion prediction.
            best.vx = 0.6 * best.vx + 0.4 * ((p.x - best.x) / dtSec);
            best.vy = 0.6 * best.vy + 0.4 * ((p.y - best.y) / dtSec);
          }
          best.x = p.x; best.y = p.y;
          best.lastSeen = now; best.matched = true;
          p.trackId = best.id;
          p.sex = best.sex;
          if (!best.counted) {
            const crossedLR = prevX < lineX && p.x >= lineX;
            const crossedRL = prevX > lineX && p.x <= lineX;
            // Net horizontal travel since the track began — stationary
            // people jittering on the line never accumulate this.
            const travelled = p.x - best.originX;
            const okLR = crossedLR && travelled >= minTravel;
            const okRL = crossedRL && -travelled >= minTravel;
            if ((direction === 'lr' && okLR)
              || (direction === 'rl' && okRL)
              || (direction === 'both' && (okLR || okRL))) {
              best.counted = true;
              count++;
            }
          }
        } else {
          const tr = { id: nextId++, x: p.x, y: p.y, originX: p.x, vx: 0, vy: 0, lastSeen: now, counted: false, matched: true, sex: null };
          tracks.push(tr);
          p.trackId = tr.id;
          p.sex = null;
        }
      }

      for (let i = tracks.length - 1; i >= 0; i--) {
        tracks[i].matched = false;
        if (now - tracks[i].lastSeen > TRACK_EXPIRY_MS) tracks.splice(i, 1);
      }
      return count;
    },

    reset() { count = 0; tracks.length = 0; },

    /**
     * Mark a tracked person as male/female after the usher taps them.
     * Returns true only the first time a track is tagged, so a person
     * can never be counted twice by repeated taps.
     */
    tag(trackId, sex) {
      const tr = tracks.find(t => t.id === trackId);
      if (!tr || tr.sex) return false;
      tr.sex = sex;
      return true;
    },
  };
}

/**
 * Height filter for skipping small children. Learns the typical adult
 * detection height from a rolling median of recent person boxes and skips
 * detections meaningfully shorter. Pure logic (no DOM) for testability.
 */
export function createHeightFilter(minRatio = 0.62) {
  const heights = [];
  return {
    /** persons: [{h, ...}] box heights in frame px. Returns {kept, skipped}. */
    filter(persons, enabled) {
      for (const p of persons) {
        heights.push(p.h);
        if (heights.length > 60) heights.shift();
      }
      // Need a little history before the median is trustworthy.
      if (!enabled || heights.length < 8) return { kept: persons, skipped: [] };
      const sorted = [...heights].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const kept = [], skipped = [];
      for (const p of persons) {
        (p.h >= median * minRatio ? kept : skipped).push(p);
      }
      return { kept, skipped };
    },
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
let _lineRatio = 0.5; // counting line x as a fraction of frame width
let _ignoreChildren = true;
let _heightFilter = null;

function _loadSettings() {
  const s = load(KEYS.assistSettings, null);
  if (s) {
    if (typeof s.lineRatio === 'number') _lineRatio = Math.min(0.9, Math.max(0.1, s.lineRatio));
    if (s.direction) {
      const sel = document.getElementById('assistDirection');
      if ([...sel.options].some(o => o.value === s.direction)) sel.value = s.direction;
    }
    if (typeof s.ignoreChildren === 'boolean') _ignoreChildren = s.ignoreChildren;
  }
  document.getElementById('assistChildToggle').classList.toggle('active', _ignoreChildren);
}

function _saveSettings() {
  try {
    save(KEYS.assistSettings, {
      lineRatio: _lineRatio,
      direction: document.getElementById('assistDirection').value,
      ignoreChildren: _ignoreChildren,
    });
  } catch { /* best-effort */ }
}

/** Toggle skipping of small children (shorter-than-adult detections). */
export function toggleAssistChildren(event) {
  if (event) event.stopPropagation();
  _ignoreChildren = !_ignoreChildren;
  document.getElementById('assistChildToggle').classList.toggle('active', _ignoreChildren);
  _saveSettings();
  triggerHaptic('light');
}

let _lastKept = [];        // most recent kept detections (with trackId/bbox)
let _lastMap = null;       // video→display mapping (object-fit: cover)
let _pendingTagId = null;  // track awaiting a male/female choice

/**
 * The video fills the stage with object-fit: cover — uniformly scaled and
 * center-cropped. Boxes must be drawn and taps hit-tested through this
 * mapping or they drift away from where people actually appear on screen.
 */
function _videoMap(video) {
  const w = video.clientWidth, h = video.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(w / vw, h / vh);
  return { scale, ox: (w - vw * scale) / 2, oy: (h - vh * scale) / 2, vw, vh };
}

function _hidePersonChooser() {
  _pendingTagId = null;
  document.getElementById('assistChooser').style.display = 'none';
}

/**
 * Tap on the video: on a detected person, open the male/female chooser;
 * on empty space, move the counting line there.
 */
export function assistStageTap(event) {
  const stage = event.currentTarget;
  const rect = stage.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (_pendingTagId !== null) { _hidePersonChooser(); return; }

  if (_lastMap) {
    // Convert the tap from display to video coordinates (object-fit: cover).
    const vx = (x - _lastMap.ox) / _lastMap.scale;
    const vy = (y - _lastMap.oy) / _lastMap.scale;
    // Forgiveness margin (~16 display px) — people move between frames.
    const pad = 16 / _lastMap.scale;

    for (const p of _lastKept) {
      if (p.trackId == null) continue;
      const [bx, by, bw, bh] = p.bbox;
      if (vx >= bx - pad && vx <= bx + bw + pad
        && vy >= by - pad && vy <= by + bh + pad) {
        if (p.sex) return; // already tagged — never treat as a line move
        _pendingTagId = p.trackId;
        const chooser = document.getElementById('assistChooser');
        chooser.style.display = 'flex';
        chooser.style.left = Math.min(Math.max(x - 70, 8), rect.width - 148) + 'px';
        chooser.style.top = Math.max(y - 66, 8) + 'px';
        triggerHaptic('light');
        return;
      }
    }

    // Empty space: move the counting line. The ratio lives in VIDEO
    // coordinates — the space the tracker counts in.
    _lineRatio = Math.min(0.9, Math.max(0.1, vx / _lastMap.vw));
  } else {
    _lineRatio = Math.min(0.9, Math.max(0.1, x / rect.width));
  }
  _saveSettings();
  triggerHaptic('light');
}

/** The usher chose male/female for the tapped person. */
export function assistTagPerson(event, sex) {
  if (event) event.stopPropagation();
  if (_pendingTagId !== null && _tracker && _tracker.tag(_pendingTagId, sex)) {
    if (sex === 'male') changeMale(1); else changeFemale(1);
    document.getElementById('assistManualVal').textContent = _manualTotal();
  }
  _hidePersonChooser();
}

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
  _loadSettings();
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
  _heightFilter = createHeightFilter();
  _running = true;
  triggerHaptic('light');
  _detectLoop();
}

export function closeAssist() {
  _running = false;
  _hidePersonChooser();
  _lastKept = [];
  _lastMap = null;
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

/** Manual +1 from inside the assist view, for people the camera misses.
 *  Uses the real counters (persistence + haptics included). */
export function assistAddMale() {
  changeMale(1);
  document.getElementById('assistManualVal').textContent = _manualTotal();
}

export function assistAddFemale() {
  changeFemale(1);
  document.getElementById('assistManualVal').textContent = _manualTotal();
}

export function changeAssistDirection() {
  // New direction starts a fresh count — old crossings used the old rule.
  _tracker = createLineCounter(document.getElementById('assistDirection').value);
  document.getElementById('assistCount').textContent = '0';
  _saveSettings();
}

// ── Detection loop ────────────────────────────────────────────────────────────

async function _detectLoop() {
  if (!_running) return;
  const video = document.getElementById('assistVideo');

  if (video.readyState >= 2 && video.videoWidth > 0) {
    let predictions = [];
    try {
      predictions = await _model.detect(video, MAX_DETECTIONS, 0.45);
    } catch { /* skip frame */ }

    const persons = predictions
      .filter(p => p.class === 'person')
      .map(p => ({
        x: p.bbox[0] + p.bbox[2] / 2,
        y: p.bbox[1] + p.bbox[3] / 2,
        h: p.bbox[3],
        bbox: p.bbox,
      }));

    const { kept, skipped } = _heightFilter
      ? _heightFilter.filter(persons, _ignoreChildren)
      : { kept: persons, skipped: [] };

    if (_tracker) {
      const count = _tracker.update(kept, video.videoWidth, performance.now(),
        video.videoWidth * _lineRatio);
      document.getElementById('assistCount').textContent = count;
    }
    _lastKept = kept;
    _drawOverlay(kept, skipped, video);
  }

  _loopTimer = setTimeout(_detectLoop, DETECT_INTERVAL_MS);
}

function _drawOverlay(persons, skipped, video) {
  const canvas = document.getElementById('assistCanvas');
  const w = video.clientWidth;
  const h = video.clientHeight;
  if (!w || !h || !video.videoWidth) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const map = _videoMap(video);
  _lastMap = map;
  const toX = vx => vx * map.scale + map.ox;
  const toY = vy => vy * map.scale + map.oy;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Counting line (movable — tap the video to place it). The ratio is in
  // video coordinates, mapped to the display like everything else.
  const lx = toX(map.vw * _lineRatio);
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(lx, 0);
  ctx.lineTo(lx, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Person boxes — green untagged, blue male, purple female;
  // faint grey is filtered out (children)
  ctx.lineWidth = 2;
  for (const p of persons) {
    const [bx, by, bw, bh] = p.bbox;
    const dx = toX(bx), dy = toY(by);
    const dw = bw * map.scale, dh = bh * map.scale;
    if (p.sex === 'male') ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
    else if (p.sex === 'female') ctx.strokeStyle = 'rgba(192, 132, 252, 0.95)';
    else ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.strokeRect(dx, dy, dw, dh);
    if (p.sex) {
      ctx.font = '700 16px -apple-system, sans-serif';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(p.sex === 'male' ? '✓♂' : '✓♀', dx + 4, Math.max(dy - 6, 14));
    }
  }
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.5;
  for (const p of skipped) {
    const [bx, by, bw, bh] = p.bbox;
    ctx.strokeRect(toX(bx), toY(by), bw * map.scale, bh * map.scale);
  }
}
