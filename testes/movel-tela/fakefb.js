// Firebase falso mínimo para o movel.html (compat API). Estado em window.__FB.
(function () {
  const F = window.__FB = window.__FB || { estado: {}, usuario: null, online: true, ouvintes: [] };
  F.ouvintes = F.ouvintes || [];
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), F.estado);
  const snap = (key, v) => ({ key, val: () => (v === undefined ? null : v), exists: () => v != null });
  function ref(path) {
    const r = {
      path, _q: null,
      get: () => Promise.resolve(snap(path, get(path))),
      orderByChild(c) { const q = { ...r, _c: c }; q.equalTo = v => ({ ...r, _q: { c, v } }); return q; },
      on(ev, cb) { const o = { path, cb, q: this._q }; F.ouvintes.push(o); setTimeout(() => emitir(o), 30); return cb; },
      off() { F.ouvintes = F.ouvintes.filter(o => o.path !== path); },
    };
    return r;
  }
  function emitir(o) {
    if (o.path === '.info/connected') return o.cb(snap('connected', F.online));
    let v = get(o.path);
    if (o.q && v) v = Object.fromEntries(Object.entries(v).filter(([, x]) => x && x[o.q.c] === o.q.v));
    o.cb(snap(o.path, v));
  }
  window.__FBemitir = () => F.ouvintes.forEach(emitir);
  const authObs = [];
  const auth = () => ({
    onAuthStateChanged(cb) { authObs.push(cb); setTimeout(() => cb(F.usuario), 20); },
    signInWithPopup() { F.usuario = F.proximo; authObs.forEach(cb => cb(F.usuario)); return Promise.resolve(); },
    signInWithRedirect() { return Promise.resolve(); },
    getRedirectResult() { return Promise.resolve(null); },
    signOut() { F.usuario = null; return Promise.resolve(); },
  });
  auth.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
  window.firebase = { apps: [], initializeApp(c) { this.apps.push(c); F.cfg = c; }, auth, database: () => ({ ref }) };
})();
