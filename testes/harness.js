// Harness: roda index.html + nit.js reais num DOM simulado, com Firebase RTDB falso em memória.
const fs = require('fs');
const path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');

const REPO = process.env.NIT_REPO || path.resolve(__dirname, '..');

// ── Firebase RTDB falso ─────────────────────────────────────────────────────
function criarFirebaseFalso(estadoInicial, relogio) {
  let root = JSON.parse(JSON.stringify(estadoInicial || {}));
  const listeners = []; // {path, evento, cb}
  const escritas = [];  // log de escritas
  const TS = { '.sv': 'timestamp' };

  const partes = p => (p || '').split('/').filter(Boolean);
  const ler = (obj, p) => partes(p).reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const resolverTS = v => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return relogio.agora();
      const o = Array.isArray(v) ? [] : {};
      for (const k of Object.keys(v)) o[k] = resolverTS(v[k]);
      return o;
    }
    return v;
  };
  const podar = obj => { // remove nulls/objetos vazios como o RTDB faz
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (obj[k] === null || obj[k] === undefined) delete obj[k];
        else if (typeof obj[k] === 'object') { podar(obj[k]); if (!Object.keys(obj[k]).length) delete obj[k]; }
      }
    }
    return obj;
  };
  const gravarEm = (p, valor) => {
    const ps = partes(p);
    if (!ps.length) { root = valor == null ? {} : clone(resolverTS(valor)); return; }
    let o = root;
    for (let i = 0; i < ps.length - 1; i++) {
      if (o[ps[i]] == null || typeof o[ps[i]] !== 'object') o[ps[i]] = {};
      o = o[ps[i]];
    }
    const k = ps[ps.length - 1];
    if (valor === null || valor === undefined) delete o[k];
    else o[k] = clone(resolverTS(valor));
  };

  function snapshot(p, valor) {
    const v = clone(valor);
    return {
      key: partes(p).slice(-1)[0] || null,
      val: () => (v === undefined ? null : clone(v)),
      exists: () => v !== undefined && v !== null,
      forEach: fn => { if (v && typeof v === 'object') for (const k of Object.keys(v)) if (fn(snapshot(p + '/' + k, v[k])) === true) return true; },
      child: c => snapshot(p + '/' + c, v == null ? undefined : ler(v, c)),
    };
  }

  // Simulação de rede (13.1, gravação): atraso, sem conexão e recusa do servidor.
  // Padrão: sem atraso, online, nada recusado — comportamento idêntico ao anterior.
  const controle = { atrasoMs: 0, online: true, recusar: null, codigoRecusa: null, fila: [] };
  function emitirConexao() {
    for (const l of listeners) if (l.path === '.info/connected' && l.evento === 'value') { try { l.cb(snapshot(l.path, controle.online)); } catch (e) { /* janela já fechada */ } }
  }
  controle.definirOnline = v => {
    controle.online = !!v; emitirConexao();
    if (controle.online) { const f = controle.fila.splice(0); f.forEach(it => controle.atrasoMs ? setTimeout(it.finalizar, controle.atrasoMs) : it.finalizar()); }
  };

  function emitir(antes) {
    for (const l0 of listeners) {
      if (l0.path.startsWith('.info')) continue;
      const l = { ...l0, cb: snap => { try { l0.cb(snap); } catch (e) { if (!/getElementById|querySelector|document/.test(String(e))) throw e; } } };
      const a = ler(antes, l.path), d = ler(root, l.path);
      if (l.evento === 'value') {
        if (JSON.stringify(a) !== JSON.stringify(d)) l.cb(snapshot(l.path, d));
        continue;
      }
      const ka = a && typeof a === 'object' ? a : {}, kd = d && typeof d === 'object' ? d : {};
      if (l.evento === 'child_added') for (const k of Object.keys(kd)) if (!(k in ka)) l.cb(snapshot(l.path + '/' + k, kd[k]));
      if (l.evento === 'child_removed') for (const k of Object.keys(ka)) if (!(k in kd)) l.cb(snapshot(l.path + '/' + k, ka[k]));
      if (l.evento === 'child_changed') for (const k of Object.keys(kd)) if (k in ka && JSON.stringify(ka[k]) !== JSON.stringify(kd[k])) l.cb(snapshot(l.path + '/' + k, kd[k]));
    }
  }
  function escrever(desc, fn) {
    const antes = clone(root);
    fn(); podar(root);
    escritas.push(desc);
    emitir(antes); // aplica na hora, como o SDK real (escrita otimista)
    return new Promise((resolve, reject) => {
      const it = { finalizar: null };
      it.finalizar = () => {
        if (controle.recusar && controle.recusar(desc.p, desc)) {
          // servidor recusou: o SDK desfaz a escrita local e rejeita a promessa
          const a2 = clone(root);
          gravarEm(desc.p, ler(antes, desc.p)); podar(root); emitir(a2);
          const cod = controle.codigoRecusa || 'PERMISSION_DENIED'; const e = new Error(cod + ': recusado'); e.code = cod;
          reject(e);
        } else resolve();
      };
      if (!controle.online) { controle.fila.push(it); return; }
      if (controle.atrasoMs) setTimeout(it.finalizar, controle.atrasoMs); else it.finalizar();
    });
  }

  let pushSeq = 0;
  function ref(p) {
    p = partes(p).join('/');
    const r = {
      key: partes(p).slice(-1)[0] || null,
      toString: () => p,
      child: c => ref(p + '/' + c),
      on(evento, cb) {
        listeners.push({ path: p, evento, cb });
        if (p === '.info/connected') { if (evento === 'value') cb(snapshot(p, controle.online)); return cb; }
        const v = ler(root, p);
        if (evento === 'value') cb(snapshot(p, v));
        if (evento === 'child_added' && v && typeof v === 'object') for (const k of Object.keys(v)) cb(snapshot(p + '/' + k, v[k]));
        return cb;
      },
      off() {},
      once: () => Promise.resolve(snapshot(p, ler(root, p))),
      get: () => Promise.resolve(snapshot(p, ler(root, p))),
      set: v => escrever({ op: 'set', p }, () => gravarEm(p, v)),
      remove: () => escrever({ op: 'remove', p }, () => gravarEm(p, null)),
      update: obj => escrever({ op: 'update', p, chaves: Object.keys(obj) }, () => {
        for (const [k, v] of Object.entries(obj)) gravarEm(p ? p + '/' + k : k, v);
      }),
      push(v) {
        const k = 'push' + String(++pushSeq).padStart(6, '0');
        const filho = ref(p + '/' + k);
        const prom = v !== undefined ? filho.set(v) : Promise.resolve();
        // como o SDK: referência "thenable" que resolve quando a gravação termina
        // (não resolve com a própria referência, senão a promessa nunca termina)
        return Object.assign(filho, { then: (f, g) => prom.then(f, g), catch: g => prom.catch(g) });
      },
      orderByChild: () => r, limitToLast: () => r, equalTo: () => r, startAt: () => r, endAt: () => r,
      transaction: fn => escrever({ op: 'transaction', p }, () => gravarEm(p, fn(clone(ler(root, p))))),
    };
    return r;
  }

  const db = { ref };
  const usuario = { uid: 'uid-teste', email: 'teste@nit.local', displayName: 'Operador Teste', providerData: [] };
  const authObj = {
    onAuthStateChanged: cb => { setTimeout(() => cb(usuario), 0); return () => {}; },
    signOut: () => Promise.resolve(),
    signInWithPopup: () => Promise.resolve(),
    currentUser: usuario,
  };
  const auth = () => authObj;
  auth.GoogleAuthProvider = class { setCustomParameters() {} };
  const database = () => db;
  database.ServerValue = { TIMESTAMP: TS };

  return {
    firebase: { apps: [], initializeApp() { this.apps.push({}); }, database, auth },
    estado: () => clone(root),
    escritas,
    controle,
  };
}

