// Loaded before every test file (see package.json "test").
// The app's modules read localStorage when they load (e.g. the saved
// language), so give Node an in-memory stand-in.

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => { store.clear(); },
};
