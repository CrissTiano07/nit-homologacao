/* ============================================================================
   NIT — Módulo Reboques  ·  reboques.js  ·  v2026.07.09
   Gestão de reboquistas: Disponíveis | Atuando | Ocorrências em Andamento
   Módulo isolado (IIFE). Não toca em /kanban/, /efetivo/ ou qualquer path
   do Semáforo. Auto-inicializa via onAuthStateChanged.
   ============================================================================ */
const NitReboques = (() => {
    'use strict';

    // ── Paths Firebase ──────────────────────────────────────────────────────
    const PATH_BASE        = 'reboques/plantao_ativo';
    const PATH_REBOQUISTAS = PATH_BASE + '/reboquistas';
    const PATH_EVENTOS     = PATH_BASE + '/eventos';
    const PATH_CONFIG      = 'reboques_config';

    // ── Estado ──────────────────────────────────────────────────────────────
    const S = {
        db: null, inicializado: false, uiBound: false,
        reboquistas: {}, eventos: {},
        refs: { reboquistas: null, eventos: null },
        draggedId: null, isDragging: false, pendingRender: false,
        multi: { ids: [] },
        editandoEventoId: null,
        buscaEventos: '', buscaDisponiveis: '', buscaAtuando: '',
    };

    // ── Utils ────────────────────────────────────────────────────────────────
    const g   = id => document.getElementById(id);
    const esc = v  => String(v ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    function toast(msg, tipo) {
        typeof window.showToast === 'function'
            ? window.showToast(msg, tipo)
            : console.log(`[NitReboques][${tipo||'info'}] ${msg}`);
    }
    const agoraHHMM = () => new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const hojeISO   = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const hojeBR    = () => new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'.');
    const novoId    = pre => `${pre}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
    const maxOrdem  = coll => Object.values(coll||{}).reduce((m,r)=>(typeof r?.ordem==='number'&&r.ordem>m?r.ordem:m),-1);
    function copiarTexto(txt) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(txt).then(()=>true).catch(()=>_fbCopy(txt));
        return Promise.resolve(_fbCopy(txt));
    }
    function _fbCopy(txt) {
        try { const t=document.createElement('textarea'); t.value=txt; t.style.cssText='position:fixed;opacity:0'; document.body.appendChild(t); t.select(); const ok=document.execCommand('copy'); document.body.removeChild(t); return ok; } catch { return false; }
    }
    const _abrirModal  = el => el?.classList.add('aberto');
    const _fecharModal = el => el?.classList.remove('aberto');

    // ── Ícones SVG (outline 24×24) ───────────────────────────────────────────
    const I = {
        edit:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        trash:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        check:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        dispatch:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
        ban:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
        pencil:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="2" x2="22" y2="6"/><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"/></svg>`,
        copy:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        wa:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
        send:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
        plus:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        save:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
        // info-line icons
        truck:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
        clock:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        phone:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
        info:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        mappin:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        comment: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    };

    // ── Init / Destroy ───────────────────────────────────────────────────────
    function inicializar(db) {
        if (S.inicializado) return;
        if (!db) { console.error('[NitReboques] db inválido'); return; }
        if (!g('tab-reboques')) { console.error('[NitReboques] markup ausente'); return; }
        S.db = db;
        if (!S.uiBound) { _bindUI(); _bindTabsFallback(); S.uiBound = true; }
        // Estado inicial: se a aba Reboques já estiver ativa, oculta a busca global
        if (g('tab-reboques')?.classList.contains('active')) _toggleBuscaGlobal(false);
        _iniciarListeners();
        S.inicializado = true;
        console.log('[NitReboques] inicializado.');
    }
    function destruir() {
        Object.values(S.refs).forEach(r => r?.off());
        S.refs = { reboquistas: null, eventos: null };
        S.inicializado = false;
    }

    // ── Firebase listeners ───────────────────────────────────────────────────
    function _iniciarListeners() {
        const err = t => e => { console.error(`[NitReboques] ${t}:`, e); toast(`Erro: ${t}`,'error'); };
        S.refs.reboquistas = S.db.ref(PATH_REBOQUISTAS);
        S.refs.eventos     = S.db.ref(PATH_EVENTOS);
        S.refs.reboquistas.on('value', s => { S.reboquistas = s.val()||{}; _render(); }, err('reboquistas'));
        S.refs.eventos    .on('value', s => { S.eventos     = s.val()||{}; _render(); }, err('eventos'));
    }
    function _render() {
        if (S.isDragging) { S.pendingRender = true; return; }
        _renderKanban();
        _renderEventos();
        _atualizarBalanco();
    }

    // ── Parser ───────────────────────────────────────────────────────────────
    function _splitBlocos(bruto) {
        const raw = bruto
            .replace(/\r\n?/g, '\n')
            .replace(/\/\//g, '\n\n')
            .replace(/^-{3,}\s*$/gm, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .split(/\n\s*\n/)
            .map(b => b.trim())
            .filter(b => b.length > 0);
        const merged = [];
        for (const bloco of raw) {
            const prim = bloco.split('\n')[0].trim();
            if (merged.length > 0 && !_ehCabecalhoReboquista(prim)) {
                merged[merged.length - 1] += '\n' + bloco;
            } else { merged.push(bloco); }
        }
        // Split secundário por nomes ALL-CAPS — resolve relatórios sem linha em branco
        const final = [];
        for (const bloco of merged) {
            const linhas = bloco.split('\n').map(l => l.trim()).filter(l => l);
            let sub = [];
            for (const linha of linhas) {
                if (sub.length > 0 && _ehCabecalhoReboquista(linha)) {
                    final.push(sub.join('\n')); sub = [linha];
                } else { sub.push(linha); }
            }
            if (sub.length > 0) final.push(sub.join('\n'));
        }
        return final;
    }
    function _ehCabecalhoReboquista(linha) {
        if (linha.includes('🚨')) return false; // linha VT de reboquista = continuação
        // Nome em MAIÚSCULAS (reboquista)
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ\s]{4,}$/.test(linha) && !/\d/.test(linha)) return true;
        return false;
    }
    function _isRuido(l) {
        if (!l || l.length < 2) return true;
        if (/boa\s+(?:tarde|noite|manh[ãa])|bom\s+dia/i.test(l)) return true;
        if (/\bQRV\b/i.test(l)) return true;
        if ((l.match(/[a-zA-ZÀ-ÿ]/g)||[]).length < 3) return true;
        if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(l)) return true;
        return false;
    }
    function _normHorario(raw) {
        let s = raw.trim().replace(/\s+/g,'').replace(/;/g,':');
        s = s.replace(/^(\d{1,2})h(\d{2})$/i, '$1:$2');
        if (/^\d{1,2}:\d{2}/.test(s)) return s.replace(/h.*$/i,'').trim()+'hs';
        return s.replace(/h.*$/i,'').trim()+'hs';
    }
    function _normTelefone(ddd, num) {
        const n = num.replace(/\D/g,'');
        return `(${ddd.replace(/\D/g,'')}) ${n.length>=9?n.replace(/(\d{4,5})(\d{4})$/,'$1-$2'):n}`;
    }
    function _extrairBloco(bloco) {
        const linhas = bloco.split('\n').map(l=>l.trim()).filter(l=>l);
        if (!linhas.length) return null;
        const temVT      = linhas.some(l=>/VT[\s\-:\.]*\d+/i.test(l));
        const temPlantao = linhas.some(l=>/plant[aã]o|at[eé]\s+[àa]?s?\s*\d/i.test(l));
        const temContato = linhas.some(l=>/(?:smart|celular|tel[ef]\.?|fone|whats(?:app)?|zap|contato)\s*[:\-]/i.test(l));
        if (!temVT && !temPlantao && !temContato) return null;
        return _parseReboquista(linhas);
    }
    function _parseReboquista(linhas) {
        const linhaNome = linhas.find(l => {
            if (_isRuido(l)) return false;
            if (/VT[\s\-:\.]*[\d\w]+/i.test(l)) return false;
            if (/[🚨🔴🟡🟢]/u.test(l)) return false;
            if (/plant[aã]o|at[eé]\s+[àa]?s?\s*\d/i.test(l)) return false;
            if (/(?:smart|celular|tel[ef]\.?|fone|whats(?:app)?|zap|contato)\s*[:\-]/i.test(l)) return false;
            if (/vistoriador|assumir.*hora|central|supervis/i.test(l)) return false;
            if (/^\d+$/.test(l) || l.length < 3) return false;
            return true;
        });
        if (!linhaNome) return null;
        const d = { tipoRecurso:'reboquista', nome:linhaNome.trim().toUpperCase().replace(/\s+/g,' '), vt:'N/I', placa:'N/I', plantao:'N/I', smart:'N/I' };
        linhas.forEach(l => {
            // Plantão: aceita "18h00" (NNhNN) além dos formatos anteriores
            const pm = l.match(/plant[aã]o\s*[:\-]?\s*(?:at[eé]?\s+)?(?:[àas]+\s*)?([\d:;]+\s*h\d*[ro]?[sa]?)/i)
                    || l.match(/at[eé]?\s+[àas]?\s*([\d:;]+\s*h\d*[ro]?[sa]?)/i);
            if (pm) d.plantao = _normHorario(pm[1]);
            const sm = l.match(/(?:smart|celular|tel[ef]\.?|fone|whats(?:app)?|zap|contato)\s*[:\-]?\s*\(?\s*(\d{2})\s*\)?\s*[\s.\-]?([\d\s.\-]{8,})/i);
            if (sm) d.smart = _normTelefone(sm[1],sm[2]);
            if (!sm) { const tel=l.match(/^\(?\s*(\d{2})\s*\)?\s*[\s.\-]?(9?\d{4}[\s.\-]?\d{4})\s*$/); if(tel) d.smart=_normTelefone(tel[1],tel[2]); }
            // VT: usa apenas a PRIMEIRA ocorrência — evita sobrescrever com VT de bloco de manutenção adjacente
            if (d.vt === 'N/I') {
                const lSem = l.replace(/[\u{1F000}-\u{1FFFF}]/gu,' ');
                const vm = lSem.match(/VT[\s\-:\.]*(\d+)\s*[\s\/\-]*([A-Z]{2,3}\s*[\dA-Z]{3,7})?/i);
                if (vm) { d.vt=vm[1].trim(); d.placa=vm[2]?.replace(/\s/g,'').toUpperCase()||'N/I'; }
            }
        });
        return d;
    }
    function processarPlantao() {
        const bruto = g('nit-rb-bruto')?.value.trim();
        if (!bruto) { toast('Insira o relatório de plantão.','warning'); return; }
        const blocos = _splitBlocos(bruto);
        const updates = {}; let novos=0, atualizados=0;
        let ordR = maxOrdem(S.reboquistas);
        const nomExiste = nome => Object.values(S.reboquistas).some(r=>r?.nome===nome);
        blocos.forEach(bloco => {
            const d = _extrairBloco(bloco);
            if (!d) return;
            if (!nomExiste(d.nome)) {
                const id = novoId('reb');
                updates[`${PATH_REBOQUISTAS}/${id}`] = { nome:d.nome, vt:d.vt, placa:d.placa, plantao:d.plantao, smart:d.smart, status:'disponivel', eventoId:'', ocorrencia:'', ordem:++ordR };
                S.reboquistas[id] = updates[`${PATH_REBOQUISTAS}/${id}`];
                novos++;
            } else {
                // upsert — atualiza campos vazios
                const ex = Object.entries(S.reboquistas).find(([,r])=>r?.nome===d.nome);
                if (ex) {
                    const [eid, ev] = ex;
                    const campos = { vt:d.vt, placa:d.placa, plantao:d.plantao, smart:d.smart };
                    let atualizado=false;
                    Object.entries(campos).forEach(([k,v])=>{ if(v&&v!=='N/I'&&(!ev[k]||ev[k]==='N/I')){ updates[`${PATH_REBOQUISTAS}/${eid}/${k}`]=v; atualizado=true; } });
                    if (atualizado) atualizados++;
                }
            }
        });
        if (!novos && !atualizados) { toast('Nenhum reboquista novo ou atualização encontrada.','info'); return; }
        updates[`${PATH_CONFIG}/data`] = hojeISO();
        const msg=[novos&&`${novos} adicionado(s)`, atualizados&&`${atualizados} atualizado(s)`].filter(Boolean).join(', ');
        S.db.ref().update(updates)
            .then(()=>{ toast(`Processado: ${msg}.`,'success'); if(g('nit-rb-bruto')) g('nit-rb-bruto').value=''; _fecharModal(g('nit-reboque-modal-processar')); })
            .catch(e=>{console.error(e);toast('Falha ao gravar.','error');});
    }

    // ── Render ───────────────────────────────────────────────────────────────
    function _sorted(status, busca) {
        let lista = Object.entries(S.reboquistas)
            .filter(([,r])=>r&&r.status===status)
            .sort((a,b)=>(a[1].ordem??0)-(b[1].ordem??0)||String(a[1].nome).localeCompare(String(b[1].nome)));
        if (busca) {
            const q = busca.toLowerCase();
            lista = lista.filter(([,r])=>
                [r.nome,r.vt,r.placa,r.smart,r.plantao].some(v=>String(v||'').toLowerCase().includes(q))
            );
        }
        return lista;
    }
    function _cardReboquistaHTML(id, r) {
        const atuando  = r.status==='atuando';
        const tagLabel = atuando ? 'ATUANDO' : 'DISPONÍVEL';
        const tagClass = atuando ? 'atuando' : 'disponivel';
        return `
        <div class="nit-reb-card" draggable="true" data-id="${esc(id)}" data-status="${esc(r.status)}">
            <div class="nit-reb-card-header">
                <strong class="nit-reb-nome">${esc(r.nome||'N/I')}</strong>
                <span class="nit-reb-badge ${tagClass}">${tagLabel}</span>
            </div>
            <div class="nit-reb-card-body">
                <div class="nit-reb-info">${I.truck}<span class="nit-reb-mono">VT ${esc(r.vt||'N/I')} · ${esc(r.placa||'N/I')}</span></div>
                <div class="nit-reb-info">${I.clock}Plantão até ${esc(r.plantao||'N/I')}</div>
                <div class="nit-reb-info">${I.phone}<span class="nit-reb-mono">${esc(r.smart||'N/I')}</span></div>
                ${atuando&&r.ocorrencia?`<div class="nit-reb-ocorrencia">${I.info}${esc(r.ocorrencia)}</div>`:''}
            </div>
            <div class="nit-reb-card-footer">
                <button class="nit-reb-acao js-editar"  title="Editar">${I.edit}</button>
                <button class="nit-reb-acao js-remover" title="Remover">${I.trash}</button>
                <span style="flex:1"></span>
                ${atuando
                    ? `<button class="nit-reb-acao js-finalizar" title="Finalizar atendimento">${I.check}</button>`
                    : `<button class="nit-reb-acao js-acionar"  title="Acionar para ocorrência">${I.dispatch}</button>`}
            </div>
        </div>`;
    }
    function _renderKanban() {
        const disp = _sorted('disponivel', S.buscaDisponiveis);
        const atua = _sorted('atuando',    S.buscaAtuando);
        const colD = g('nit-reb-cards-disponiveis');
        const colA = g('nit-reb-cards-atuando');
        if (colD) colD.innerHTML = disp.length ? disp.map(([id,r])=>_cardReboquistaHTML(id,r)).join('') : `<div class="nit-reb-vazio">${S.buscaDisponiveis?'Nenhum resultado para a busca.':'Nenhum reboquista disponível.'}</div>`;
        if (colA) colA.innerHTML = atua.length ? atua.map(([id,r])=>_cardReboquistaHTML(id,r)).join('') : `<div class="nit-reb-vazio">${S.buscaAtuando?'Nenhum resultado para a busca.':'Nenhum em atendimento.'}</div>`;
        const set=(id,v)=>{const el=g(id);if(el)el.textContent=v;};
        set('nit-reb-count-disponiveis', disp.length);
        set('nit-reb-count-atuando',     atua.length);
        set('nit-rb-bal-disp', disp.length);
        set('nit-rb-bal-atua', atua.length);
        set('nit-rb-bal-total', disp.length+atua.length);
    }
    function _cardEventoHTML(id, ev) {
        const rebs = Object.entries(ev.reboquistas||{});
        const tagsHTML = rebs.length
            ? rebs.map(([rid,n])=>{
                const r  = S.reboquistas[rid]||{};
                const vt = r.vt   && r.vt   !=='N/I' ? `VT${r.vt}`   : '';
                const pl = r.placa && r.placa!=='N/I' ? r.placa       : '';
                const badge = [vt,pl].filter(Boolean).join(' · ');
                return `<span class="nit-reb-ev-tag">${esc(n)}${badge?`<span class="nit-reb-tag-vt">${esc(badge)}</span>`:''}</span>`;
              }).join('')
            : `<span class="nit-reb-ev-tag vazio">Nenhum reboquista</span>`;
        return `
        <div class="nit-reb-ev-card" data-evento-id="${esc(id)}">
            <div class="nit-reb-ev-header">
                <strong>${esc(ev.tipo||'EVENTO')}</strong>
                <span class="nit-reb-ev-hora nit-reb-mono">${esc(ev.criado||'')}</span>
            </div>
            <div class="nit-reb-card-body">
                <div class="nit-reb-info">${I.mappin}${esc(ev.endereco||'')}</div>
                ${ev.horario?`<div class="nit-reb-info">${I.clock}${esc(ev.horario)}</div>`:''}
                ${ev.obs?`<div class="nit-reb-info">${I.comment}${esc(ev.obs)}</div>`:''}
            </div>
            <div class="nit-reb-ev-tags">${tagsHTML}</div>
            <div class="nit-reb-card-footer">
                <button class="nit-reb-acao js-ev-editar"    title="Editar">${I.pencil}</button>
                <button class="nit-reb-acao js-ev-whatsapp"  title="Enviar via WhatsApp">${I.wa}</button>
                <span style="flex:1"></span>
                <button class="nit-reb-acao js-ev-finalizar" title="Finalizar e liberar">${I.check}</button>
                <button class="nit-reb-acao js-ev-remover"   title="Cancelar">${I.ban}</button>
            </div>
        </div>`;
    }
    function _renderEventos() {
        const c = g('nit-reboques-eventos');
        if (!c) return;
        const busca = S.buscaEventos.toLowerCase();
        let lista = Object.entries(S.eventos).filter(([,e])=>e).sort((a,b)=>String(b[1].criadoTs||'').localeCompare(String(a[1].criadoTs||'')));
        if (busca) lista = lista.filter(([,e])=>[e.tipo,e.endereco,e.obs,...Object.values(e.reboquistas||{})].some(v=>String(v||'').toLowerCase().includes(busca)));
        c.innerHTML = lista.length ? lista.map(([id,ev])=>_cardEventoHTML(id,ev)).join('') : `<div class="nit-reb-vazio">${busca?'Nenhuma ocorrência encontrada.':'Nenhuma ocorrência em andamento.'}</div>`;
        const cnt=g('nit-reb-count-eventos'); if(cnt) cnt.textContent=Object.keys(S.eventos).length;
    }
    function _atualizarBalanco() {
        // chamado via _render → já atualizado em _renderKanban
    }


    // Monta bloco de mensagem por reboquista — formato exato confirmado pelo operador:
    //   · *NOME*
    //     *VT 080 🚨  ORS8A02*
    //     *Smart:* (85) ...
    function _linhaReb(nome, rebData) {
        const r = rebData || {};
        let bloco = `  · *${nome}*`;
        if (r.vt && r.vt !== 'N/I') {
            const pl = r.placa && r.placa !== 'N/I' ? ` 🚨  ${r.placa}` : '';
            bloco += `\n    *VT ${r.vt}${pl}*`;
        }
        if (r.smart && r.smart !== 'N/I') bloco += `\n    *Smart:* ${r.smart}`;
        return bloco;
    }

    // ── CRUD Reboquista ──────────────────────────────────────────────────────
    function abrirEdicaoReboquista(id) {
        const r = id?(S.reboquistas[id]||{}):{};
        if(g('nit-reboque-edit-titulo')) g('nit-reboque-edit-titulo').textContent=`${id?'Editar':'Adicionar'} Reboquista`;
        if(g('nit-reboque-edit-id'))      g('nit-reboque-edit-id').value=id||'';
        if(g('nit-reboque-edit-nome'))    g('nit-reboque-edit-nome').value=r.nome||'';
        if(g('nit-reboque-edit-vt'))      g('nit-reboque-edit-vt').value=r.vt||'';
        if(g('nit-reboque-edit-placa'))   g('nit-reboque-edit-placa').value=r.placa||'';
        if(g('nit-reboque-edit-plantao')) g('nit-reboque-edit-plantao').value=r.plantao||'';
        if(g('nit-reboque-edit-smart'))   g('nit-reboque-edit-smart').value=r.smart||'';
        _abrirModal(g('nit-reboque-modal-edicao'));
        g('nit-reboque-edit-nome')?.focus();
    }
    function salvarReboquista() {
        const id=g('nit-reboque-edit-id')?.value||'';
        const dados={ nome:g('nit-reboque-edit-nome')?.value.trim().toUpperCase()||'', vt:g('nit-reboque-edit-vt')?.value.trim()||'N/I', placa:g('nit-reboque-edit-placa')?.value.trim().toUpperCase()||'N/I', plantao:g('nit-reboque-edit-plantao')?.value.trim()||'N/I', smart:g('nit-reboque-edit-smart')?.value.trim()||'N/I' };
        if (!dados.nome) { toast('O nome é obrigatório.','error'); return; }
        const updates={};
        if (id&&S.reboquistas[id]) {
            const nomeAntigo=S.reboquistas[id].nome;
            Object.entries(dados).forEach(([k,v])=>{updates[`${PATH_REBOQUISTAS}/${id}/${k}`]=v;});
            if (nomeAntigo!==dados.nome) Object.entries(S.eventos).forEach(([evId,ev])=>{ if(ev?.reboquistas?.[id]) updates[`${PATH_EVENTOS}/${evId}/reboquistas/${id}`]=dados.nome; });
            toast('Reboquista atualizado!','success');
        } else {
            if (Object.values(S.reboquistas).some(r=>r?.nome===dados.nome)) { toast('Nome já cadastrado.','error'); return; }
            const nid=novoId('reb');
            updates[`${PATH_REBOQUISTAS}/${nid}`]={...dados,status:'disponivel',eventoId:'',ocorrencia:'',ordem:maxOrdem(S.reboquistas)+1};
            toast('Reboquista adicionado!','success');
        }
        S.db.ref().update(updates).catch(e=>{console.error(e);toast('Falha ao gravar.','error');});
        _fecharModal(g('nit-reboque-modal-edicao'));
    }
    function removerReboquista(id) {
        const r=S.reboquistas[id]; if(!r) return;
        if (!confirm(`Remover ${r.nome}?`)) return;
        const updates={};
        if (r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`]=null;
        updates[`${PATH_REBOQUISTAS}/${id}`]=null;
        S.db.ref().update(updates).then(()=>toast('Removido.','success')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    // ── Acionamento ──────────────────────────────────────────────────────────
    function _acionamentoAberto() { return g('nit-reboque-acionamento')?.classList.contains('aberto'); }
    function _resetAcionamento() {
        S.multi={ids:[]};
        S.editandoEventoId=null;
        if(g('nit-reboque-acion-titulo')) g('nit-reboque-acion-titulo').textContent='Registrar Ocorrência';
        ['nit-reboque-acion-tipo','nit-reboque-acion-endereco','nit-reboque-acion-horario','nit-reboque-acion-obs'].forEach(id=>{const el=g(id);if(el){el.value='';el.disabled=false;}});
        _renderTagsAcionamento();
    }
    function _renderTagsAcionamento() {
        const tr=g('nit-reboque-acion-tags');
        if(tr) tr.innerHTML=S.multi.ids.map(id=>{const r=S.reboquistas[id]||{};return `<span class="nit-reb-ev-tag">${esc(r.nome||'?')}<button class="nit-reb-tag-x" data-id="${esc(id)}">&times;</button></span>`;}).join('')||`<span class="nit-reb-ev-tag vazio">Arraste ou clique em acionar</span>`;
    }
    function abrirAcionamento(id) {
        const r=S.reboquistas[id]; if(!r) return;
        if (r.status==='atuando') { toast(`${r.nome} já está em atendimento.`,'info'); return; }
        if (_acionamentoAberto()&&!S.editandoEventoId) { _adicionarAoAcionamento(id); return; }
        _resetAcionamento();
        S.multi.ids=[id];
        _renderTagsAcionamento();
        if(g('nit-reboque-acion-horario')) g('nit-reboque-acion-horario').value=agoraHHMM();
        g('nit-reboque-acionamento')?.classList.add('aberto');
        g('nit-reboque-acion-tipo')?.focus();
    }
    function _adicionarAoAcionamento(id) {
        const r=S.reboquistas[id]; if(!r) return;
        if (r.status==='atuando') { toast(`${r.nome} já está em atendimento.`,'info'); return; }
        if (S.multi.ids.includes(id)) { toast(`${r.nome} já está neste acionamento.`,'info'); return; }
        S.multi.ids.push(id);
        _renderTagsAcionamento();
        toast(`${r.nome} adicionado.`,'info');
    }
    function abrirNovaOcorrencia() {
        _resetAcionamento();
        if(g('nit-reboque-acion-horario')) g('nit-reboque-acion-horario').value=agoraHHMM();
        g('nit-reboque-acionamento')?.classList.add('aberto');
        g('nit-reboque-acion-tipo')?.focus();
    }
    function confirmarAcionamento() {
        if (S.editandoEventoId) { _salvarEdicaoEvento(); return; }
        const tipo=g('nit-reboque-acion-tipo')?.value.trim().toUpperCase()||'';
        const end =g('nit-reboque-acion-endereco')?.value.trim().toUpperCase()||'';
        if (!tipo||!end) { toast('Tipo e Endereço são obrigatórios.','warning'); return; }
        const hor=g('nit-reboque-acion-horario')?.value||'';
        const obs=g('nit-reboque-acion-obs')?.value.trim()||'';
        const evId=novoId('evt');
        const ocorrencia=`${tipo} @ ${end}`;
        const snapRebs={}; S.multi.ids.forEach(id=>{snapRebs[id]=S.reboquistas[id]?.nome||'?';});
        const updates={};
        updates[`${PATH_EVENTOS}/${evId}`]={tipo,endereco:end,horario:hor,obs,criado:agoraHHMM(),criadoTs:String(Date.now()),reboquistas:snapRebs};
        S.multi.ids.forEach(id=>{
            updates[`${PATH_REBOQUISTAS}/${id}/status`]='atuando';
            updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]=evId;
            updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`]=ocorrencia;
        });

        // Mensagem WhatsApp bifurcada:
        // Sem reboquista → "Tem preferência?" (agendamento aguardando designação)
        // Com reboquista → "EVENTO enviado para: NOME(S)"
        let msg;
        if (S.multi.ids.length === 0) {
            msg = `*Tem preferência de reboquista para este evento?*\n*Evento:* ${tipo}\n*Endereço:* ${end}`;
            if (hor) msg += `\n*Horário:* ${hor}`;
            if (obs) msg += `\n*Obs:*\n${obs}`;
        } else {
            const linhasRebs = S.multi.ids.map(id=>_linhaReb(snapRebs[id]||'?',S.reboquistas[id])).join('\n\n');
            msg = `*${tipo}* enviado para:\n\n${linhasRebs}\n\n*Endereço:* ${end}`;
            if (hor) msg += `\n*Horário:* ${hor}`;
            if (obs) msg += `\n*Obs:*\n${obs}`;
        }

        S.db.ref().update(updates)
            .then(()=>copiarTexto(msg))
            .then(ok=>toast(ok?'Ocorrência registrada e mensagem copiada!':'Registrada (falha ao copiar).',ok?'success':'warning'))
            .catch(e=>{console.error(e);toast('Falha ao registrar.','error');});
        g('nit-reboque-acionamento')?.classList.remove('aberto');
        _resetAcionamento();
    }
    function abrirEdicaoEvento(evId) {
        const ev=S.eventos[evId]; if(!ev) return;
        _resetAcionamento();
        S.editandoEventoId=evId;
        if(g('nit-reboque-acion-titulo')) g('nit-reboque-acion-titulo').textContent='Editar Ocorrência';
        if(g('nit-reboque-acion-tipo'))     g('nit-reboque-acion-tipo').value=ev.tipo||'';
        if(g('nit-reboque-acion-endereco')) g('nit-reboque-acion-endereco').value=ev.endereco||'';
        if(g('nit-reboque-acion-horario'))  g('nit-reboque-acion-horario').value=ev.horario||'';
        if(g('nit-reboque-acion-obs'))      g('nit-reboque-acion-obs').value=ev.obs||'';
        g('nit-reboque-acionamento')?.classList.add('aberto');
    }
    function _salvarEdicaoEvento() {
        const evId=S.editandoEventoId;
        const tipo=g('nit-reboque-acion-tipo')?.value.trim().toUpperCase()||'';
        const end =g('nit-reboque-acion-endereco')?.value.trim().toUpperCase()||'';
        if (!tipo||!end) { toast('Tipo e Endereço são obrigatórios.','error'); return; }
        const ocorrencia=`${tipo} @ ${end}`;
        const updates={};
        updates[`${PATH_EVENTOS}/${evId}/tipo`]=tipo;
        updates[`${PATH_EVENTOS}/${evId}/endereco`]=end;
        updates[`${PATH_EVENTOS}/${evId}/horario`]=g('nit-reboque-acion-horario')?.value||'';
        updates[`${PATH_EVENTOS}/${evId}/obs`]=g('nit-reboque-acion-obs')?.value.trim()||'';
        Object.entries(S.reboquistas).forEach(([rid,r])=>{ if(r?.eventoId===evId) updates[`${PATH_REBOQUISTAS}/${rid}/ocorrencia`]=ocorrencia; });
        S.db.ref().update(updates).then(()=>toast('Ocorrência atualizada!','success')).catch(e=>{console.error(e);toast('Falha.','error');});
        g('nit-reboque-acionamento')?.classList.remove('aberto');
        _resetAcionamento();
    }

    // ── Finalizar / Remover ──────────────────────────────────────────────────
    function finalizarAtendimento(id) {
        const r=S.reboquistas[id]; if(!r) return;
        const updates={};
        if(r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`]=null;
        updates[`${PATH_REBOQUISTAS}/${id}/status`]='disponivel';
        updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]='';
        updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`]='';
        updates[`${PATH_REBOQUISTAS}/${id}/ordem`]=maxOrdem(S.reboquistas)+1;
        S.db.ref().update(updates).then(()=>toast(`${r.nome} disponível.`,'info')).catch(e=>{console.error(e);toast('Falha.','error');});
    }
    function _liberarVinculados(evId, updates) {
        Object.entries(S.reboquistas).forEach(([id,r])=>{
            if(r?.eventoId===evId){ updates[`${PATH_REBOQUISTAS}/${id}/status`]='disponivel'; updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]=''; updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`]=''; }
        });
    }
    function finalizarEvento(evId) {
        const ev=S.eventos[evId]; if(!ev) return;
        const updates={}; _liberarVinculados(evId,updates); updates[`${PATH_EVENTOS}/${evId}`]=null;
        S.db.ref().update(updates).then(()=>toast(`${ev.tipo} finalizado — reboquistas liberados.`,'success')).catch(e=>{console.error(e);toast('Falha.','error');});
    }
    function removerEvento(evId) {
        const ev=S.eventos[evId]; if(!ev) return;
        if(!confirm(`Cancelar ${ev.tipo} @ ${ev.endereco}?`)) return;
        const updates={}; _liberarVinculados(evId,updates); updates[`${PATH_EVENTOS}/${evId}`]=null;
        S.db.ref().update(updates).then(()=>toast('Cancelado.','success')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    // ── Relatório e WhatsApp ─────────────────────────────────────────────────
    function gerarRelatorioReboques() {
        const disp=_sorted('disponivel'); const atua=_sorted('atuando');
        let txt=`*RELATÓRIO DE REBOQUES*\n*Data:* ${hojeBR()}\n\n`;
        txt+=`🟢 Disponíveis: ${disp.length}   🟡 Atuando: ${atua.length}   Total: ${disp.length+atua.length}\n`;
        if(atua.length){
            const grupos={};
            atua.forEach(([,r])=>{const k=r.ocorrencia||'N/I';(grupos[k]=grupos[k]||[]).push(r);});
            txt+=`\n---\n🟡 *EM ATENDIMENTO:*\n`;
            Object.entries(grupos).forEach(([oc,l])=>{
                txt+=`\n*${oc}*\n`;
                l.forEach(r=>{ txt+=`  · ${r.nome} (VT: ${r.vt||'N/I'})\n`; });
            });
        }
        if(disp.length){
            txt+=`\n---\n🟢 *DISPONÍVEIS:*\n\n`;
            disp.forEach(([,r])=>{ txt+=`  · ${r.nome} (VT: ${r.vt||'N/I'})\n`; });
        }
        const ta=g('nit-reboque-rel-texto'); if(ta) ta.value=txt.trim();
        _abrirModal(g('nit-reboque-modal-relatorio'));
    }
    function abrirWhatsAppEvento(evId) {
        const ev=S.eventos[evId]; if(!ev) return;
        const rebs=Object.entries(ev.reboquistas||{});
        let msg;
        if (rebs.length === 0) {
            // Evento sem reboquista — agendamento aguardando designação
            msg = `*Tem preferência de reboquista para este evento?*\n*Evento:* ${ev.tipo}\n*Endereço:* ${ev.endereco}`;
            if (ev.horario) msg += `\n*Horário:* ${ev.horario}`;
            if (ev.obs)     msg += `\n*Obs:*\n${ev.obs}`;
        } else {
            const linhasRebs = rebs.map(([rid,n])=>_linhaReb(n,S.reboquistas[rid])).join('\n\n');
            msg = `*${ev.tipo}* enviado para:\n\n${linhasRebs}\n\n*Endereço:* ${ev.endereco}`;
            if (ev.horario) msg += `\n*Horário:* ${ev.horario}`;
            if (ev.obs)     msg += `\n*Obs:*\n${ev.obs}`;
        }
        copiarTexto(msg).then(ok=>toast(ok?'Mensagem copiada! Cole no WhatsApp.':'Falha ao copiar.',ok?'success':'error'));
    }
    function limparPlantao() {
        if(!confirm('Limpar TODOS os dados de reboquistas e ocorrências deste plantão?')) return;
        S.db.ref(PATH_BASE).remove().then(()=>toast('Painel limpo!','success')).catch(e=>{console.error(e);toast('Falha.','error');});
    }

    // ── Drag-and-drop ────────────────────────────────────────────────────────
    function _ordemNaPosicao(container, y) {
        const cards=[...container.querySelectorAll('.nit-reb-card:not(.arrastando)')];
        let ant=null,prox=null;
        for(const c of cards){const b=c.getBoundingClientRect();if(y<b.top+b.height/2){prox=c;break;}ant=c;}
        const ord=el=>(S.reboquistas[el?.dataset?.id]||{}).ordem??0;
        if(!ant&&!prox) return maxOrdem(S.reboquistas)+1;
        if(!ant) return ord(prox)-1;
        if(!prox) return ord(ant)+1;
        return (ord(ant)+ord(prox))/2;
    }
    function _onDragStart(e) {
        const card=e.target.closest('.nit-reb-card'); if(!card) return;
        S.draggedId=card.dataset.id; S.isDragging=true;
        e.dataTransfer.effectAllowed='move';
        try{e.dataTransfer.setData('text/plain',S.draggedId);}catch{}
        setTimeout(()=>card.classList.add('arrastando'),0);
    }
    function _onDragEnd() {
        S.isDragging=false; S.draggedId=null;
        document.querySelectorAll('.nit-reb-card.arrastando').forEach(c=>c.classList.remove('arrastando'));
        document.querySelectorAll('.nit-reb-dz-ativa').forEach(c=>c.classList.remove('nit-reb-dz-ativa'));
        if(S.pendingRender){S.pendingRender=false;_render();}
    }
    function _onDragOver(e) {
        const alvo=e.target.closest('#nit-reb-cards-disponiveis,#nit-reb-cards-atuando,.nit-reb-ev-card,.nit-reboque-dropzone');
        if(!alvo) return; e.preventDefault(); e.dataTransfer.dropEffect='move';
        alvo.classList.add('nit-reb-dz-ativa');
    }
    function _onDragLeave(e) {
        const alvo=e.target.closest('#nit-reb-cards-disponiveis,#nit-reb-cards-atuando,.nit-reb-ev-card,.nit-reboque-dropzone');
        if(alvo) alvo.classList.remove('nit-reb-dz-ativa');
    }
    function _onDrop(e) {
        const id=S.draggedId; if(!id||!S.reboquistas[id]) return;
        e.preventDefault();
        const r=S.reboquistas[id];
        const evCard=e.target.closest('.nit-reb-ev-card');
        if(evCard){ _alocarAoEvento(id,evCard.dataset.eventoId); return;}
        const colD=e.target.closest('#nit-reb-cards-disponiveis');
        if(colD){ if(r.status==='atuando'){finalizarAtendimento(id);return;} const ord=_ordemNaPosicao(colD,e.clientY); S.reboquistas[id].ordem=ord; _renderKanban(); S.db.ref(`${PATH_REBOQUISTAS}/${id}/ordem`).set(ord).catch(()=>{}); return;}
        const colA=e.target.closest('#nit-reb-cards-atuando');
        if(colA){ if(r.status==='disponivel'){abrirAcionamento(id);return;} const ord=_ordemNaPosicao(colA,e.clientY); S.reboquistas[id].ordem=ord; _renderKanban(); S.db.ref(`${PATH_REBOQUISTAS}/${id}/ordem`).set(ord).catch(()=>{}); return;}
    }
    function _alocarAoEvento(id, evId) {
        const r=S.reboquistas[id]; const ev=S.eventos[evId]; if(!r||!ev) return;
        if(r.eventoId===evId){toast(`${r.nome} já está nesta ocorrência.`,'info');return;}
        const updates={};
        if(r.eventoId) updates[`${PATH_EVENTOS}/${r.eventoId}/reboquistas/${id}`]=null;
        updates[`${PATH_EVENTOS}/${evId}/reboquistas/${id}`]=r.nome;
        updates[`${PATH_REBOQUISTAS}/${id}/status`]='atuando';
        updates[`${PATH_REBOQUISTAS}/${id}/eventoId`]=evId;
        updates[`${PATH_REBOQUISTAS}/${id}/ocorrencia`]=`${ev.tipo} @ ${ev.endereco}`;
        S.db.ref().update(updates).then(()=>{
            // Monta nomes completos do evento após a atribuição
            const todosRebs = { ...(ev.reboquistas||{}), [id]: r.nome };
            const linhasRebs = Object.entries(todosRebs).map(([rid,n])=>_linhaReb(n,S.reboquistas[rid])).join('\n\n');
            let msg = `*${ev.tipo}* enviado para:\n\n${linhasRebs}\n\n*Endereço:* ${ev.endereco}`;
            if (ev.horario) msg += `\n*Horário:* ${ev.horario}`;
            if (ev.obs)     msg += `\n*Obs:*\n${ev.obs}`;
            copiarTexto(msg).then(ok=>toast(ok?`${r.nome} alocado — mensagem copiada!`:`${r.nome} alocado.`,ok?'success':'success'));
        }).catch(()=>{});
    }

    // ── Bind UI ──────────────────────────────────────────────────────────────
    function _bindUI() {
        const on=(id,ev,fn)=>g(id)?.addEventListener(ev,fn);
        // sidebar
        on('nit-rb-btn-processar','click',processarPlantao);
        const sideTgl=g('nit-rb-btn-toggle');
        sideTgl?.addEventListener('click',()=>{const s=g('nit-rb-sidebar'); s?.classList.toggle('collapsed'); sideTgl.setAttribute('aria-expanded',String(!s?.classList.contains('collapsed')));});
        g('nit-rb-sec-balanco-header')?.addEventListener('click',()=>g('nit-rb-sec-balanco')?.classList.toggle('collapsed-sec'));
        g('nit-rb-sec-acoes-header')?.addEventListener('click',()=>g('nit-rb-sec-acoes')?.classList.toggle('collapsed-sec'));
        // processar modal
        on('nit-reboque-modal-processar-fechar','click',()=>_fecharModal(g('nit-reboque-modal-processar')));
        g('nit-reboque-modal-processar')?.addEventListener('click',e=>{if(e.target===g('nit-reboque-modal-processar'))_fecharModal(g('nit-reboque-modal-processar'));});
        // barra de ações
        on('nit-reboque-btn-add-reboquista','click',()=>abrirEdicaoReboquista(null));
        on('nit-reboque-btn-relatorio',     'click', gerarRelatorioReboques);
        on('nit-reboque-btn-limpar',        'click', limparPlantao);
        on('nit-reboque-btn-nova-ocorrencia','click', abrirNovaOcorrencia);
        // busca eventos
        on('nit-reboque-busca-eventos',    'input',e=>{S.buscaEventos    =e.target.value.trim();_renderEventos();});
        // busca nas colunas do kanban
        on('nit-reb-search-disponiveis',   'input',e=>{S.buscaDisponiveis=e.target.value.trim();_renderKanban();});
        on('nit-reb-search-atuando',       'input',e=>{S.buscaAtuando    =e.target.value.trim();_renderKanban();});
        // acionamento
        on('nit-reboque-acion-btn-confirmar','click',confirmarAcionamento);
        on('nit-reboque-acion-btn-cancelar','click',()=>{g('nit-reboque-acionamento')?.classList.remove('aberto');_resetAcionamento();});
        g('nit-reboque-acion-tags')?.addEventListener('click',e=>{const x=e.target.closest('.nit-reb-tag-x');if(!x)return;S.multi.ids=S.multi.ids.filter(i=>i!==x.dataset.id);});
        // modal reboquista
        on('nit-reboque-edit-btn-salvar','click',salvarReboquista);
        on('nit-reboque-edit-btn-cancelar','click',()=>_fecharModal(g('nit-reboque-modal-edicao')));
        g('nit-reboque-modal-edicao')?.addEventListener('click',e=>{if(e.target===g('nit-reboque-modal-edicao'))_fecharModal(g('nit-reboque-modal-edicao'));});
        // modal relatório
        on('nit-reboque-rel-copiar','click',()=>copiarTexto(g('nit-reboque-rel-texto')?.value||'').then(ok=>{
            toast(ok?'Copiado! Cole no WhatsApp.':'Falha ao copiar.',ok?'success':'error');
            if (ok) _fecharModal(g('nit-reboque-modal-relatorio'));
        }));
        on('nit-reboque-rel-fechar','click',()=>_fecharModal(g('nit-reboque-modal-relatorio')));
        // ESC
        document.addEventListener('keydown',e=>{
            if(e.key!=='Escape'||!S.inicializado) return;
            [g('nit-reboque-modal-processar'),g('nit-reboque-modal-edicao'),g('nit-reboque-modal-relatorio')].forEach(_fecharModal);
            if(_acionamentoAberto()){g('nit-reboque-acionamento')?.classList.remove('aberto');_resetAcionamento();}
        });
        // delegation — kanban + eventos
        g('tab-reboques')?.addEventListener('click',e=>{
            const card=e.target.closest('.nit-reb-card');
            if(card){
                const id=card.dataset.id;
                if(e.target.closest('.js-acionar'))   {abrirAcionamento(id);return;}
                if(e.target.closest('.js-finalizar'))  {finalizarAtendimento(id);return;}
                if(e.target.closest('.js-editar'))     {abrirEdicaoReboquista(id);return;}
                if(e.target.closest('.js-remover'))    {removerReboquista(id);return;}
            }
            const evCard=e.target.closest('.nit-reb-ev-card');
            if(evCard){
                const evId=evCard.dataset.eventoId;
                if(e.target.closest('.js-ev-editar'))    {abrirEdicaoEvento(evId);return;}
                if(e.target.closest('.js-ev-whatsapp'))  {abrirWhatsAppEvento(evId);return;}
                if(e.target.closest('.js-ev-finalizar')) {finalizarEvento(evId);return;}
                if(e.target.closest('.js-ev-remover'))   {removerEvento(evId);return;}
            }
        });
        // DnD
        const tab=g('tab-reboques');
        tab?.addEventListener('dragstart',_onDragStart);
        tab?.addEventListener('dragend',  _onDragEnd);
        tab?.addEventListener('dragover', _onDragOver);
        tab?.addEventListener('dragleave',_onDragLeave);
        tab?.addEventListener('drop',     _onDrop);
    }

    // ── Tabs fallback & Bootstrap ────────────────────────────────────────────
    function _toggleBuscaGlobal(visivel) {
        const el = document.getElementById('btn-busca-global');
        if (el) el.style.visibility = visivel ? '' : 'hidden';
    }
    function _bindTabsFallback() {
        document.querySelector('.tab-navigation')?.addEventListener('click',e=>{
            const btn=e.target.closest('.tab-button[data-tab]'); if(!btn) return;
            const alvo=document.getElementById(btn.dataset.tab); if(!alvo) return;
            document.querySelectorAll('.tab-button[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
            document.querySelectorAll('.tab-content').forEach(t=>t.classList.toggle('active',t===alvo));
            // Busca global pertence ao Semáforo — oculta quando a aba Reboques está ativa
            _toggleBuscaGlobal(btn.dataset.tab !== 'tab-reboques');
        });
    }
    function _bootstrap() {
        let tentativas=0;
        const esperar=()=>{
            const fb=window.firebase;
            if(fb?.apps?.length){fb.auth().onAuthStateChanged(u=>{if(u)inicializar(fb.database());else destruir();});return;}
            if(++tentativas>100){console.error('[NitReboques] Firebase não inicializou.');return;}
            setTimeout(esperar,200);
        };
        esperar();
    }
    document.readyState==='loading'?window.addEventListener('DOMContentLoaded',_bootstrap):_bootstrap();
    return { inicializar, destruir };
})();
