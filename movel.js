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

    // ── Login (01/11): só pela janela do Google, igual ao computador. O "ir e voltar" (redirect) não funciona
    // no github.io com iPhone/Chrome novos (o navegador bloqueia o armazenamento do firebaseapp.com) e causava o vai e volta.
    function plataforma(ua, toques) {
        ua = String(ua || '');
        if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)) return 'ios';
        return /Android/.test(ua) ? 'android' : 'outro';
    }
    // Android: abre o mesmo endereço no Chrome; sem Chrome, o próprio aparelho abre o endereço normal
    function linkChrome(href) {
        const u = new URL(href);
        return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    }
    // motivo em português; nenhum erro mudo (o código vai junto para diagnóstico)
    function motivo(code) {
        const m = {
            'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de terminar.',
            'auth/cancelled-popup-request': 'A janela do Google foi fechada antes de terminar.',
            'auth/popup-blocked': 'Este navegador bloqueou a janela do Google.',
            'auth/operation-not-supported-in-this-environment': 'Este navegador não permite entrar com o Google.',
            'auth/web-storage-unsupported': 'Este navegador não permite entrar com o Google.',
            'auth/network-request-failed': 'Sem internet. Confira a conexão e tente de novo.',
            'auth/unauthorized-domain': 'Endereço não autorizado no Firebase. Avise o administrador.',
            'auth/internal-error': 'O Google não respondeu como esperado.',
        };
        return `${m[code] || 'Não foi possível entrar.'} (${code || 'sem código'})`;
    }

    // ── Login "ir e voltar" pela própria página (01/11): o Google devolve o comprovante (id_token) para o movel.html
    // no github.io, e o Firebase abre a sessão com ele (signInWithCredential). Não passa pelo firebaseapp.com, que o
    // iPhone bloqueia. Precisa do "ID do cliente da Web" do projeto e do endereço autorizado no Google Cloud.
    function urlGoogle(clientId, redirectUri, nonce, state) {
        const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'id_token',
            scope: 'openid email profile', nonce, state, prompt: 'select_account' });
        return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    }
    // lê o que o Google devolveu depois do # (id_token ou erro); nada → null
    function lerRetorno(hash) {
        const h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
        if (!h.has('id_token') && !h.has('error')) return null;
        return { idToken: h.get('id_token') || '', state: h.get('state') || '', erro: h.get('error') || '' };
    }
    function payloadJwt(t) {
        try {
            const b = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const txt = typeof atob === 'function' ? atob(b + '==='.slice((b.length + 3) % 4)) : Buffer.from(b, 'base64').toString('binary');
            return JSON.parse(decodeURIComponent(escape(txt)));
        } catch (e) { return null; }
    }
    // confere o retorno contra o que foi guardado na ida (state, nonce, validade de 10 min)
    function conferirRetorno(r, guardado, agora) {
        if (!r) return { ok: false, motivo: 'sem retorno' };
        if (r.erro) return { ok: false, motivo: r.erro === 'access_denied' ? 'Login cancelado no Google.' : `O Google recusou (${r.erro}).` };
        if (!guardado || !guardado.state) return { ok: false, motivo: 'Retorno do Google sem pedido neste aparelho. Toque em Entrar de novo.' };
        if (r.state !== guardado.state) return { ok: false, motivo: 'Retorno do Google não confere (state). Toque em Entrar de novo.' };
        if (agora - (guardado.ts || 0) > 10 * 60000) return { ok: false, motivo: 'O login demorou demais. Toque em Entrar de novo.' };
        const p = payloadJwt(r.idToken);
        if (!p || p.nonce !== guardado.nonce) return { ok: false, motivo: 'Comprovante do Google não confere (nonce). Toque em Entrar de novo.' };
        return { ok: true, email: p.email || '' };
    }

    // ── ADM: limpar e restaurar o painel (01/11). MESMO efeito do NitAdmin do computador (BR-ADM-001);
    // diferença: a LINHA DO TEMPO entra na MESMA gravação (tudo ou nada). Paridade testada em bateria-movel-paridade.js.
    const MAX_COPIAS = 5;
    function ultimaCopia(lix) {
        const es = Object.entries(lix || {}).map(([id, v]) => ({ id, ...v })).filter(v => v && v.ts).sort((a, b) => b.ts - a.ts);
        return es[0] || null;
    }
    function linhaDoTempo(texto, ts, por) { return { ts, por, tipo: 'acao', linhas: [texto] }; }
    // kanban/decisoes/lixeira: lidos do banco na hora; chaveAud: push().key de auditoria/{dia}
    function montarLimpeza({ kanban, decisoes, lixeira, ts, por, email, turno, dia, chaveAud }) {
        const cards = Object.keys(kanban || {}).length;
        const lote = {
            kanban: null, 'meta/decisoes_ativas': null, 'meta/dataReferencia': null,
            'meta/ultimoReset': { ts, operador: por, turno: turno || '' },
            [`lixeira/c${ts}`]: { ts, por, email: email || '', cards, kanban: kanban || null, decisoes_ativas: decisoes || null },
            [`auditoria/${dia}/${chaveAud}`]: linhaDoTempo(`🧹 Painel limpo (${cards} cards). Cópia guardada.`, ts, por),
        };
        Object.entries(lixeira || {}).sort((a, b) => ((b[1] && b[1].ts) || 0) - ((a[1] && a[1].ts) || 0)).slice(MAX_COPIAS - 1)
            .forEach(([id]) => { lote[`lixeira/${id}`] = null; });   // guarda só as últimas (plano gratuito)
        return { lote, cards };
    }
    function montarRestauro({ lixeira, kanban, decisoes, ts, por, dia, chaveAud }) {
        const u = ultimaCopia(lixeira);
        if (!u || u.restauradoTs) return null;
        const agora = kanban || {}, lote = {}; let n = 0;
        for (const [id, card] of Object.entries(u.kanban || {})) if (!agora[id]) { lote[`kanban/${id}`] = card; n++; }   // quem entrou depois fica
        if (!decisoes && u.decisoes_ativas) lote['meta/decisoes_ativas'] = u.decisoes_ativas;
        lote[`lixeira/${u.id}/restauradoTs`] = ts;
        lote[`lixeira/${u.id}/restauradoPor`] = por;
        lote[`auditoria/${dia}/${chaveAud}`] = linhaDoTempo(`↩ Painel restaurado (${n} cards).`, ts, por);
        return { lote, n, copia: u.id };
    }
    // CAUSAS DO DIA: mesmo critério da barra lateral do computador (todas as colunas do dia; sem causa = SEM CAUSA)
    function causas(por) {
        const cont = {};
        GRUPOS.forEach(g => por[g.id].forEach(c => { const k = sv(c.tipo).toUpperCase() || 'SEM CAUSA'; cont[k] = (cont[k] || 0) + 1; }));
        return Object.entries(cont).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }
    const confere = (digitado, palavra) => sv(digitado).toUpperCase() === palavra;

    // ── Copiar uma ocorrência (M1, 01/11): o MESMO texto do botão "Copiar Localização" do card no computador
    // (Semaforo.copiarLocalizacao): *CÓDIGO ENDEREÇO - PROBLEMA*, com os asteriscos (negrito no WhatsApp). Sem "Desde".
    function linhaCopiar(c) { return `*${sv(c.codigo)} ${sv(c.endereco)} - ${sv(c.problema)}*`; }

    // duração de uma ocorrência já encerrada: "33 min", "1h05", "1d 3h"
    function duracao(iniMs, fimMs) {
        if (iniMs == null || fimMs == null || fimMs < iniMs) return '';
        const min = Math.floor((fimMs - iniMs) / 60000);
        if (min < 60) return `${min} min`;
        const h = Math.floor(min / 60);
        return h < 24 ? `${h}h${String(min % 60).padStart(2, '0')}` : `${Math.floor(h / 24)}d ${h % 24}h`;
    }
    const equipeTxt = (eq, vt) => [sv(eq), sv(vt) && `VT ${sv(vt).replace(/^VT\s*/i, '')}`].filter(Boolean).join(' · ');
    // quem atuou: VIA LIVRE / AMC pela trajetória do card (colunaN, derivada do histórico) ou pela coluna onde estava
    function atuou(c) {
        const tr = sv(c.colunaN).toUpperCase(), tipos = [];
        if (/VIA LIVRE/.test(tr)) tipos.push('VIA LIVRE');
        if (/AMC/.test(tr)) tipos.push('AMC');
        const eq = [equipeTxt(c.equipe, c.viatura), equipeTxt(c.equipeApoio, c.viaturaApoio)].filter(Boolean).join(' + ');
        return [tipos.join(' → '), eq].filter(Boolean).join(' · ');
    }
    // campos dos detalhes. Normalizado (pedido do Cristiano, 01/11): só início, fim, tempo aberto e quem atuou.
    function camposDetalhe(c, g, agora) {
        const fim = `${sv(c.data_fim)} ${sv(c.hora_fim)}`.trim() || sv(c.fim);
        if (g.id === 'norm') return [['Início', sv(c.inicio)], ['Fim', fim],
            ['Tempo aberto', duracao(lerDataHora(c.inicio), lerDataHora(fim))], ['Atuou', atuou(c)]].filter(([, v]) => v);
        const L = linha(c, g.id, agora);
        return [['Situação', g.rot], ['Problema', sv(c.problema)], ['Causa', sv(c.tipo)], ['Início', sv(c.inicio)],
            ['Equipe', equipeTxt(c.equipe, c.viatura)], ['Apoio', equipeTxt(c.equipeApoio, c.viaturaApoio)], ['Tempo', L.tempo]].filter(([, v]) => v);
    }

    const Puro = { duracao, atuou, camposDetalhe, linhaCopiar, ultimaCopia, montarLimpeza, montarRestauro, causas, confere, MAX_COPIAS, urlGoogle, lerRetorno, payloadJwt, conferirRetorno, GRUPOS, hoje, chave, lerDataHora, desde, grupoDe, montar, totais, busca, linha, marcaVista, hhmm, plataforma, linkChrome, motivo };
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
        online: true, ultimo: null, carregado: false, demoraMs: 20000,
    };

    function tela(qual, msg) {
        ['m-login', 'm-app'].forEach(id => { $(id).hidden = id !== qual; });
        if (msg != null) $('m-login-status').textContent = msg;
        if (qual !== 'm-login') ajuda(false);
    }

    // instrução para sair do navegador interno (WhatsApp, Instagram...) quando a janela do Google não funciona
    function ajuda(mostrar) {
        const box = $('m-ajuda'); if (!box) return;
        box.hidden = !mostrar; if (!mostrar) return;
        const pl = plataforma(navigator.userAgent, navigator.maxTouchPoints || 0);
        $('m-ajuda-ios').hidden = pl !== 'ios';
        $('m-ajuda-android').hidden = pl !== 'android';
        $('m-ajuda-outro').hidden = pl !== 'outro';
        if (pl === 'android') $('m-abrir-chrome').href = linkChrome(location.href);
    }

    async function copiarLink() {
        const url = location.href.split('#')[0], b = $('m-copiar');
        try { await navigator.clipboard.writeText(url); b.textContent = '✓ Link copiado'; }
        catch (e) { window.prompt('Copie o link:', url); }   // sem permissão de copiar: mostra para copiar à mão
        setTimeout(() => { b.textContent = '📋 Copiar link'; }, 3000);
    }

    // rastro do login, guardado no aparelho: aparece na tela mesmo depois de ir ao Google e voltar
    const CH_PASSO = 'nit-movel-login-passo', CH_OIDC = 'nit-movel-oidc';
    function passo(txt) {
        const v = `${hhmm(Date.now())} ${txt}`; ls.set(CH_PASSO, v);
        const el = $('m-diag'); if (el) el.textContent = `${window.NIT_MOVEL_VERSAO || ''} · ${v}`;
    }
    const aleatorio = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
    const clienteGoogle = () => (window.NIT_GOOGLE_CLIENT || '').trim();
    const voltaPara = () => location.origin + location.pathname;

    function irAoGoogle() {
        const g = { nonce: aleatorio(), state: aleatorio(), ts: Date.now() };
        ls.set(CH_OIDC, JSON.stringify(g));
        passo('indo ao Google');
        $('m-btn-login').disabled = true; tela('m-login', 'Abrindo o Google...');
        location.assign(urlGoogle(clienteGoogle(), voltaPara(), g.nonce, g.state));
    }

    // voltou do Google? confere e entrega ao Firebase. true = havia retorno (tratado aqui)
    async function tratarRetorno() {
        const r = lerRetorno(location.hash); if (!r) return false;
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* segue */ }   // tira o comprovante do endereço
        let g = null; try { g = JSON.parse(ls.get(CH_OIDC) || 'null'); } catch (e) { g = null; }
        ls.set(CH_OIDC, '');
        const c = conferirRetorno(r, g, Date.now());
        if (!c.ok) { passo(`voltou: ${c.motivo}`); tela('m-login', c.motivo); $('m-btn-login').disabled = false; return true; }
        passo('voltou do Google; abrindo sessão');
        tela('m-login', 'Entrando...');
        try {
            await firebase.auth().signInWithCredential(firebase.auth.GoogleAuthProvider.credential(r.idToken));
            passo('sessão aberta');
        } catch (e) {
            console.error('[NitMovel] credencial:', e && e.code, e);
            passo(`erro ${e && e.code}`);
            tela('m-login', motivo(e && e.code)); $('m-btn-login').disabled = false;
        }
        return true;
    }

    let _demora = null;
    async function entrar() {
        if (clienteGoogle()) { irAoGoogle(); return; }   // configurado: ir e voltar pela própria página
        passo('janela do Google');
        const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
        $('m-btn-login').disabled = true; tela('m-login', 'Abrindo o Google...'); ajuda(false);
        clearTimeout(_demora);   // janela que nunca responde (alguns navegadores internos): mostra a saída sem cancelar
        _demora = setTimeout(() => { $('m-login-status').textContent = 'O Google está demorando. Se nada abriu, use o navegador:'; ajuda(true); $('m-btn-login').disabled = false; }, S.demoraMs);
        try { await firebase.auth().signInWithPopup(p); clearTimeout(_demora); passo('janela: sessão aberta'); }
        catch (e) {
            clearTimeout(_demora);
            console.error('[NitMovel] login:', e && e.code, e);
            passo(`janela: erro ${e && e.code}`);
            tela('m-login', motivo(e && e.code));
            if (e && e.code !== 'auth/network-request-failed' && e.code !== 'auth/unauthorized-domain') ajuda(true);
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
            const d = aut.val() || {};
            S.operador = d.nome || user.displayName || user.email; S.turno = d.turno || ''; S.email = user.email; S.adm = true;
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
        montarPaginas(); montarAbas(); montarToques();
        $('a-email').textContent = S.email || ''; $('a-versao').textContent = window.NIT_MOVEL_VERSAO || '';
        assinarDia();
        S.db.ref('lixeira').on('value', snap => { S.lixeira = snap.val(); renderAdm(); }, () => { S.lixeira = null; renderAdm(); });
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

    // ── Ocorrências: uma página por lista, lado a lado. Arrastar para o lado troca a lista; o filtro acompanha.
    const PAGINAS = [...GRUPOS.map(g => g.id), 'todos'];
    function montarPaginas() {
        const box = $('m-paginas'); if (box.childElementCount) return;
        PAGINAS.forEach(id => { const pg = document.createElement('section'); pg.className = 'm-pag'; pg.dataset.pag = id; box.append(pg); });
        let raf = 0;
        box.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
            const i = Math.round(box.scrollLeft / Math.max(1, box.clientWidth)), id = PAGINAS[i];
            if (S._indo) { if (id === S._indo) S._indo = null; return; }   // indo por toque no filtro: não trocar no meio do caminho
            if (id && id !== S.filtro) { S.filtro = id; ls.set(CH_FILTRO, id); marcarFiltro(true); }
        }); }, { passive: true });
        window.addEventListener('resize', () => irPara(S.filtro, false));
    }
    function irPara(id, suave) {
        const box = $('m-paginas'), i = Math.max(0, PAGINAS.indexOf(id)), alvo = i * box.clientWidth;
        if (Math.abs(box.scrollLeft - alvo) < 2) { S._indo = null; return; }
        S._indo = id; clearTimeout(S._indoT); S._indoT = setTimeout(() => { S._indo = null; }, 1200);   // trava de segurança
        box.scrollTo({ left: alvo, behavior: suave ? 'smooth' : 'auto' });
    }
    function marcarFiltro(centralizar) {
        document.querySelectorAll('.m-chip').forEach(b => b.classList.toggle('on', b.dataset.id === S.filtro));
        document.querySelectorAll('.m-pag').forEach(pg => pg.classList.toggle('on', pg.dataset.pag === S.filtro));
        const on = document.querySelector('.m-chip.on');
        if (centralizar && on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }

    function linhaEl(c, g, agora, primeira) {
        const L = linha(c, g.id, agora), novo = !primeira && !S.vistos.has(marcaVista(c, g.id));
        const r = document.createElement('div'); r.className = 'm-r' + (L.alerta ? ' m-alerta' : ''); r.style.setProperty('--c', `var(--${g.cor})`);
        r.innerHTML = '<div class="m-av"></div><div class="m-m"><div class="m-a"><b></b><time></time></div><div class="m-z"><span></span></div></div>';
        r.querySelector('.m-av').textContent = c.codigo;
        r.querySelector('b').textContent = L.titulo;
        r.querySelector('time').textContent = L.tempo;
        r.querySelector('.m-z span').textContent = L.sub;
        if (novo) { const n = document.createElement('i'); n.className = 'm-novo'; n.textContent = 'novo'; r.querySelector('.m-z').append(n); }
        r.dataset.id = c.eventoId; r.dataset.g = g.id;
        return r;
    }

    // ── Tocar = detalhes (texto inteiro + Copiar). Segurar e soltar = copia direto (o iPhone só deixa copiar no soltar).
    async function copiarTexto(txt) {
        try { await navigator.clipboard.writeText(txt); return true; } catch (e) { /* tenta o jeito antigo */ }
        try {
            const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.append(ta); ta.select(); ta.setSelectionRange(0, txt.length);
            const ok = document.execCommand('copy'); ta.remove(); return ok;
        } catch (e) { return false; }
    }
    let _avisoT = null;
    function aviso(txt) { const el = $('m-aviso'); el.textContent = txt; el.hidden = false; clearTimeout(_avisoT); _avisoT = setTimeout(() => { el.hidden = true; }, 2200); }
    const cardDe = r => { const c = (S.kanban || {})[r.dataset.id]; return c ? { ...c, eventoId: r.dataset.id, codigo: sv(c.codigo) || r.dataset.id.split('_')[0] } : null; };
    async function copiarLinha(r) {
        const c = cardDe(r); if (!c) return;
        const ok = await copiarTexto(linhaCopiar(c));
        aviso(ok ? `📋 ${c.codigo} copiado` : 'Não deu para copiar. Abra e use o botão Copiar.');
        if (!ok) abrirDetalhe(r);
    }
    function abrirDetalhe(r) {
        const c = cardDe(r); if (!c) return;
        const g = GRUPOS.find(x => x.id === r.dataset.g) || GRUPOS[0];
        $('d-cod').textContent = c.codigo; $('d-cod').style.setProperty('--c', `var(--${g.cor})`);
        $('d-end').textContent = sv(c.endereco) || '(sem endereço)';
        const campos = camposDetalhe(c, g, Date.now());
        $('d-campos').replaceChildren(...campos.map(([k, v]) => { const d = document.createElement('div'); d.innerHTML = '<span></span><b></b>';
            d.firstChild.textContent = k; d.lastChild.textContent = v; return d; }));
        $('d-texto').textContent = linhaCopiar(c);
        $('m-det').hidden = false; S._det = r;
    }
    function montarToques() {
        const box = $('m-paginas'); let alvo = null, t0 = null, x0 = 0, y0 = 0, segurou = false;
        const limpar = () => { clearTimeout(t0); if (alvo) alvo.classList.remove('m-segurando'); alvo = null; };
        box.addEventListener('touchstart', e => {
            const r = e.target.closest('.m-r'); if (!r) return;
            alvo = r; segurou = false; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
            t0 = setTimeout(() => { segurou = true; r.classList.add('m-segurando'); try { navigator.vibrate && navigator.vibrate(15); } catch (x) { /* segue */ } }, 450);
        }, { passive: true });
        box.addEventListener('touchmove', e => { if (!alvo) return; const t = e.touches[0];
            if (Math.abs(t.clientX - x0) > 10 || Math.abs(t.clientY - y0) > 10) limpar(); }, { passive: true });   // rolando: não é toque na linha
        box.addEventListener('touchend', e => { const r = alvo, s = segurou; limpar(); if (r && s) { e.preventDefault(); copiarLinha(r); } });
        box.addEventListener('touchcancel', limpar);
        box.addEventListener('contextmenu', e => { if (e.target.closest('.m-r')) e.preventDefault(); });   // sem o menu do sistema por cima
        box.addEventListener('click', e => { const r = e.target.closest('.m-r'); if (r) abrirDetalhe(r); });
        $('d-fechar').addEventListener('click', () => { $('m-det').hidden = true; });
        $('d-veu').addEventListener('click', () => { $('m-det').hidden = true; });
        $('d-copiar').addEventListener('click', async () => { const ok = await copiarTexto($('d-texto').textContent);
            aviso(ok ? '📋 Copiado' : 'Não deu para copiar: selecione o texto e copie.'); if (ok) $('m-det').hidden = true; });
    }
    function cabecalho(g, n) {
        const h = document.createElement('div'); h.className = 'm-gh'; h.style.setProperty('--c', `var(--${g.cor})`);
        h.innerHTML = `<span></span><em>${n}</em>`; h.firstChild.textContent = g.tit;
        if (g.ordem) { const o = document.createElement('small'); o.textContent = ` · ${g.ordem}`; h.firstChild.append(o); }
        return h;
    }
    const vazio = txt => { const p = document.createElement('p'); p.className = 'm-vazio'; p.textContent = txt; return p; };

    function render() {
        renderEstado();
        if (!$('m-paginas').childElementCount) return;
        const agora = Date.now(), por = montar(S.kanban, S.dia), t = totais(por);
        S.por = por;
        $('m-resumo').textContent = `${t.pend} pend. · ${t.norm} norm.`;
        S.atuais = new Set(GRUPOS.flatMap(g => por[g.id].map(c => marcaVista(c, g.id))));
        const primeira = S.vistos.size === 0;   // 1ª visita no aparelho: nada é "novo"
        const nEsp = por.espera.length, sup = $('m-abas-n'); sup.hidden = !nEsp; sup.textContent = nEsp;

        // filtros com contagem (o "novo" de cada lista vira ponto no filtro)
        const chips = [...GRUPOS.map(g => ({ id: g.id, rot: g.rot, n: por[g.id].length, cor: g.cor,
            novos: primeira ? 0 : por[g.id].filter(c => !S.vistos.has(marcaVista(c, g.id))).length })),
            { id: 'todos', rot: 'Todos', n: t.total, cor: 'tx2', novos: 0 }];
        $('m-chips').replaceChildren(...chips.map(ch => {
            const b = document.createElement('button'); b.type = 'button'; b.dataset.id = ch.id;
            b.className = 'm-chip'; b.style.setProperty('--c', `var(--${ch.cor})`);
            b.innerHTML = `${ch.rot}<b>${ch.n}</b>${ch.novos ? '<i class="m-chip-novo"></i>' : ''}`;
            b.addEventListener('click', () => { S.filtro = ch.id; ls.set(CH_FILTRO, ch.id); marcarFiltro(true); irPara(ch.id, true); });
            return b;
        }));

        // cada página: a lista dela (Todos = todas, com cabeçalho por lista)
        PAGINAS.forEach(id => {
            const pg = document.querySelector(`.m-pag[data-pag="${id}"]`), frag = document.createDocumentFragment();
            if (!S.carregado) { pg.replaceChildren(vazio('Carregando...')); return; }
            const gs = id === 'todos' ? GRUPOS : GRUPOS.filter(g => g.id === id);
            let mostrou = 0;
            gs.forEach(g => {
                const itens = por[g.id].filter(c => busca(c, S.q));
                if (!itens.length && id === 'todos') return;
                frag.append(cabecalho(g, itens.length));
                if (!itens.length) frag.append(vazio(S.q ? 'Nada encontrado.' : 'Nenhuma ocorrência aqui.'));
                itens.forEach(c => { frag.append(linhaEl(c, g, agora, primeira)); mostrou++; });
            });
            if (!mostrou && id === 'todos') frag.append(vazio(S.q ? 'Nada encontrado.' : 'Nenhuma ocorrência hoje.'));
            pg.replaceChildren(frag);
        });
        marcarFiltro(false);
        if (!S._posicionado) { S._posicionado = true; requestAnimationFrame(() => irPara(S.filtro, false)); }
        renderResumo(por, t);
        renderAdm();
    }

    // ── Resumo
    function renderResumo(por, t) {
        $('r-total').textContent = t.total; $('r-pend').textContent = t.pend; $('r-norm').textContent = t.norm;
        $('r-estados').replaceChildren(...GRUPOS.map(g => { const d = document.createElement('div'); d.style.setProperty('--c', `var(--${g.cor})`);
            d.innerHTML = '<span></span><b></b>'; d.firstChild.textContent = g.tit; d.lastChild.textContent = por[g.id].length; return d; }));
        const cs = causas(por);
        $('r-causas').replaceChildren(...(cs.length ? cs.map(([k, n]) => { const e = document.createElement('span'); e.textContent = k;
            const b = document.createElement('b'); b.textContent = n; e.append(b); return e; }) : [vazio('Nenhuma ocorrência hoje.')]));
    }

    // ── Abas
    function montarAbas() {
        document.querySelectorAll('#m-abas button').forEach(b => b.addEventListener('click', () => abrirAba(b.dataset.aba)));
    }
    function abrirAba(aba) {
        S.aba = aba;
        document.querySelectorAll('#m-abas button').forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
        $('v-ocorr').hidden = aba !== 'ocorr'; $('v-resumo').hidden = aba !== 'resumo'; $('v-adm').hidden = aba !== 'adm';
        $('m-filtros').hidden = aba !== 'ocorr';
        if (aba === 'ocorr') requestAnimationFrame(() => irPara(S.filtro, false));
    }

    // ── ADM: limpar / restaurar (mesmo efeito do computador; confirmação digitando a palavra)
    function renderAdm() {
        const u = ultimaCopia(S.lixeira), b = $('a-restaurar'); if (!b) return;
        b.hidden = !(u && !u.restauradoTs);
        if (u) $('a-restaurar-info').textContent = `limpo às ${hhmm(u.ts)} · ${u.cards || 0} cards`;
    }
    function admMsg(txt, tipo) { const el = $('m-adm-msg'); el.textContent = txt; el.className = tipo || ''; }

    let _folha = null;
    function confirmar({ titulo, texto, palavra, rotulo, acao }) {
        _folha = { palavra, acao };
        $('m-folha-tit').textContent = titulo; $('m-folha-txt').textContent = texto;
        $('m-folha-palavra').textContent = palavra; $('m-folha-ok').textContent = rotulo;
        $('m-palavra').value = ''; $('m-folha-ok').disabled = true; $('m-folha').hidden = false;
        setTimeout(() => { try { $('m-palavra').focus(); } catch (e) { /* sem foco: segue */ } }, 60);
    }
    function fecharFolha() { $('m-folha').hidden = true; _folha = null; try { $('m-palavra').blur(); } catch (e) { /* segue */ } }
    async function okFolha() {
        if (!_folha || !confere($('m-palavra').value, _folha.palavra)) return;   // sem a palavra, nada acontece
        const f = _folha; fecharFolha(); await f.acao();
    }
    function montarFolha() {
        $('m-palavra').addEventListener('input', () => { $('m-folha-ok').disabled = !(_folha && confere($('m-palavra').value, _folha.palavra)); });
        $('m-palavra').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); okFolha(); } });
        $('m-folha-ok').addEventListener('click', okFolha);
        $('m-folha-cancelar').addEventListener('click', fecharFolha);
        $('m-veu').addEventListener('click', fecharFolha);
        $('a-limpar').addEventListener('click', async () => {
            let n = '?'; try { n = Object.keys((await S.db.ref('kanban').get()).val() || {}).length; } catch (e) { /* mostra "?" */ }
            confirmar({ titulo: '🧹 Limpar o painel?', palavra: 'LIMPAR', rotulo: 'Limpar painel', acao: limpar,
                texto: `Apaga os ${n} cards e os avisos para todos os operadores. Fica uma cópia: dá para restaurar depois.` });
        });
        $('a-restaurar').addEventListener('click', () => confirmar({ titulo: '↩ Restaurar o painel?', palavra: 'RESTAURAR', rotulo: 'Restaurar painel', acao: restaurar,
            texto: 'Devolve os cards e os avisos do último painel limpo. Cards que entraram depois continuam.' }));
    }
    const diaChave = () => S.dia.replace(/\D/g, '');
    async function limpar() {
        admMsg('Limpando...');
        try {
            const ler = async p => (await S.db.ref(p).get()).val();
            const [kanban, decisoes, lixeira] = await Promise.all([ler('kanban'), ler('meta/decisoes_ativas'), ler('lixeira')]);
            const { lote, cards } = montarLimpeza({ kanban, decisoes, lixeira, ts: Date.now(), por: S.operador, email: S.email, turno: S.turno,
                dia: diaChave(), chaveAud: S.db.ref(`auditoria/${diaChave()}`).push().key });
            await S.db.ref().update(lote);
            admMsg(`Painel limpo. ${cards} cards guardados na cópia.`, 'ok'); passo(`limpou o painel (${cards})`);
        } catch (e) {
            console.error('[NitMovel] limpar', e);
            admMsg(`❌ Não deu para limpar. Nada foi apagado. (${(e && (e.code || e.message)) || e})`, 'ruim');
        }
    }
    async function restaurar() {
        admMsg('Restaurando...');
        try {
            const ler = async p => (await S.db.ref(p).get()).val();
            const [lixeira, kanban, decisoes] = await Promise.all([ler('lixeira'), ler('kanban'), ler('meta/decisoes_ativas')]);
            const r = montarRestauro({ lixeira, kanban, decisoes, ts: Date.now(), por: S.operador, dia: diaChave(), chaveAud: S.db.ref(`auditoria/${diaChave()}`).push().key });
            if (!r) { admMsg('Nada para restaurar.'); return; }
            await S.db.ref().update(r.lote);
            admMsg(`Painel restaurado: ${r.n} cards de volta.`, 'ok'); passo(`restaurou o painel (${r.n})`);
        } catch (e) {
            console.error('[NitMovel] restaurar', e);
            admMsg(`❌ Não deu para restaurar. Nada foi mudado. (${(e && (e.code || e.message)) || e})`, 'ruim');
        }
    }

    // 01/11: nenhum erro mudo na partida (sem isto, uma falha deixava o botão sem reação e a tela sem explicação)
    function erroNaTela(onde, e, sempre = true) {
        const msg = `${onde}: ${(e && (e.code || e.message)) || e}`;
        try { console.error('[NitMovel]', msg, e); passo(`erro ${msg}`); } catch (x) { /* segue */ }
        // erro solto da página: só aparece na tela de login e sem apagar outra mensagem
        const st = document.getElementById('m-login-status'), naLista = !document.getElementById('m-app')?.hidden;
        if (st && (sempre || (!naLista && !st.textContent))) st.textContent = `Falha ao iniciar (${msg}). Atualize a página.`;
    }
    window.addEventListener('error', ev => erroNaTela('página', ev.error || ev.message, false));
    window.addEventListener('unhandledrejection', ev => erroNaTela('página', ev.reason, false));
    document.addEventListener('DOMContentLoaded', () => { try { iniciarPagina(); } catch (e) { erroNaTela('início', e); } });
    function iniciarPagina() {
        const ult0 = ls.get(CH_PASSO); if ($('m-diag')) $('m-diag').textContent = `${window.NIT_MOVEL_VERSAO || ''}${ult0 ? ' · ' + ult0 : ''}`;
        if (!window.firebase || !firebase.initializeApp) throw new Error('Firebase não carregou (rede ou bloqueador)');
        if (!firebase.apps.length) firebase.initializeApp(window.NIT_FIREBASE_CFG);
        S.db = firebase.database();
        $('m-btn-login').addEventListener('click', entrar);
        $('m-busca').addEventListener('input', e => { S.q = e.target.value; render(); });
        $('m-computador').addEventListener('click', e => { e.preventDefault(); location.href = 'index.html?versao=computador'; });
        $('m-sair').addEventListener('click', () => firebase.auth().signOut().then(() => location.reload()));
        $('m-copiar').addEventListener('click', copiarLink);
        montarFolha();
        let retorno = false;
        const pronto = tratarRetorno().then(v => { retorno = v; }).catch(() => {});
        firebase.auth().onAuthStateChanged(async u => {
            await pronto;
            if (u) verificar(u);
            else if (!retorno) { tela('m-login', ''); $('m-btn-login').disabled = false; }
        });
    }
    raiz.NitMovel = { S, render, Puro };
})(typeof window !== 'undefined' ? window : globalThis);
