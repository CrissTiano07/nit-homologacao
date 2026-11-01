// Firebase falso mínimo para o movel.html (compat API). Estado em window.__FB.
(function () {
  const F = window.__FB = window.__FB || { estado: {}, usuario: null, online: true, ouvintes: [] };
  F.ouvintes = F.ouvintes || [];
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), F.estado);
  const snap = (key, v) => ({ key, val: () => (v === undefined ? null : v), exists: () => v != null });
  // gravação com as regras que importam (como o real): apagar kanban inteiro e mexer na lixeira só ADM;
  // gravação de vários caminhos é tudo ou nada (PERMISSION_DENIED recusa o lote inteiro)
  const chaveEmail = e => String(e || '').toLowerCase().replace(/\./g, '|').replace(/@/g, '|');
  const ehAdm = () => !!(F.usuario && (F.estado.nit_admins || {})[chaveEmail(F.usuario.email)] === true);
  function gravar(caminho, v) {
    const ps = caminho.split('/').filter(Boolean); let o = F.estado;
    ps.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null) delete o[ps[ps.length - 1]]; else o[ps[ps.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  let seq = 0;
  function ref(path = '') {
    path = String(path || '').split('/').filter(Boolean).join('/');
    const r = {
      path, _q: null,
      push() { return { key: 'p' + String(++seq).padStart(5, '0') }; },
      update(lote) {
        F.escritas = (F.escritas || 0) + 1;
        if (!F.usuario) return Promise.reject(Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' }));
        const cs = Object.keys(lote).map(k => (path ? path + '/' : '') + k);
        if (F.gravacaoErro) return Promise.reject(Object.assign(new Error(F.gravacaoErro), { code: F.gravacaoErro }));
        if (cs.some(c => c === 'kanban' || c.startsWith('lixeira')) && !ehAdm()) return Promise.reject(Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' }));
        Object.entries(lote).forEach(([k, v]) => gravar((path ? path + '/' : '') + k, v));
        setTimeout(() => window.__FBemitir(), 10);
        return Promise.resolve();
      },
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
    signInWithPopup() {
      F.janelas = (F.janelas || 0) + 1;
      if (F.popup === 'trava') return new Promise(() => {});
      if (F.popup && F.popup.erro) return Promise.reject(Object.assign(new Error(F.popup.erro), { code: F.popup.erro }));
      F.usuario = F.proximo; authObs.forEach(cb => cb(F.usuario)); return Promise.resolve();
    },
    signInWithRedirect() { F.redirects = (F.redirects || 0) + 1; return Promise.resolve(); },
    getRedirectResult() { return Promise.resolve(null); },
    signOut() { F.usuario = null; return Promise.resolve(); },
    signInWithCredential(c) { return window.__FBcred(c); },
  });
  auth.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
  auth.GoogleAuthProvider.credential = t => ({ idToken: t });
  // Firebase falso: aceita o comprovante se o e-mail estiver legível (o real confere assinatura e destinatário)
  const _auth = auth;
  window.__FBcred = c => { F.creds = (F.creds || 0) + 1;
    if (F.credErro) return Promise.reject(Object.assign(new Error(F.credErro), { code: F.credErro }));
    const p = JSON.parse(atob(c.idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    F.usuario = { email: p.email }; authObs.forEach(cb => cb(F.usuario)); return Promise.resolve(); };
  const semApp = () => { throw Object.assign(new Error("No Firebase App '[DEFAULT]' has been created"), { code: 'app/no-app' }); };
  const fb = { apps: [], initializeApp(c) { fb.apps.push(c); F.cfg = c; } };
  const authStrict = () => (fb.apps.length ? auth() : semApp());
  authStrict.GoogleAuthProvider = auth.GoogleAuthProvider;
  fb.auth = authStrict; fb.database = () => (fb.apps.length ? { ref } : semApp());
  window.firebase = fb;
})();