// ── Relógio controlável ─────────────────────────────────────────────────────
function criarRelogio(isoLocal) {
  // isoLocal no fuso de Fortaleza (UTC-3), ex: '2026-10-10T05:35:00'
  let base = new Date(isoLocal + '-03:00').getTime();
  const inicioReal = Date.now();
  return {
    agora: () => base + (Date.now() - inicioReal),
    definir(iso) { base = new Date(iso + '-03:00').getTime(); },
  };
}

// ── Sobe o NIT ──────────────────────────────────────────────────────────────
async function subirNIT({ estado, relogioIso, fb: fbCompartilhado, celular = false, url = 'https://nit.teste/index.html' }) {
  const relogio = criarRelogio(relogioIso);
  // fb compartilhado = dois operadores no mesmo banco (opcional, retrocompatível)
  const fb = fbCompartilhado || criarFirebaseFalso(estado, relogio);
  const erros = [];
  const vc = new VirtualConsole();
  vc.on('error', (...a) => erros.push(a.map(String).join(' ')));
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e.message || e)));
  vc.on('warn', () => {}); vc.on('log', () => {}); vc.on('info', () => {});

  class Loader extends ResourceLoader {
    fetch(url, opts) {
      const u = new URL(url);
      if (u.hostname === 'nit.teste') {
        const f = path.join(REPO, u.pathname);
        if (fs.existsSync(f)) return Promise.resolve(fs.readFileSync(f));
      }
      return null; // bloqueia externos (gstatic, fonts, backend)
    }
  }

  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    resources: new Loader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // relógio
      const RealDate = window.Date;
      class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(relogio.agora()); }
        static now() { return relogio.agora(); }
      }
      window.Date = FakeDate;
      window.firebase = fb.firebase;
      window.fetch = () => Promise.reject(new Error('rede bloqueada no teste'));
      window.HTMLCanvasElement.prototype.getContext = () => null;
      // celular: tela de toque estreita (NIT Móvel). Fora disso, nenhuma consulta de mídia casa.
      window.matchMedia = celular ? (q => ({ matches: /pointer:\s*coarse/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
        : window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      window.scrollTo = () => {};
      window.alert = m => erros.push('ALERT: ' + m);
      window.confirm = () => true;
      window.navigator.clipboard = { writeText: () => Promise.resolve() };
      // dados de autorização do login simulado
      fb.firebase.database().ref('usuarios_autorizados/teste|nit|local').set({ nome: 'Operador Teste', turno: 'manha', ativo: true });
    },
  });

  const w = dom.window;
  await esperarAte(() => w.document.readyState === 'complete', 5000);
  await esperarAte(() => w.document.getElementById('nit-login-overlay')?.classList.contains('hidden'), 8000, 'login');
  await dormir(300);
  return { dom, w, fb, relogio, erros };
}

