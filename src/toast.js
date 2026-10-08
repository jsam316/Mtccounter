// Non-blocking message bar at the bottom of the screen.
//
// Replaces native alert()/confirm() pop-ups, which block the whole screen
// during a service. A message can carry one action button (e.g. Undo).

let _timer = null;

function _el() {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function hideToast() {
  if (typeof document === 'undefined') return;
  clearTimeout(_timer);
  const el = document.getElementById('toast');
  if (el) el.classList.remove('show');
}

/**
 * Show a message. type: 'success' | 'error' | 'info'.
 * action: { label, onClick } adds a button; tapping it runs onClick and
 * closes the message.
 */
export function showToast(message, { type = 'success', duration = 3000, action = null } = {}) {
  if (typeof document === 'undefined') return;
  const el = _el();
  clearTimeout(_timer);
  el.className = 'toast toast-' + type;
  el.textContent = '';

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  el.appendChild(text);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      hideToast();
      action.onClick();
    });
    el.appendChild(btn);
  }

  // Force a reflow so re-showing restarts the slide-in.
  void el.offsetWidth;
  el.classList.add('show');
  _timer = setTimeout(hideToast, duration);
}
