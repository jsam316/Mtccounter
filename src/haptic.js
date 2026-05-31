export function triggerHaptic(style) {
  if (!('vibrate' in navigator)) return;
  try {
    let pattern;
    switch (style) {
      case 'light':   pattern = 10; break;
      case 'medium':  pattern = 20; break;
      case 'heavy':   pattern = 30; break;
      case 'success': pattern = [10, 50, 10]; break;
      case 'error':   pattern = [20, 100, 20]; break;
      case 'double':  pattern = [15, 30, 15]; break;
      default:        pattern = 15;
    }
    navigator.vibrate(pattern);
  } catch (e) {
    // Silently ignore haptic failures
  }
}

export function triggerIOSHaptic() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 200;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.01);
  } catch (e) {
    // Silently ignore
  }
}

export function addHapticAnimation(element) {
  if (!element) return;
  element.classList.add('haptic-pulse');
  setTimeout(() => element.classList.remove('haptic-pulse'), 300);
}