const dormir = ms => new Promise(r => setTimeout(r, ms));
async function esperarAte(fn, ms, nome) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await dormir(25); }
  throw new Error('timeout esperando ' + (nome || 'condição'));
}

// ── Ações e leituras ────────────────────────────────────────────────────────
async function processar(nit, texto) {
  const { w } = nit;
  const ta = w.document.getElementById('relatorio-bruto-input');
  ta.value = texto;
  w.document.getElementById('btn-processar').click();
  await dormir(250);
}
function modalAberto(nit) {
  const m = nit.w.document.getElementById('modal-confirmar-generico');
  return m && m.classList.contains('visible')
    ? { titulo: nit.w.document.getElementById('modal-confirmar-titulo').textContent.trim(),
        msg: nit.w.document.getElementById('modal-confirmar-msg').textContent.trim() }
    : null;
}
async function responderModal(nit, confirmar) {
  nit.w.document.getElementById(confirmar ? 'btn-confirmar-generico-ok' : 'btn-confirmar-generico-cancel').click();
  await dormir(250);
}
function toasts(nit) {
  return [...nit.w.document.querySelectorAll('#toast-container .toast')].map(t => t.textContent.trim());
}
function painel(nit) {
  const d = nit.w.document;
  const txt = id => d.getElementById(id)?.textContent.trim();
  const cards = [...d.querySelectorAll('#tab-semaforo .kanban-card')];
  const vis = cards.filter(c => c.style.display !== 'none');
  return {
    total: txt('display-total') ?? txt('total-ocorrencias'),
    pendentes: txt('display-pendentes'),
    normalizados: txt('display-normalizados'),
    cardsDOM: cards.length,
    cardsVisiveis: vis.length,
    eventoIdsDuplicados: (() => { const ids = cards.map(c => c.dataset.eventoid); return ids.filter((x, i) => ids.indexOf(x) !== i); })(),
  };
}
function resumoKanban(nit) {
  const k = nit.fb.estado().kanban || {};
  const porData = {}, porColuna = {};
  for (const n of Object.values(k)) {
    porData[n.dataReferencia] = (porData[n.dataReferencia] || 0) + 1;
    porColuna[n.coluna] = (porColuna[n.coluna] || 0) + 1;
  }
  return { nos: Object.keys(k).length, porData, porColuna };
}

module.exports = { criarFirebaseFalso, criarRelogio, subirNIT, processar, modalAberto, responderModal, toasts, painel, resumoKanban, dormir };
