// Reload when the service worker controller changes, even if the main
// module fails to load (e.g. a stale cache serving a wrong path).
//
// A plain script in its own file, not inline in index.html: the page's
// content security policy does not allow inline <script> blocks.

if ('serviceWorker' in navigator) {
  // Reload only on a real update takeover. On the very first visit the
  // new worker claims the page (clients.claim) and controllerchange
  // fires without any update — reloading then would wipe in-progress UI.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A first-install claim on an uncontrolled page is not an update —
    // unless the app explicitly asked the new worker to take over.
    if (!hadController && !window.__mtcApplyingUpdate) { hadController = true; return; }
    window.location.reload();
  });
}
