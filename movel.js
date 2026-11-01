/* NIT Móvel — fase 1 (31/10/2026): só visualização, só ADM (nit_admins/{chave} === true).
 * Lê /kanban apenas do dia (dataReferencia = hoje, mesmo critério dos totais do computador).
 * Não grava nada no Firebase. Lembra no aparelho (localStorage) só o que já foi visto, para marcar "novo". */
(function (raiz) {
    'use strict';

    // ── Funções puras (testadas em testes/bateria-movel.js) ─────────────
    const GRUPOS = [
        { id: 'espera',  col: 'coluna-espera',          rot: 'Aguardando',   tit: '⏳ AGUARDANDO', ordem: 'mais antiga primeiro', cor: 'red' },
        { id: 'vl',      col: 'coluna-vl',              rot: 'Via Livre',    tit: '🚔 VIA LIVRE',          cor: 'org' },
        { id: 'amc',     col: 'coluna-amc',             rot: 'AMC',          tit: '🚔 AMC',                cor: 'blu' },
        { id: 'sem',     col: 'coluna-sem-necessidade', rot: 'Sem nec.',     tit: '➖ SEM NECESSIDADE',    cor: 'off' },
        { id: 'norm',    col: 'coluna-normalizados',    rot: 'Normalizados', tit: '✅ NORMALIZADOS', ordem: 'mais recente primeiro', cor: 'grn' },
    ];
    const sv = v => (v != null && v !== 'null' && v !== 'undefined') ? String(v).trim() : '';
    const hoje = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const chave = e => (typeof e === 'string' && e.trim()) ? e.trim().toLowerCase().replace(/\./g, '|').replace(/@/g, '|') : null;
    const hhmm = ts => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

    // "31/10/2026 07:32" → ms (hora local); sem hora → null
    function lerDataHora(s) {
        const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(sv(s));
        return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime() : null;
    }
    function fimMs(c) { return lerDataHora(sv(c.fim) || `${sv(c.data_fim)} ${sv(c.hora_fim)}`); }

    // há quanto tempo: "agora", "há 25 min", "há 2h05", "há 1d 3h"
    function desde(ms, agora) {
        if (ms == null) return '';
        const min = Math.max(0, Math.floor((agora - ms) / 60000));
        if (min < 1) return 'agora';
        if (min < 60) return `há ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `há ${h}h${String(min % 60).padStart(2, '0')}`;
        return `há ${Math.floor(h / 24)}d ${h % 24}h`;
    }

    // a coluna decide, igual ao computador (lá o card fica onde 'coluna' manda e os totais contam pela coluna)
    function grupoDe(c) {
        const g = GRUPOS.find(x => x.col === sv(c.coluna));
        return g ? g.id : 'espera';
    }

    // cards do dia, sem retirados, separados e ordenados por grupo
    function montar(kanban, dia) {
        const por = Object.fromEntries(GRUPOS.map(g => [g.id, []]));
        Object.entries(kanban || {}).forEach(([id, c]) => {
            if (!c || typeof c !== 'object' || c.retirado) return;
            if (sv(c.dataReferencia) !== dia) return;
            por[grupoDe(c)].push({ ...c, eventoId: id, codigo: sv(c.codigo) || id.split('_')[0] });
        });
        const ini = c => lerDataHora(c.inicio) ?? Infinity;
        por.espera.sort((a, b) => ini(a) - ini(b));                                   // mais tempo esperando primeiro
        ['vl', 'amc', 'sem'].forEach(g => por[g].sort((a, b) => ini(a) - ini(b)));
        por.norm.sort((a, b) => (fimMs(b) ?? 0) - (fimMs(a) ?? 0));                  // normalizado mais recente primeiro
        return por;
    }

    function totais(por) {
        const n = por.norm.length, t = GRUPOS.reduce((s, g) => s + por[g.id].length, 0);
        return { total: t, pend: t - n, norm: n };
    }

    function busca(c, q) {
        q = sv(q).toUpperCase(); if (!q) return true;
        return [c.codigo, c.endereco, c.tipo, c.problema, c.equipe, c.viatura].some(v => sv(v).toUpperCase().includes(q));
    }

    // o que mostrar em cada linha
    function linha(c, gid, agora) {
        const prob = sv(c.problema).toUpperCase(), causa = sv(c.tipo).toUpperCase();
        const detalhe = [prob, causa].filter(Boolean).join(' · ');
        const equipe = [sv(c.equipe), sv(c.viatura) && `VT ${sv(c.viatura).replace(/^VT\s*/i, '')}`].filter(Boolean).join(' · ');
        const apoio = sv(c.equipeApoio) ? ` + apoio ${sv(c.equipeApoio)}` : '';
        if (gid === 'norm') {
            const f = fimMs(c);
            return { titulo: sv(c.endereco) || '(sem endereço)', sub: detalhe || '—', tempo: f ? `às ${hhmm(f)}` : '', alerta: false };
        }
        if (gid === 'vl' || gid === 'amc') {
            const d = Number(c.tsDespacho) || null;
            return { titulo: sv(c.endereco) || '(sem endereço)', sub: (equipe || detalhe || '—') + apoio, tempo: d ? `desp. ${desde(d, agora)}` : desde(lerDataHora(c.inicio), agora), alerta: false };
        }
        const ini = lerDataHora(c.inicio);
        return { titulo: sv(c.endereco) || '(sem endereço)', sub: detalhe || '—', tempo: desde(ini, agora), alerta: gid === 'espera' && ini != null && agora - ini >= 2 * 3600000 };
    }

    // marca "novo": o par (card, grupo) não estava na última visita
    function marcaVista(c, gid) { return `${c.eventoId}@${gid}`; }

    const Puro = { GRUPOS, hoje, chave, lerDataHora, desde, grupoDe, montar, totais, busca, linha, marcaVista, hhmm };
    if (typeof module !== 'undefined' && module.exports) { module.exports = Puro; return; }

    // ── Página ──────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const CH_VISTOS = 'nit-movel-vistos', CH_FILTRO = 'nit-movel-filtro';
    const ls = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue */ } },
    };
    const S = {
        db: null, dia: hoje(), kanban: {}, ref: null, filtro: ls.get(CH_FILTRO) || 'espera', q: '',
        vistos: new Set(JSON.parse(ls.get(CH_VISTOS) || '[]')), atuais: new Set(),
        online: true, ultimo: null, carregado: false,
    };

    function tela(qual, msg) {
        ['m-login', 'm-app'].forEach(id => { $(id).hidden = id !== qual; });
        if (msg != null) $('m-login-status').textContent = msg;
    }

    async function entrar() {
        const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
        $('m-btn-login').disabled = true; tela('m-login', 'Abrindo o Google...');
        try { await firebase.auth().signInWithPopup(p); }
        catch (e) {
            // celular: pop-up bloqueado ou não suportado (navegador do WhatsApp, iPhone) → sai e volta pelo Google
            if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
                try { await firebase.auth().signInWithRedirect(p); return; } catch (e2) { e = e2; }
            }
            tela('m-login', e.code === 'auth/popup-closed-by-user' ? 'Login cancelado.' : 'Não foi possível entrar. Tente de novo.');
            $('m-btn-login').disabled = false;
        }
    }

    async function verificar(user) {
        const k = chave(user.email);
        if (!k) { await firebase.auth().signOut(); tela('m-login', 'Conta sem e-mail válido.'); return; }
        tela('m-login', 'Verificando acesso...');
        try {
            const aut = await S.db.ref(`usuarios_autorizados/${k}`).get();
            if (!aut.exists() || aut.val().ativo === false) {
                await firebase.auth().signOut(); tela('m-login', 'Acesso não autorizado. Procure o administrador.'); $('m-btn-login').disabled = false; return;
            }
            let adm = false;
            try { adm = (await S.db.ref(`nit_admins/${k}`).get()).val() === true; } catch (e) { adm = false; }
            if (!adm) { location.replace('index.html?versao=computador'); return; }   // fase 1: celular só para ADM
            iniciar();
        } catch (e) {
            console.error('[NitMovel] verificar:', e);
            tela('m-login', 'Falha ao verificar acesso. Tente de novo.'); $('m-btn-login').disabled = false;
        }
    }

    function assinarDia() {
        if (S.ref) S.ref.off();
        S.dia = hoje(); S.kanban = {}; S.carregado = false;
        S.ref = S.db.ref('kanban').orderByChild('dataReferencia').equalTo(S.dia);
        S.ref.on('value', snap => { S.kanban = snap.val() || {}; S.carregado = true; render(); },
            () => { S.carregado = true; $('m-lista').innerHTML = '<p class="m-vazio">Sem permissão para ler o painel.</p>'; });
    }

    function iniciar() {
        tela('m-app');
        assinarDia();
        S.db.ref('meta/ultimo_processamento').on('value', s => { S.ultimo = s.val(); renderEstado(); });
        let t = null;
        S.db.ref('.info/connected').on('value', s => {
            clearTimeout(t);
            if (s.val() === true) { S.online = true; renderEstado(); }
            else t = setTimeout(() => { S.online = false; renderEstado(); }, 5000);   // oscilação curta não assusta
        });
        setInterval(() => { if (hoje() !== S.dia) assinarDia(); else render(); }, 30000);   // virada do dia + "há X min"
        document.addEventListener('visibilitychange', () => { if (document.hidden) guardarVistos(); else render(); });
        window.addEventListener('pagehide', guardarVistos);
    }

    function guardarVistos() {
        if (!S.carregado) return;
        S.vistos = new Set(S.atuais);
        ls.set(CH_VISTOS, JSON.stringify([...S.atuais]));
    }

    function renderEstado() {
        const el = $('m-estado'), ag = new Date();
        $('m-relogio').textContent = `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][ag.getDay()]} ${S.dia.slice(0, 5)} · ${hhmm(ag)}`;
        if (!S.online) { el.className = 'm-estado m-ruim'; el.textContent = '⚠ SEM INTERNET · os dados podem estar atrasados'; return; }
        const u = S.ultimo;
        el.className = 'm-estado';
        el.textContent = u && u.ts ? `✓ ATUALIZADO ${hhmm(u.ts)} · ${u.planilha ? 'PLANILHA' : (u.auto ? 'AUTOMÁTICO' : sv(u.por).toUpperCase() || 'NIT')}` : '✓ AO VIVO';
    }

    function render() {
        renderEstado();
        const agora = Date.now(), por = montar(S.kanban, S.dia), t = totais(por);
        $('m-resumo').textContent = `${t.pend} pend. · ${t.norm} norm.`;
        S.atuais = new Set(GRUPOS.flatMap(g => por[g.id].map(c => marcaVista(c, g.id))));
        const primeira = S.vistos.size === 0;   // 1ª visita no aparelho: nada é "novo"

        // filtros com contagem (o "novo" de cada grupo vira ponto no filtro)
        const chips = [...GRUPOS.map(g => ({ id: g.id, rot: g.rot, n: por[g.id].length, cor: g.cor,
            novos: primeira ? 0 : por[g.id].filter(c => !S.vistos.has(marcaVista(c, g.id))).length })),
            { id: 'todos', rot: 'Todos', n: t.total, cor: 'tx2', novos: 0 }];
        $('m-chips').replaceChildren(...chips.map(ch => {
            const b = document.createElement('button'); b.type = 'button';
            b.className = 'm-chip' + (S.filtro === ch.id ? ' on' : ''); b.style.setProperty('--c', `var(--${ch.cor})`);
            b.innerHTML = `${ch.rot}<b>${ch.n}</b>${ch.novos ? '<i class="m-chip-novo"></i>' : ''}`;
            b.addEventListener('click', () => { S.filtro = ch.id; ls.set(CH_FILTRO, ch.id); render(); window.scrollTo(0, 0); });
            return b;
        }));

        const lista = $('m-lista'); const frag = document.createDocumentFragment();
        const grupos = S.filtro === 'todos' ? GRUPOS : GRUPOS.filter(g => g.id === S.filtro);
        let mostrou = 0;
        grupos.forEach(g => {
            const itens = por[g.id].filter(c => busca(c, S.q));
            if (!itens.length && S.filtro === 'todos') return;
            const h = document.createElement('div'); h.className = 'm-gh'; h.style.setProperty('--c', `var(--${g.cor})`);
            h.innerHTML = `<span></span><em>${itens.length}</em>`; h.firstChild.textContent = g.tit;
            if (g.ordem) { const o = document.createElement('small'); o.textContent = ` · ${g.ordem}`; h.firstChild.append(o); }
            frag.append(h);
            if (!itens.length) { const p = document.createElement('p'); p.className = 'm-vazio'; p.textContent = S.q ? 'Nada encontrado.' : 'Nenhuma ocorrência aqui.'; frag.append(p); }
            itens.forEach(c => {
                const L = linha(c, g.id, agora), novo = !primeira && !S.vistos.has(marcaVista(c, g.id));
                const r = document.createElement('div'); r.className = 'm-r' + (L.alerta ? ' m-alerta' : ''); r.style.setProperty('--c', `var(--${g.cor})`);
                r.innerHTML = '<div class="m-av"></div><div class="m-m"><div class="m-a"><b></b><time></time></div><div class="m-z"><span></span></div></div>';
                r.querySelector('.m-av').textContent = c.codigo;
                r.querySelector('b').textContent = L.titulo;
                r.querySelector('time').textContent = L.tempo;
                r.querySelector('.m-z span').textContent = L.sub;
                if (novo) { const n = document.createElement('i'); n.className = 'm-novo'; n.textContent = 'novo'; r.querySelector('.m-z').append(n); }
                frag.append(r); mostrou++;
            });
        });
        if (!S.carregado) { lista.innerHTML = '<p class="m-vazio">Carregando...</p>'; return; }
        if (!mostrou && S.filtro === 'todos') { lista.innerHTML = `<p class="m-vazio">${S.q ? 'Nada encontrado.' : 'Nenhuma ocorrência hoje.'}</p>`; return; }
        lista.replaceChildren(frag);
    }

    document.addEventListener('DOMContentLoaded', () => {
        S.db = firebase.database();
        $('m-btn-login').addEventListener('click', entrar);
        $('m-busca').addEventListener('input', e => { S.q = e.target.value; render(); });
        $('m-computador').addEventListener('click', e => { e.preventDefault(); location.href = 'index.html?versao=computador'; });
        $('m-sair').addEventListener('click', () => firebase.auth().signOut().then(() => location.reload()));
        firebase.auth().getRedirectResult().catch(() => { /* erro do retorno do Google: o botão continua disponível */ });
        firebase.auth().onAuthStateChanged(u => { if (u) verificar(u); else { tela('m-login', ''); $('m-btn-login').disabled = false; } });
    });
    raiz.NitMovel = { S, render, Puro };
})(typeof window !== 'undefined' ? window : globalThis);
