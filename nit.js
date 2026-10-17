'use strict';

    // ── FIREBASE ──────────────────────────────────────────────────────────────
    window.NitFirebase = {
        status: 'inicializando',
        db: null,

        _aguardarSDK() {
            return new Promise((resolve, reject) => {
                if (typeof firebase !== 'undefined' && window.db) { resolve(); return; }
                let tentativas = 0;
                const check = setInterval(() => {
                    tentativas++;
                    if (typeof firebase !== 'undefined' && window.db) {
                        clearInterval(check); resolve();
                    } else if (tentativas > 40) {
                        clearInterval(check); reject(new Error('Firebase SDK timeout'));
                    }
                }, 100);
            });
        },

        async _init() {
            return new Promise(async resolve => {
                const timeout = setTimeout(() => { this._setStatus('offline'); resolve(false); }, 5000);
                try {
                    await this._aguardarSDK();
                    this.db = window.db;
                    this.db.ref('.info/connected').on('value', snap => {
                        this._setStatus(snap.val() ? 'online' : 'offline');
                    });
                    clearTimeout(timeout);
                    this._setStatus('online');
                    resolve(true);
                } catch (e) {
                    console.warn('[NIT] Firebase SDK não carregado:', e.message);
                    clearTimeout(timeout);
                    this._setStatus('offline');
                    resolve(false);
                }
            });
        },

        exec(fn) {
            if (!this.db) return undefined;
            const ref    = (db, path) => path ? db.ref(path) : db.ref();
            const update = (r, data)  => r.update(data);
            const push   = (r, data)  => r.push(data);
            return fn(this.db, ref, update, push);
        },

        _setStatus(status) {
            this.status = status;
            const el = document.getElementById('nit-firebase-status');
            if (!el) return;
            const map = {
                online:        { dot: '#22C55E', text: 'Firebase online',  color: '#22C55E' },
                offline:       { dot: '#EF4444', text: 'Firebase offline', color: '#EF4444' },
                inicializando: { dot: '#0EA5E9', text: 'Conectando…',      color: '#0EA5E9' },
            };
            const s   = map[status] || map.offline;
            const dot = el.querySelector('.nit-status-dot');
            if (dot) dot.style.backgroundColor = s.dot;
            const txt = el.querySelector('span:last-child');
            if (txt) { txt.textContent = s.text; txt.style.color = s.color; }
        },
    };

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    const NitLogin = {
        operador: null,
        turno:    null,
        uid:      null,
        email:    null,

        // ── Converte email para chave Firebase (. e @ → |) ──────────────
        _emailParaChave(email) {
    if (typeof email !== 'string' || !email.trim()) {
        return null;
    }

    return email.trim().toLowerCase()
        .replace(/\./g, '|')
        .replace(/@/g, '|');
},
        // ── Verifica se email está na whitelist /usuarios_autorizados ────
        async _verificarAutorizacao(user) {
    try {
        // Estado de autenticação incompleto ou inválido:
        // nunca deixa uma exceção derrubar o fluxo de login.
        if (!user) {
            console.warn('[NitLogin] Usuário ausente na verificação de autorização.');
            this._setStatus('Sessão inválida. Entre novamente.');
            document.getElementById('btn-login-google')?.removeAttribute('disabled');
            return false;
        }

        const chave = this._emailParaChave(user.email);

        if (!chave) {
            console.warn('[NitLogin] Usuário autenticado sem e-mail válido.', {
                uid: user.uid || null,
                providerId: user.providerData?.[0]?.providerId || null
            });

            try {
                await firebase.auth().signOut();
            } catch (e) {
                console.warn('[NitLogin] Falha ao encerrar sessão inválida:', e);
            }

            this._setStatus('Não foi possível validar sua conta. Entre novamente.');
            document.getElementById('btn-login-google')?.removeAttribute('disabled');
            return false;
        }

        const snap = await firebase.database()
            .ref(`usuarios_autorizados/${chave}`)
            .get();

        if (!snap.exists() || snap.val().ativo === false) {
            await firebase.auth().signOut();
            this._setStatus('Acesso não autorizado. Procure o administrador.');
            document.getElementById('btn-login-google')?.removeAttribute('disabled');
            return false;
        }

        const dados = snap.val();

        this.operador = dados.nome || user.displayName || user.email;
        this.turno    = dados.turno || '';
        this.uid      = user.uid;
        this.email    = user.email;

        return true;

    } catch (err) {
        console.error('[NitLogin] Falha ao verificar autorização:', err);

        this._setStatus('Falha ao verificar acesso. Tente novamente.');
        document.getElementById('btn-login-google')?.removeAttribute('disabled');

        return false;
    }
},
        // ── Exibe mensagem de status na tela de login ────────────────────
        _setStatus(msg) {
            const el = document.getElementById('nit-login-status');
            if (el) el.textContent = msg;
        },

        // ── Inicializa listener de auth + botão Google ───────────────────
        inicializar() {
            const btn = document.getElementById('btn-login-google');
            if (btn) {
                btn.addEventListener('click', () => this.entrarComGoogle());
            }

            // Monitora estado de autenticação (restaura sessão automaticamente)
            firebase.auth().onAuthStateChanged(async user => {
                if (user) {
                    this._setStatus('Verificando acesso...');
                    const autorizado = await this._verificarAutorizacao(user);
                    if (autorizado) this._concluirLogin();
                } else {
                    // Sem sessão — garante overlay visível
                    const overlay = document.getElementById('nit-login-overlay');
                    if (overlay) overlay.classList.remove('hidden');
                }
            });
        },

        // ── Abre popup Google Auth ────────────────────────────────────────
        async entrarComGoogle() {
            const btn = document.getElementById('btn-login-google');
            if (btn) btn.disabled = true;
            this._setStatus('Abrindo autenticação Google...');

            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                await firebase.auth().signInWithPopup(provider);
                // onAuthStateChanged cuida do restante
            } catch (err) {
                const msg = err.code === 'auth/popup-closed-by-user'
                    ? 'Login cancelado.'
                    : err.code === 'auth/popup-blocked'
                    ? 'Popup bloqueado. Permita popups para este site.'
                    : 'Erro ao conectar com Google. Tente novamente.';
                this._setStatus(msg);
                if (btn) btn.disabled = false;
            }
        },

        // ── Conclui login após verificação bem-sucedida ───────────────────
        _concluirLogin() {
            // Inicia listener Firebase APÓS auth confirmada
            // Garante que as Security Rules (auth != null) sejam satisfeitas
            Semaforo.inicializarListenerFirebase();

            // Atualiza badge do operador
            const badge = document.getElementById('nit-operador-badge');
            if (badge) {
                const label = this.turno ? `${this.operador} · ${this.turno}` : this.operador;
                badge.textContent = label;
                badge.style.display = 'inline-flex';
            }

            // Grava sessão no Firebase para auditoria
            NitFirebase.exec((db, ref, update) =>
                update(ref(db, 'meta/sessao'), {
                    operador: this.operador,
                    email:    this.email,
                    turno:    this.turno,
                    entradaTs: Date.now(),
                })
            );

            // Esconde overlay e inicializa o sistema
            document.getElementById('nit-login-overlay').classList.add('hidden');
            showToast(`Bem-vindo, ${this.operador}!`, 'success');
            registrarAcao(`Login: ${this.operador} (${this.email}) — ${this.turno}.`);
            setTimeout(() => NitProcessamento.verificar(), 800);
        },

        // ── Logout ────────────────────────────────────────────────────────
        async sair() {
            await firebase.auth().signOut();
            this.operador = null;
            this.turno    = null;
            this.uid      = null;
            this.email    = null;
            sessionStorage.clear();
            location.reload();
        },

        // ── Compatibilidade — tentarRestaurar agora é no-op ──────────────
        // Firebase Auth restaura sessão automaticamente via onAuthStateChanged
        tentarRestaurar() { return false; },
        confirmar()       { },
    };
    // ── FILTRO DE DATA ────────────────────────────────────────────────────────
    // ── FILTRO DE DATA ────────────────────────────────────────────────────────
const NitData = {
    hoje: () => {
        const d  = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    },
};
    // ── ESTADO GLOBAL ─────────────────────────────────────────────────────────
    window.AppState = {
        STORAGE_KEY_SEMAFORO: 'nit-v12-semaforo',
        STORAGE_KEY_DADOS:    'nit-v12-dadosMestres',
        cardIdCounter:           0,
        totalOcorrenciasCriadas: 0,
        draggedCard:  null,
        placeholder:  null,
        despachoTipo: 'vl',
        dadosMestres: { operadores: [], supervisores: [], monitores: [], locais: [], qrus: [] },
    };

    // ── DOM CACHE ─────────────────────────────────────────────────────────────
    const DOM = {};
    function queryDOM() {
        Object.assign(DOM, {
            tabButtons:               document.querySelectorAll('.tab-button'),
            tabContents:              document.querySelectorAll('.tab-content'),
            toastContainer:           document.getElementById('toast-container'),
            relatorioBrutoInput:      document.getElementById('relatorio-bruto-input'),
            btnProcessar:             document.getElementById('btn-processar'),
            relatorioFinalPreview:    document.getElementById('relatorio-final-preview'),
            checkIncluirNormalizados: document.getElementById('check-incluir-normalizados'),
            btnVisualizarRelatorio:   document.getElementById('btn-visualizar-relatorio'),
            displayTotal:             document.getElementById('display-total'),
            displayPendentes:         document.getElementById('display-pendentes'),
            displayNormalizados:      document.getElementById('display-normalizados'),
            colunaNormalizados:       document.querySelector('#coluna-normalizados .kanban-cards-container'),
            countNormalizados:        document.getElementById('count-normalizados'),
            modalRelatorio:           document.getElementById('modal-relatorio'),
            modalRelatorioTexto:      document.getElementById('modal-relatorio-texto'),
            btnModalCopiar:           document.getElementById('btn-modal-copiar'),
            btnModalFechar:           document.getElementById('btn-modal-fechar'),
            modalEdicao:              document.getElementById('modal-edicao'),
            edicaoCardId:             document.getElementById('edicao-card-id'),
            edicaoCodigo:             document.getElementById('edicao-codigo'),
            edicaoEndereco:           document.getElementById('edicao-endereco'),
            edicaoProblema:           document.getElementById('edicao-problema'),
            btnEdicaoCancelar:        document.getElementById('btn-edicao-cancelar'),
            btnEdicaoSalvar:          document.getElementById('btn-edicao-salvar'),
            modalDespachoSemaforo:    document.getElementById('modal-despacho-semaforo'),
            despachoSemaforoCardId:   document.getElementById('despacho-semaforo-card-id'),
            despachoSemaforoEquipe:   document.getElementById('despacho-semaforo-equipe'),
            despachoSemaforoVt:       document.getElementById('despacho-semaforo-vt'),
            btnDespachoSemaforoConfirmar: document.getElementById('btn-despacho-semaforo-confirmar'),
            btnDespachoSemaforoCancelar:  document.getElementById('btn-despacho-semaforo-cancelar'),
        });
    }

    // ── UTILITÁRIOS UI ────────────────────────────────────────────────────────
    function showToast(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        DOM.toastContainer?.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
    }

    function abrirModal(modal)  { if (modal) modal.classList.add('visible'); }
    function fecharModal(modal) { if (modal) modal.classList.remove('visible'); }

    function setupModal(modal, closeBtn, onCancel = null) {
        if (!modal || !closeBtn) return;
        closeBtn.addEventListener('click', () => { fecharModal(modal); onCancel?.(); });
        modal.addEventListener('click', e => { if (e.target === modal) { fecharModal(modal); onCancel?.(); } });
    }

    // ── AUDITORIA ─────────────────────────────────────────────────────────────
    function registrarAcao(mensagem) {
        const logs = JSON.parse(localStorage.getItem('historicoDeAcoes_v1') || '[]');
        logs.unshift({ timestamp: new Date().toLocaleString('pt-BR'), mensagem });
        if (logs.length > 500) logs.length = 500;
        localStorage.setItem('historicoDeAcoes_v1', JSON.stringify(logs));
    }

    function gravarHistoricoFirebase(eventoId, de, para, sub, eq, vt, operador) {
        NitFirebase.exec((db, ref, update, push) =>
            push(ref(db, `historico/${eventoId}`), { de, para, sub, eq, vt, operador, ts: Date.now() })
        );
    }

    function carregarDadosMestres() {
        try {
            const raw = localStorage.getItem(AppState.STORAGE_KEY_DADOS);
            if (raw) Object.assign(AppState.dadosMestres, JSON.parse(raw));
        } catch (e) { console.warn('[NIT] dadosMestres inválido:', e); }
    }

    // ── UNDO TOAST ────────────────────────────────────────────────────────────
    const UNDO_DURATION = 5000;
    let _undoActive = null;

    function mostrarUndoToast(mensagem, onCommit, onUndo) {
        cancelarUndoAtivo();
        const toast = document.getElementById('undo-toast');
        const msgEl = document.getElementById('undo-toast-msg');
        const barEl = document.getElementById('undo-progress-bar');
        if (!toast || !msgEl || !barEl) { onCommit(); return; }

        msgEl.textContent = mensagem;
        toast.classList.add('show');

        let cancelado = false;
        let rafId;
        const inicio = performance.now();

        function tick(now) {
            const restante = Math.max(0, 1 - (now - inicio) / UNDO_DURATION);
            barEl.style.width = `${restante * 100}%`;
            if (restante > 0 && !cancelado) { rafId = requestAnimationFrame(tick); return; }
            if (!cancelado) { esconderUndoToast(); onCommit(); }
        }
        rafId = requestAnimationFrame(tick);

        _undoActive = {
            commit: () => { cancelado = true; cancelAnimationFrame(rafId); esconderUndoToast(); onCommit(); },
            undo:   () => { cancelado = true; cancelAnimationFrame(rafId); esconderUndoToast(); onUndo(); },
        };

        document.getElementById('undo-toast-btn')?.addEventListener('click', () => _undoActive?.undo(), { once: true });
    }

    function esconderUndoToast() {
        document.getElementById('undo-toast')?.classList.remove('show');
        _undoActive = null;
    }

    function cancelarUndoAtivo() {
        if (_undoActive) { _undoActive.commit(); _undoActive = null; }
    }

    // ── API ───────────────────────────────────────────────────────────────────
    async function nitAPIFetch(endpoint, options = {}) {
        const key = await window.getNITKey?.() || '';
        const url = `${window.NIT_API_URL}${endpoint}`;
        const res = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', 'X-NIT-Key': key, ...(options.headers || {}) },
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || data.error || `HTTP ${res.status}`);
        }
        return res.json().catch(() => ({}));
    }

    // ── CONFIRM MODAL ─────────────────────────────────────────────────────────
    let _confirmCb = null;
    let _cancelCb  = null;
    function nitConfirm(titulo, mensagem, onConfirm, onCancel) {
        const modal = document.getElementById('modal-confirmar-generico');
        const titEl = document.getElementById('modal-confirmar-titulo');
        const msgEl = document.getElementById('modal-confirmar-msg');
        if (!modal) { if (confirm(mensagem)) onConfirm(); else if (onCancel) onCancel(); return; }
        titEl.textContent = titulo;
        msgEl.innerHTML   = mensagem.replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        _confirmCb = onConfirm;
        _cancelCb  = onCancel || null;
        abrirModal(modal);
    }


    // ═══════════════════════════════════════════════════════════════════════
    // NIT LOGGER — logging estruturado do parser
    // Cada processamento recebe um ID único; logs consultáveis via console
    // e armazenados em localStorage para replay/debug.
    // ═══════════════════════════════════════════════════════════════════════
    const NitLogger = {
        _KEY: 'nit-parser-logs-v1',
        _MAX: 50, // máximo de sessões armazenadas

        // Gera ID único para cada processamento
        novaSessionId() {
            return `nit_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
        },

        // Persiste sessão de processamento
        salvar(sessionId, { texto, eventos, logs, erros, dataReferencia }) {
            try {
                const stored = this._carregar();
                stored.unshift({
                    sessionId,
                    ts:             new Date().toISOString(),
                    dataReferencia,
                    totalEventos:   eventos.length,
                    totalErros:     erros.length,
                    hashTexto:      this._hash(texto),
                    textoTamanho:   texto.length,
                    // Guarda texto completo para replay (até 50KB)
                    textoRaw:       texto.length < 50000 ? texto : '[TRUNCADO]',
                    logs,
                    erros,
                    resumo: eventos.map(e => ({
                        codigo:   e.codigo,
                        eventoId: e.eventoId,
                        status:   e.status,
                        inicio:   e.inicio,
                        fim:      e.fim,
                    })),
                });
                if (stored.length > this._MAX) stored.length = this._MAX;
                localStorage.setItem(this._KEY, JSON.stringify(stored));
            } catch(e) {
                console.warn('[NitLogger] Falha ao salvar log:', e.message);
            }
        },

        // Carrega todas as sessões
        _carregar() {
            try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
            catch { return []; }
        },

        // Hash simples para identificar relatórios únicos
        _hash(str) {
            let h = 0;
            for (let i = 0; i < Math.min(str.length, 200); i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h |= 0;
            }
            return Math.abs(h).toString(16);
        },

        // Lista sessões no console (debug)
        listar() {
            const logs = this._carregar();
            console.table(logs.map(l => ({
                sessionId:     l.sessionId,
                ts:            l.ts,
                data:          l.dataReferencia,
                eventos:       l.totalEventos,
                erros:         l.totalErros,
                hash:          l.hashTexto,
            })));
            return logs;
        },

        // Recupera texto de uma sessão para replay
        replay(sessionId) {
            const logs = this._carregar();
            const sess = logs.find(l => l.sessionId === sessionId);
            if (!sess) { console.warn('[NitLogger] Sessão não encontrada:', sessionId); return null; }
            console.log('[NitLogger] Texto da sessão:', sess.textoRaw);
            return sess.textoRaw;
        },

        // Captura erro com contexto
        capturarErro(sessionId, contexto, erro) {
            console.error(`[NIT ERROR] session=${sessionId}`, contexto, erro);
            // Envia para backend (fire-and-forget)
            if (window.NIT_API_URL) {
                fetch(`${window.NIT_API_URL}/api/v1/log-error`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        ts:        new Date().toISOString(),
                        contexto,
                        erro:      erro?.message || String(erro),
                        stack:     erro?.stack   || '',
                        userAgent: navigator.userAgent,
                    }),
                }).catch(() => {}); // silencia falha de rede
            }
        },
    };
    window.NitLogger = NitLogger;

    // ═════════════════════════════════════════════════════════════════════════
    // SEMAFORO
    // ═════════════════════════════════════════════════════════════════════════
    const Semaforo = {
        ultimoLoteNormalizado: [],

        // ── Helpers ───────────────────────────────────────────────────────
        gerarEventoId(codigo, inicio) {
            const ts = (inicio || '').replace(/[^0-9]/g, '').slice(0, 12) || Date.now();
            return `${codigo}_${ts}`;
        },

        extrairDataReferencia(linhas) {
            for (const l of linhas) {
                const m = l.match(/(\d{2}\/\d{2}\/\d{4})/);
                if (m) return m[1];
            }
            return NitData.hoje();
        },

        extrairPlantonista(linhas) {
            // Captura uma ou mais linhas de PLANTONISTA no cabeçalho.
            // Formato esperado: "*PLANTONISTA*\tNome Sobrenome"
            // Suporta múltiplos plantonistas na mesma linha (separados por / ou ,)
            // ou em múltiplas linhas PLANTONISTA consecutivas.
            const nomes = [];
            for (const l of linhas) {
                const m = l.match(/\*?PLANTONISTA\*?\s*[\t:]\s*(.+)/i);
                if (m) {
                    const nome = m[1].replace(/\*/g, '').replace(/\t.*/g, '').trim();
                    if (nome) nomes.push(nome);
                }
                // Para quando chega na primeira linha de ocorrência (🚦)
                if (nomes.length && l.includes('🚦')) break;
            }
            return nomes.join(' / ');
        },

        statusFromSecao(secao, card) {
            // Ordem de prioridade — documentação NIT v2.0:
            // 1. Seção NORMALIZADOS (cabeçalho do relatório)
            if (secao === 'NORMALIZADO') return 'NORMALIZADO';
            // 2. Campo Fim preenchido
            if (card.fim && card.fim.trim()) return 'NORMALIZADO';
            // 3. PGV ou Entre no endereço (sem exceções, obs não altera)
            const end = (card.endereco || '').toLowerCase();
            if (end.includes('pgv'))   return 'SEM_NECESSIDADE';
            if (/\bentre\b/i.test(end)) return 'SEM_NECESSIDADE';  
            if (/\bpr[oó]x\.?\b/i.test(end)) return 'SEM_NECESSIDADE';
            // Obs indica semáforo veicular já operando — sem necessidade de agente
            const obs = (card.observacoes || card.dataset?.observacoes || '').toLowerCase();
            if (/veiculares?\s+funcionando/i.test(obs)) return 'SEM_NECESSIDADE';
            // 4. Fallback
            return 'PENDENTE';
        },

        extrairDadosDaLinha(linha) {
    // Aceita tabs/espaços iniciais (formato CEMOB tab-separado: \tCAUSA\t*🚦...)
    const prefixMatch = linha.match(/^[\t\s]*([A-ZÀ-Ú][A-ZÀ-Ú\s]{1,30}?)\s*(?:\*\s*)?🚦/u);
    const prefixo = prefixMatch ? prefixMatch[1].trim().toUpperCase() : '';
    const TIPOS = ['FALHA DE EQUIPAMENTO','INVESTIGANDO','ROMPIMENTO','ACIDENTE',
                   'IMPROCEDENTE','FURTO','ENEL','VANDALISMO','AGENTE DA NATUREZA'];
    const tipoFromPrefixo = TIPOS.find(t => prefixo.includes(t));

    const re = /🚦[\s*]*([A-Z0-9]{1,8})[\s*]*🚦[\t ]*\*?(.*?)\*?[\t ]*●[\t ]*\*?([A-ZÀ-Ú][A-ZÀ-Ú\s/]+?)\*?[\t ]*●(.*)/isu;
    // Fallback: formato onde o código precede um único 🚦 (ex: planilha CEMOB copiada)
    // "ENEL \t\t 1183 \t 🚦 \t AV. BERNARDO ● TRAVADO ●"
    const re2 = /\b([A-Z0-9]{1,8})\t🚦[\t ]*\*?(.*?)\*?[\t ]*●[\t ]*\*?([A-ZÀ-Ú][A-ZÀ-Ú\s/]+?)\*?[\t ]*●(.*)/isu;
    const m = linha.match(re) || linha.match(re2);
    if (!m) return null;

    // Tipo: prefixo tem prioridade; fallback em m[3] (campo problema do CEMOB)
    const tipoFromProblema = TIPOS.find(t => (m[3] || '').toUpperCase().includes(t));
    const tipo = tipoFromPrefixo || tipoFromProblema || 'N/I';

    const resto   = m[4] || '';
    const inicioM = resto.match(/In[ií]cio:[\t ]*(\d{2}\/\d{2}\/\d{4}[\t ]+\d{2}:\d{2})/i);
    const fimM    = resto.match(/Fim:[\t ]*(\d{2}\/\d{2}\/\d{4}[\t ]+\d{2}:\d{2})/i);

    // Extrai obs: procura "Obs:" explícito primeiro
    let obsInline = '';
    const obsExplicit = resto.match(/\*?Obs[.:*]?\*?[\t ]*(.+?)(?:\/log\b.*)?$/is);
    if (obsExplicit) {
        obsInline = obsExplicit[1].replace(/["*]/g, '').replace(/\s+/g, ' ').trim();
    } else {
        // Fallback: tudo após as datas de início/fim
        obsInline = resto
            .replace(/In[ií]cio:[\t ]*\d{2}\/\d{2}\/\d{4}[\t ]+\d{2}:\d{2}/gi, '')
            .replace(/Fim:[\t ]*\d{2}\/\d{2}\/\d{4}[\t ]+\d{2}:\d{2}/gi, '')
            .replace(/["*\t]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        // Descarta se for só pontuação ou muito curto sem valor semântico
        if (/^[.\-–—\s"]+$/.test(obsInline) || obsInline.length < 3) obsInline = '';
    }

    return {
        tipo,
        codigo:      m[1].trim(),
        endereco:    m[2].trim().replace(/\s+/g, ' '),
        problema:    m[3].trim().toUpperCase(),
        inicio:      inicioM?.[1] ?? '',
        fim:         fimM?.[1]    ?? '',
        observacoes: obsInline,
        equipe: '', viatura: '', pl: '', sub: '',
    };
},

        // ── Firebase listener ─────────────────────────────────────────────
        _kanbanListenerAtivo: false,
        inicializarListenerFirebase() {
            if (this._kanbanListenerAtivo) return;
            this._kanbanListenerAtivo = true;
            NitFirebase.exec((db, ref) => {
                const kanbanRef = ref(db, 'kanban');

                kanbanRef.on('child_added', snap => {
                    const eventoId = snap.key;
                    const dados    = snap.val();
                    if (!dados) return;
                    // Guard: eventoId já no DOM — evita duplicata na sincronização Firebase
                    if (document.querySelector(`[data-eventoid="${eventoId}"]`)) return;
                    const coluna    = dados.coluna || 'coluna-espera';
                    const container = document.querySelector(`#${coluna} .kanban-cards-container`)
                                   || document.getElementById(coluna);
                    if (!container) return;
                    const el = Semaforo.criarElementoCard(`card-${AppState.cardIdCounter++}`, {
                        ...dados, eventoId, codigo: dados.codigo || eventoId.split('_')[0],
                    });
                    el.dataset.eventoid       = eventoId;
                    el.dataset.coluna         = coluna;
                    el.dataset.datareferencia = dados.dataReferencia || '';
                    // Normalizar campos de fim no dataset para que ordenarNormalizados() os leia
                    // Sempre define campos de data/hora no dataset (mesmo como '' para evitar
                    // que leituras futuras recebam undefined ou "null" como string)
                    const _sd = v => (v && v !== 'null' && v !== 'undefined') ? String(v) : '';
                    el.dataset.inicio   = _sd(dados.inicio);
                    el.dataset.data_fim = _sd(dados.data_fim);
                    el.dataset.hora_fim = _sd(dados.hora_fim);
                    el.dataset.fim      = _sd(dados.fim);
                    if (dados.equipeApoio)  el.dataset.equipeApoio  = dados.equipeApoio;
                    if (dados.viaturaApoio) el.dataset.viaturaApoio = dados.viaturaApoio;
                    if (dados.tsDespacho)   el.dataset.tsDespacho   = dados.tsDespacho;
                    // Agendamento de rendição (objeto aninhado → dataset flat)
                    el.dataset.agendamentohora   = dados.agendamento?.horaAgendada || '';
                    el.dataset.agendamentoequipe = dados.agendamento?.equipe        || '';
                    el.dataset.agendamentosub    = dados.agendamento?.sub           || '';
                    el.dataset.agendamentovt     = dados.agendamento?.vt            || '';
                    if (coluna === 'coluna-normalizados') {
                        container.prepend(el);
                        // Reordena após inserção — Firebase pode entregar fora de ordem
                        requestAnimationFrame(() => Semaforo.ordenarNormalizados());
                    } else {
                        container.appendChild(el);
                    }
                    Semaforo.atualizarPainel();
                });

                kanbanRef.on('child_changed', snap => {
                    const eventoId = snap.key;
                    const dados    = snap.val();
                    if (!dados) return;
                    const el = document.querySelector(`[data-eventoid="${eventoId}"]`);
                    if (!el) return;
                    const novaColuna  = dados.coluna || 'coluna-espera';
                    const colunaAtual = el.dataset.coluna;
                    if (novaColuna !== colunaAtual) {
                        const container = document.querySelector(`#${novaColuna} .kanban-cards-container`)
                                       || document.getElementById(novaColuna);
                        if (container) { container.appendChild(el); el.dataset.coluna = novaColuna; }
                    }
                    // Firebase child_changed entrega o estado COMPLETO do nó.
                    // Campos ausentes em dados foram deletados do Firebase → limpar dataset.
                    const campos = ['equipe','viatura','pl','sub','status','observacoes',
                                    'inicio','endereco','tsDespacho','tsFirstDispatch','tsChegada',
                                    'equipeApoio','viaturaApoio',
                                    'data_fim','hora_fim','fim','coluna'];
                    campos.forEach(k => {
                        el.dataset[k] = (dados[k] != null) ? dados[k] : '';
                    });
                    // 13.1: horários anteriores (aliases) e início anterior chegam ao outro operador
                    el.dataset.aliases        = JSON.stringify(dados.aliases || {});
                    el.dataset.inicioAnterior = dados.inicioAnterior != null ? dados.inicioAnterior : '';
                    // ✅ fix bug herança: dataReferencia não está na lista "campos" acima
                    // (chave camelCase vs dataset.datareferencia minúsculo não combinam
                    // automaticamente) — sem isso, outros operadores nunca recebem a
                    // correção de data via sincronização em tempo real.
                    el.dataset.datareferencia = (dados.dataReferencia != null) ? dados.dataReferencia : '';
                    // Agendamento de rendição (objeto aninhado)
                    el.dataset.agendamentohora   = dados.agendamento?.horaAgendada || '';
                    el.dataset.agendamentoequipe = dados.agendamento?.equipe        || '';
                    el.dataset.agendamentosub    = dados.agendamento?.sub           || '';
                    el.dataset.agendamentovt     = dados.agendamento?.vt            || '';

                    // Rerenderiza usando o método compartilhado
                    const bodyEl = el.querySelector('.card-body');
                    if (bodyEl) {
                        bodyEl.innerHTML = Semaforo._buildBodyHTML(el.dataset);
                        el.classList.remove('lazy-pending');
                    }
                    // Fix multi-operador: se a Central está aberta para este card,
                    // atualiza o header do modal com o estado recém-sincronizado
                    if (NitCentral._card === el) {
                        NitCentral._renderHeader(el);
                        NitCentral._iniciarTimers(el);
                    }
                    Semaforo.atualizarPainel();
                });

                kanbanRef.on('child_removed', snap => {
                    const el = document.querySelector(`[data-eventoid="${snap.key}"]`);
                    if (el) { NitLazy.liberar(el); el.remove(); Semaforo.atualizarPainel(); }
                });
            });
        },

        // ── Processar relatório ───────────────────────────────────────────
        handleProcessarClick() {
            this.ultimoLoteNormalizado = [];
            const texto = DOM.relatorioBrutoInput.value;
            if (!texto.trim()) { showToast('Insira o relatório bruto para processar.', 'warning'); return; }
            const eventos = this._parsearRelatorio(texto);
            if (!eventos.length) { showToast('Nenhuma ocorrência encontrada.', 'warning'); return; }

            // ── Guarda de data do plantão ──
            // A data do cabeçalho vira dataReferencia de todo o lote; uma data errada
            // (ex.: modelo CEMOB reaproveitado) esconde os cards do painel em silêncio.
            // Aceita sem aviso somente a data de hoje: o relatório CEMOB conta por dia
            // de calendário (00:01 → 00:00). Qualquer outra data exige confirmação.
            const dataRef = eventos[0]?.dataReferencia || '';
            if (!this._dataPlantaoPlausivel(dataRef)) {
                nitConfirm(
                    '⚠️ Data do plantão divergente',
                    `O cabeçalho do relatório indica *${dataRef || '(sem data)'}*, mas hoje é *${NitData.hoje()}*.\n\nSe processar, as ocorrências ficam registradas com a data do cabeçalho e não aparecem no painel de hoje.\n\nConfira o relatório com o CEMOB. Processar mesmo assim?`,
                    () => this._processarComValidacoes(texto, eventos),
                    () => showToast('Processamento cancelado: data do plantão divergente.', 'warning', 5000)
                );
                return;
            }
            this._processarComValidacoes(texto, eventos);
        },

        _dataPlantaoPlausivel(dataRef) {
            return dataRef === NitData.hoje();
        },

        _processarComValidacoes(texto, eventos) {
            // ── Validação: códigos de 1 dígito são incomuns e podem ser erro de formatação ──
            const suspeitos = eventos.filter(ev => /^[A-Z0-9]$/.test(ev.codigo));
            if (suspeitos.length) {
                const codigos = suspeitos.map(ev => ev.codigo).join(', ');
                const plural  = suspeitos.length > 1 ? 'códigos suspeitos' : 'código suspeito';
                nitConfirm(
                    `⚠️ ${plural.charAt(0).toUpperCase() + plural.slice(1)} detectado${suspeitos.length > 1 ? 's' : ''}`,
                    `Os seguintes códigos têm apenas 1 dígito:\n\n*${codigos}*\n\nIsso pode ser um semáforo real (ex: SCN 4) ou erro de formatação no relatório.\n\nDeseja processar mesmo assim?`,
                    () => {
                        // Confirmado → processa normalmente incluindo suspeitos
                        const temCards = !!document.querySelector('#tab-semaforo .kanban-card');
                        temCards ? this._reprocessar(eventos) : this._cargaInicial(eventos);
                        this._verificarIntegridadeProcessamento(eventos);
                        this.atualizarPainel();
                        NitProcessamento.registrar(texto, eventos, eventos[0]?.dataReferencia || '');
                    },
                    () => {
                        // Cancelado → processa sem os suspeitos
                        const eventosFiltrados = eventos.filter(ev => !/^[A-Z0-9]$/.test(ev.codigo));
                        if (!eventosFiltrados.length) { showToast('Nenhuma ocorrência restante após filtro.', 'warning'); return; }
                        const temCards = !!document.querySelector('#tab-semaforo .kanban-card');
                        temCards ? this._reprocessar(eventosFiltrados) : this._cargaInicial(eventosFiltrados);
                        this._verificarIntegridadeProcessamento(eventosFiltrados);
                        this.atualizarPainel();
                        NitProcessamento.registrar(texto, eventosFiltrados, eventosFiltrados[0]?.dataReferencia || '');
                        showToast(`${suspeitos.length} código(s) suspeito(s) ignorado(s).`, 'info');
                    }
                );
                return; // aguarda resposta do confirm
            }

            // ── Processamento normal (sem suspeitos) ──
            const temCards = !!document.querySelector('#tab-semaforo .kanban-card');
            temCards ? this._reprocessar(eventos) : this._cargaInicial(eventos);
            this._verificarIntegridadeProcessamento(eventos);
            this.atualizarPainel();
            // ✅ Registra metadados do processamento para rastreabilidade e verificação de turno
            NitProcessamento.registrar(texto, eventos, eventos[0]?.dataReferencia || '');
            DOM.relatorioBrutoInput.value = '';
        },

        // ── Plano A v2: conferência de integridade do processamento ───────────
        // Somente observa o resultado já materializado no DOM e informa o operador.
        // NÃO altera motor, Firebase, eventoId, herança ou qualquer ocorrência.
        // Compara relatório × NIT nos dois sentidos (faltas e sobras), estado
        // (pendente × normalizado) e visibilidade no painel de hoje.
        // Referências: CONTRATO-ENTRADA-CEMOB INV-01/06/07 · TODO-026 · TODO-030.
        _verificarIntegridadeProcessamento(eventos) {
            const esperados = Array.isArray(eventos) ? eventos.filter(ev => ev?.eventoId) : [];
            if (!esperados.length) return;

            const hoje    = NitData.hoje();
            const dataRel = esperados[0].dataReferencia || hoje;
            const cards   = Array.from(document.querySelectorAll('#tab-semaforo .kanban-card[data-eventoid]'));
            const porId   = new Map(cards.map(el => [el.dataset.eventoid, el]));
            const ehNorm  = el => !!el.closest('#coluna-normalizados');

            // 13.1: a conferência usa a MESMA classificação do motor, sobre o estado
            // já gravado. Se o motor aplicou tudo, toda linha volta como MANTER (ou
            // como inconsistência conhecida). Qualquer outra decisão = não aplicada.
            const pos = this._classificarLinhas(esperados, this._cardsParaClassificacao());
            const r = { naoAplicadas: [], duasAbertas: [], sequencia: [], legado: [], semInicio: [], sobras: [], estado: [], escondidos: [] };
            const representantes = new Set();
            const legadoVisto = new Set();

            pos.forEach(l => {
                const ev = l.idx != null ? esperados[l.idx] : null;
                const card = porId.get(l.card);
                if (card) representantes.add(card.dataset.eventoid);
                if (l.idx == null) {
                    if (/legado/.test(l.justificativa)) { if (!legadoVisto.has(l.codigo)) { legadoVisto.add(l.codigo); r.legado.push({ codigo: l.codigo, cards: cards.filter(c => c.dataset.codigo === l.codigo && !ehNorm(c)) }); } }
                    else if (l.motivo === 'LINHA_AUSENTE' && card) r.sobras.push({ card });
                    return;
                }
                if (/^(CRIAR_|NORMALIZAR$|RETIFICAR)/.test(l.decisao) && l.gravidade !== 'AMBIGUO') { r.naoAplicadas.push({ ev, l }); return; }
                if (l.motivo === 'ATIVIDADE_INCOMUM') r.estado.push({ ev, card, esperadoNorm: false });
                else if (l.decisao === 'GUARDAR_NO_CARD' && l.gravidade === 'ALERTA') r.duasAbertas.push({ ev, card });
                else if (l.gravidade === 'AMBIGUO') r.sequencia.push({ ev, card, l });
                if (!ev.inicio) r.semInicio.push({ ev });
                if (card && card.dataset.datareferencia !== hoje) r.escondidos.push({ ev, card });
            });

            // Normalizados do mesmo plantão que o relatório não traz mais
            cards.forEach(el => {
                if (el.dataset.datareferencia !== dataRel || !ehNorm(el)) return;
                if (representantes.has(el.dataset.eventoid)) return;
                r.sobras.push({ card: el });
            });

            const visiveis  = cards.filter(el => el.dataset.datareferencia === hoje);
            const cemobNorm = esperados.filter(ev => this.statusFromSecao(ev.secao, ev) === 'NORMALIZADO').length;
            const nitNorm   = visiveis.filter(ehNorm).length;
            r.totais = {
                cemob: { total: esperados.length, pend: esperados.length - cemobNorm, norm: cemobNorm },
                nit:   { total: visiveis.length,  pend: visiveis.length - nitNorm,     norm: nitNorm },
            };

            this._exibirIntegridadeProcessamento(r, dataRel);
        },

        _exibirIntegridadeProcessamento(r, dataRel) {
            const tab = document.querySelector('#tab-semaforo');
            if (!tab) return;

            // Cada novo processamento substitui o resultado de integridade anterior.
            document.getElementById('nit-integridade-processamento')?.remove();

            const { cemob, nit } = r.totais;
            const totaisIguais = cemob.total === nit.total && cemob.pend === nit.pend && cemob.norm === nit.norm;
            const qtdProblemas = r.naoAplicadas.length + r.duasAbertas.length + r.sequencia.length + r.legado.length +
                                 r.semInicio.length + r.sobras.length + r.estado.length + r.escondidos.length;

            const retificados = (this._ultimaAplicacao && this._ultimaAplicacao.retificados) || [];
            this._ultimaAplicacao = null;
            if (!qtdProblemas && totaisIguais) {
                showToast(`✓ Processamento conferido — ${cemob.total}/${cemob.total} ocorrências.` +
                    (retificados.length ? ` ⟲ Horário corrigido: ${retificados.join(', ')}.` : ''), 'success', 6000);
                return;
            }

            const esc = v => String(v ?? '').replace(/[<>&"']/g, c =>
                ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' })[c]);
            // Linha no formato do relatório CEMOB: 🚦 CÓDIGO 🚦 ENDEREÇO ● PROBLEMA ● Início/Fim
            const linha = (o, extra = '') => {
                const ini = o.inicio ? `Início: ${esc(o.inicio)}` : 'Início: <em>não informado</em>';
                const fim = o.fim ? ` ● Fim: ${esc(o.fim)}` : '';
                return `🚦 <strong>${esc(o.codigo)}</strong> 🚦 ${esc(o.endereco || '')} ● ${esc(o.problema || '')} ● ${ini}${fim}${extra}`;
            };
            const doCard = el => ({
                codigo: el.dataset.codigo, endereco: el.dataset.endereco,
                problema: el.dataset.problema, inicio: el.dataset.inicio,
            });

            const blocos = [];
            const bloco = (titulo, itens) => {
                if (!itens.length) return;
                blocos.push(`
                    <div style="margin-top:12px">
                        <strong>${titulo}</strong>
                        ${itens.map(t => `<div style="margin-top:4px">${t}</div>`).join('')}
                    </div>`);
            };
            const nitIdentificou = t => `<div style="margin-top:2px">👉 <strong>O NIT identificou que</strong> ${t}</div>`;
            const fimDe = el => [el.dataset.data_fim, el.dataset.hora_fim].filter(Boolean).join(' ') || el.dataset.fim || '';

            bloco(`⚠️ Ocorrência do relatório não foi aplicada ao painel (${r.naoAplicadas.length})`,
                r.naoAplicadas.map(({ ev }) => linha(ev) + nitIdentificou(
                    `esta linha não ficou registrada no painel. Processe o relatório novamente; se continuar, avise o desenvolvedor.`)));

            bloco(`⚠️ Duas ocorrências abertas do mesmo semáforo (${r.duasAbertas.length})`,
                r.duasAbertas.map(({ ev, card }) => linha(ev) + nitIdentificou(
                    `o relatório lista este semáforo aberto também com início <strong>${esc(card?.dataset.inicio || 'não informado')}</strong>. ` +
                    `O NIT mantém uma única pendência e guardou esta linha no card. ` +
                    `Verifique no relatório se a primeira ocorrência deveria ter <strong>fim</strong> ou se o <strong>início</strong> foi corrigido.`)));

            bloco(`⚠️ Horários que não fecham (${r.sequencia.length})`,
                r.sequencia.map(({ ev, card, l }) => {
                    let t;
                    if (l.decisao === 'IGNORAR_FIM')
                        t = /insuficiente/.test(l.justificativa)
                            ? `o fim desta ocorrência está <strong>sem data ou hora completa</strong>, e o semáforo aparece aberto com outro início. O NIT manteve a pendência e não criou reincidência.`
                            : `o fim desta ocorrência é <strong>depois do início</strong> da outra ocorrência aberta do mesmo semáforo (${esc(card?.dataset.inicio || '')}). O NIT manteve a pendência e não criou reincidência.`;
                    else if (l.decisao === 'CRIAR_NORMALIZADO')
                        t = `o início registrado no painel (${esc(card?.dataset.inicio || '')}) não aparece mais no relatório, e este horário já veio encerrado. O NIT manteve a pendência e registrou este encerramento.`;
                    else if (l.decisao === 'CRIAR_PENDENTE')
                        t = `a ocorrência anterior deste semáforo termina depois deste início (ou está sem data). O NIT registrou a pendência sem marca de reincidência.`;
                    else t = `esta linha não fecha com o horário registrado no painel. O NIT manteve a pendência.`;
                    return linha(ev) + nitIdentificou(t + ` Verifique a <strong>data e a hora</strong> de início e fim no relatório.`);
                }));

            bloco(`⚠️ Dois pendentes do mesmo semáforo — registro anterior (${r.legado.length})`,
                r.legado.map(({ codigo, cards }) => `🚦 <strong>${esc(codigo)}</strong> 🚦 ` + cards.map(c => `Início: ${esc(c.dataset.inicio || 'não informado')}`).join(' · ') +
                    nitIdentificou(`o painel tem ${cards.length} pendências deste semáforo, registradas antes da regra de uma pendência por semáforo. Confira com a fonte qual continua.`)));

            bloco(`ℹ️ Ocorrência sem data e hora de início (${r.semInicio.length})`,
                r.semInicio.map(({ ev }) => linha(ev) + nitIdentificou(
                    `o relatório não informa o <strong>início</strong> deste semáforo; a identificação fica provisória até o início ser informado. Verifique o campo <strong>Início</strong> no relatório.`)));

            bloco(`⚠️ Ocorrência do painel não consta no relatório (${r.sobras.length})`,
                r.sobras.map(({ card }) => {
                    const norm = !!card.closest('#coluna-normalizados');
                    return linha(doCard(card)) + nitIdentificou(`esta ocorrência está ${norm ? 'normalizada' : 'pendente'} no painel, mas não aparece neste relatório. ` +
                        (norm ? `Verifique se o semáforo foi <strong>omitido</strong> da lista de normalizados do relatório.`
                              : `O NIT manteve a pendência. Verifique se o semáforo foi <strong>normalizado</strong> (deveria constar em NORMALIZADOS com Fim) ou se foi <strong>omitido</strong> do relatório.`));
                }));

            bloco(`⚠️ Atividade incomum: normalizado voltou sem fim (${r.estado.length})`,
                r.estado.map(({ ev, card }) => linha(ev) + nitIdentificou(
                    `o painel registrou esta ocorrência como normalizada${card && fimDe(card) ? ` (fim ${esc(fimDe(card))})` : ''}, ` +
                    `mas o relatório a lista como pendente, sem fim. O NIT manteve a normalização. ` +
                    `Verifique no relatório se o <strong>fim</strong> foi apagado por engano ou se o semáforo voltou a falhar.`)));

            bloco(`ℹ️ Horário corrigido pela fonte neste processamento (${retificados.length})`,
                retificados.map(x => `🚦 <strong>${esc(x)}</strong>` + nitIdentificou(`o início deste semáforo foi corrigido no relatório. O NIT manteve o mesmo card, com equipe e histórico.`)));

            if (r.escondidos.length) {
                const datas = [...new Set(r.escondidos.map(({ card }) => card.dataset.datareferencia))].join(', ');
                bloco(`⚠️ Ocorrências registradas com outra data (${r.escondidos.length})`,
                    [nitIdentificou(`estas ocorrências foram registradas com a data <strong>${esc(datas)}</strong>, diferente de hoje (${esc(NitData.hoje())}), e por isso não aparecem no painel. ` +
                        `Verifique a <strong>data no cabeçalho</strong> do relatório.`)]);
            }

            const painel = document.createElement('div');
            painel.id = 'nit-integridade-processamento';
            painel.setAttribute('role', 'alert');
            painel.style.cssText = [
                'margin:10px 0',
                'padding:12px 14px',
                'border:1px solid #d97706',
                'border-left:5px solid #d97706',
                'border-radius:8px',
                'background:#fff7ed',
                'color:#7c2d12',
                'font-size:14px',
                'line-height:1.35'
            ].join(';');

            const resumo = `Conferência: relatório × painel`;
            painel.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                    <strong>${resumo}</strong>
                    <button type="button" data-integridade-recolher
                        style="border:0;background:transparent;cursor:pointer;font-weight:700;color:inherit;padding:3px 6px"
                        aria-expanded="true">Recolher</button>
                </div>
                <div data-integridade-detalhes>
                    <table style="margin-top:8px;border-collapse:collapse;font-size:13px">
                        <tr><th></th><th style="padding:0 10px">Total</th><th style="padding:0 10px">Pendentes</th><th style="padding:0 10px">Normalizados</th></tr>
                        <tr><td><strong>Relatório (linhas)</strong></td><td align="center">${cemob.total}</td><td align="center">${cemob.pend}</td><td align="center">${cemob.norm}</td></tr>
                        <tr><td><strong>Painel (cards)</strong></td><td align="center">${nit.total}</td><td align="center">${nit.pend}</td><td align="center">${nit.norm}</td></tr>
                    </table>
                    ${blocos.join('')}
                    <div style="margin-top:10px;opacity:.85">O NIT não alterou nada por causa desta conferência.</div>
                </div>`;

            const btn = painel.querySelector('[data-integridade-recolher]');
            const corpo = painel.querySelector('[data-integridade-detalhes]');
            btn?.addEventListener('click', () => {
                const recolhido = corpo.style.display === 'none';
                corpo.style.display = recolhido ? '' : 'none';
                btn.textContent = recolhido ? 'Recolher' : `⚠ Relatório ${cemob.total} × Painel ${nit.total}`;
                btn.setAttribute('aria-expanded', recolhido ? 'true' : 'false');
            });

            tab.prepend(painel);
        },

        _ehCabecalho(linha) {
            const l = linha.trim();
            if (!l) return true;
            if (/NORMALIZADOS/i.test(l) && /[✅❌*]/.test(l)) return true;
            if (/PENDENTES/i.test(l)    && /[✅❌*]/.test(l)) return true;
            return /^[-=*#_]{3,}/.test(l)
                || /^\*?STATUS\s+SEMAF/i.test(l)
                || /^\d{2}\/\d{2}\/\d{4}/.test(l)
                || /^ocorr[êe]ncias?\s*[:(\d]/i.test(l)
                || /^\*?pendentes?\s*[:(\d*]/i.test(l)
                || /^\*?normalizados?\s*[:(\d*]/i.test(l)
                || /^\*?\d+\s*(ocorr|pend|norm)/i.test(l)
                || /^[\u2600-\u27BF\uFE00-\uFE0F]{1,4}\s*(\*|\d|$)/u.test(l)
                || /^[-–—]+\s*\d{2}:\d{2}/.test(l);
        },

        _parsearRelatorio(texto) {
            const linhas      = texto.split('\n');
            const dataRef     = this.extrairDataReferencia(linhas);
            const plantonista = this.extrairPlantonista(linhas);
            const eventos = [];
            let atual     = null;
            let secao     = 'PENDENTE';

            for (const linha of linhas) {
                if (/\*?NORMALIZADOS\*?\s*✅/.test(linha)) { secao = 'NORMALIZADO'; continue; }
                if (/\*?PENDENTES\*?\s*❌/.test(linha))    { secao = 'PENDENTE';    continue; }
                const dados = this.extrairDadosDaLinha(linha);
                if (dados) {
                    if (atual) eventos.push(atual);
                    atual = { ...dados, secao, dataReferencia: dataRef, plantonista };
                } else if (atual && linha.trim() && !this._ehCabecalho(linha)) {
                    // Guarda adicional: ignora linhas de cabeçalho de plantão
                    if (/PLANTONISTA|PLANTÃO|TÉCNICOS|CEMOB/i.test(linha)) continue;
                    // ✅ GUARDA #19: ignora linha que é só "Obs:" sem conteúdo útil
                    if (/^\s*["*]*\s*\*?Obs[.:*]?\*?\s*["*]*\s*$/.test(linha)) continue;
                    let limpa = linha.trim()
                        .replace(/["*]/g, '')
                        .replace(/\*?Obs:\*?/gi, '')
                        .replace(/\/log\b.*/i, '')
                        .replace(/\s+/g, ' ').trim();
                    if (limpa && !/^\d{2}[:/]\d{2}$/.test(limpa) && !/^\d{2}\/\d{2}\/\d{4}$/.test(limpa)) {
                        atual.observacoes += (atual.observacoes ? ' ' : '') + limpa;
                    }
                }
            }
            if (atual) eventos.push(atual);
            // 13.1: sem Início, a identidade é fixa (código + data do plantão + ordem),
            // sem Date.now() — reprocessar o mesmo relatório dá o mesmo eventoId.
            const semInicio = {};
            return eventos
                .filter(ev => ev.codigo)
                .map(ev => {
                    if ((ev.inicio || '').trim()) return { ...ev, eventoId: this.gerarEventoId(ev.codigo, ev.inicio) };
                    const n = (semInicio[ev.codigo] = (semInicio[ev.codigo] || 0) + 1);
                    const d = (ev.dataReferencia || '').replace(/[^0-9]/g, '');
                    return { ...ev, eventoId: `${ev.codigo}_SI${d}${n > 1 ? '_' + n : ''}` };
                });
        },

        // ── 13.1: classificação de linhas (SOMENTE LEITURA) ─────────────────
        // Recebe o relatório inteiro (eventos do parser) e o estado dos cards e
        // devolve, linha a linha, a decisão que o motor DEVERIA tomar pela regra
        // "um semáforo, uma pendência" (aprovada em 14/10/2026). Não grava nada,
        // não toca no DOM e não é chamada pelo motor nesta etapa.
        //
        // cards: [{ id, codigo, inicio, aliases:[eventoId...], normalizado, fim, dataReferencia }]
        //   fim = 'dd/mm/aaaa hh:mm' (vazio se pendente)
        // Cada grupo (mesmo semáforo) é decidido olhando TODAS as suas linhas e
        // cards, ordenadas por horário — nunca pela ordem do relatório.
        _classificarLinhas(eventos, cards) {
            const ts = s => {
                const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec((s || '').trim());
                return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null;
            };
            const idDe = (cod, ini) => (ini && ini.trim()) ? this.gerarEventoId(cod, ini) : null;
            const out = [];
            const grupos = new Map();
            const grupo = cod => { if (!grupos.has(cod)) grupos.set(cod, { linhas: [], cards: [] }); return grupos.get(cod); };
            (eventos || []).forEach((ev, idx) => grupo(ev.codigo).linhas.push({
                ev, idx, id: idDe(ev.codigo, ev.inicio),
                fechada: this.statusFromSecao(ev.secao, ev) === 'NORMALIZADO',
                tIni: ts(ev.inicio), tFim: ts(ev.fim),
            }));
            (cards || []).forEach(c => grupo(c.codigo).cards.push({
                ...c,
                atualId: idDe(c.codigo, c.inicio),
                antigos: new Set([c.id, ...(c.aliases || [])].filter(a => a && a !== idDe(c.codigo, c.inicio))),
                tIni: ts(c.inicio), tFim: ts(c.fim),
            }));
            for (const [cod, g] of grupos) this._classificarGrupo(cod, g, out, ts);
            out.sort((a, b) => (a.idx ?? 1e9) - (b.idx ?? 1e9));
            return out;
        },

        _classificarGrupo(cod, g, out, ts) {
            const hm = l => `${l.ev.inicio || '(sem início)'}${l.fechada ? ' → ' + (l.ev.fim || '(fim sem data)') : ''}`;
            const row = (l, card, ocorrencia, decisao, justificativa, gravidade = 'NENHUMA', extra = {}) =>
                out.push({ idx: l ? l.idx : null, codigo: cod, linha: l ? `${hm(l)} ${l.fechada ? 'ENCERRADA' : 'ABERTA'}` : '(sem linha no relatório)',
                           ocorrencia, card, decisao, justificativa, gravidade, ...extra });
            const seq = (fim, ini) => fim != null && ini != null ? (fim <= ini ? 'OK' : 'SOBREPOSTO') : 'INSUFICIENTE';
            const linhas = g.linhas.slice().sort((a, b) => (a.tIni ?? 9e15) - (b.tIni ?? 9e15) || a.idx - b.idx);
            const livres = new Set(linhas);
            const pend = g.cards.filter(c => !c.normalizado);
            const norm = g.cards.filter(c => c.normalizado);

            // 1. Reconhecimento exato: início atual, horário anterior (alias) ou "sem início"
            const atualDe = new Map(), antigasDe = new Map();
            for (const c of g.cards) { antigasDe.set(c, []); }
            for (const l of linhas) {
                let c = g.cards.find(c => l.id && c.atualId === l.id);
                if (!c && !l.id) c = pend.find(c => !c.atualId && !atualDe.has(c));
                if (c && !atualDe.has(c)) { atualDe.set(c, l); livres.delete(l); continue; }
                const a = l.id && g.cards.find(c => c.antigos.has(l.id));
                if (a) { antigasDe.get(a).push(l); livres.delete(l); }
            }

            // 2. Cards normalizados
            for (const c of norm) {
                const l = atualDe.get(c);
                if (l && l.fechada) row(l, c.id, c.id, 'MANTER', 'mesma ocorrência, já normalizada (relatório cumulativo)');
                if (l && !l.fechada) row(l, c.id, c.id, 'MANTER', 'normalizado voltou sem fim: só com decisão humana (BR-NOR-007)', 'ALERTA', { motivo: 'ATIVIDADE_INCOMUM' });
                for (const a of antigasDe.get(c)) row(a, c.id, c.id, 'MANTER', 'horário anterior de ocorrência já normalizada', 'REGISTRO');
            }

            // 3. Cards pendentes
            let pendenteFica = null;      // card que continua pendente após esta classificação
            let predecessor = null;       // última ocorrência encerrada conhecida { tFim, dataRef, card }
            for (const c of norm) if (c.tFim != null && (!predecessor || c.tFim > predecessor.tFim)) predecessor = { tFim: c.tFim, dataRef: c.dataReferencia, card: c.id };
            if (pend.length > 1) {
                for (const c of pend) row(null, c.id, c.id, 'MANTER', `legado: ${pend.length} pendentes do mesmo semáforo; não mesclar automaticamente`, 'AMBIGUO');
            }
            for (const c of pend) {
                const atual = atualDe.get(c);
                const antigas = antigasDe.get(c);
                if (atual && !atual.fechada) {
                    pendenteFica = c;
                    const antigaFechada = antigas.find(a => a.fechada);
                    for (const a of antigas.filter(a => a !== antigaFechada))
                        row(a, c.id, c.id, 'GUARDAR_NO_CARD', 'duas linhas abertas do mesmo semáforo (uma é horário anterior do card): inconsistência da fonte', 'ALERTA', { acaoSegura: 'manter card com o início atual' });
                    if (antigaFechada) {
                        const s = seq(antigaFechada.tFim, atual.tIni);
                        if (s === 'OK') {
                            row(antigaFechada, c.id, c.id, 'NORMALIZAR', `horário anterior volta encerrado (fim ≤ ${atual.ev.inicio}): segue o relatório; card volta ao início anterior e encerra`, 'REGISTRO', { voltaInicio: antigaFechada.ev.inicio, liberaId: atual.id });
                            row(atual, `novo:${atual.idx}`, `nova(${atual.ev.inicio})`, 'CRIAR_PENDENTE_REINC', 'nova ocorrência após o fim da anterior; retirar este horário dos anteriores do card', 'REGISTRO');
                            pendenteFica = `novo:${atual.idx}`;
                        } else {
                            row(antigaFechada, c.id, c.id, 'IGNORAR_FIM', `horário anterior não encerra (${s === 'SOBREPOSTO' ? 'fim depois do início atual' : 'data/hora insuficiente'})`, 'AMBIGUO', { acaoSegura: 'manter pendente' });
                            row(atual, c.id, c.id, 'MANTER', 'início atual continua aberto');
                        }
                    } else row(atual, c.id, c.id, 'MANTER', 'mesma ocorrência, continua pendente');
                    continue;
                }
                if (atual && atual.fechada) {
                    // encerramento do início atual; decide junto com eventuais novas abertas (passo 4)
                    c._encerra = atual;
                    // horários anteriores ABERTOS (ex.: linha guardada) competem como "outra aberta" no passo 4
                    c._abertasAntigas = antigas.filter(a => !a.fechada);
                    for (const a of antigas.filter(a => a.fechada)) row(a, c.id, c.id, 'MANTER', 'horário anterior; o início atual é que encerra', 'REGISTRO');
                    continue;
                }
                // sem linha do início atual
                if (antigas.length) {
                    const ab = antigas.filter(a => !a.fechada), fe = antigas.filter(a => a.fechada);
                    if (antigas.length === 1 && ab.length === 1) { row(ab[0], c.id, c.id, 'RETIFICAR', 'fonte voltou a um horário anterior; início atual passa a ele'); pendenteFica = c; continue; }
                    if (antigas.length === 1 && fe.length === 1) { row(fe[0], c.id, c.id, 'RETIFICAR_E_NORMALIZAR', 'fonte voltou ao horário anterior e informou fim'); predecessor = { tFim: fe[0].tFim, dataRef: fe[0].ev.dataReferencia, card: c.id }; continue; }
                    for (const a of antigas) row(a, c.id, c.id, 'MANTER', 'vários horários anteriores reaparecem', 'AMBIGUO', { acaoSegura: 'manter pendente' });
                    pendenteFica = c; continue;
                }
                const abertas = [...livres].filter(l => !l.fechada);
                if (pend.length === 1 && abertas.length >= 1) {
                    const [r, ...resto] = abertas;
                    livres.delete(r);
                    row(r, c.id, c.id, 'RETIFICAR', c.atualId ? `início do card (${c.inicio}) sumiu do relatório e o semáforo aparece com novo início: correção de horário` : 'card sem início recebe o início informado (enriquecimento)', 'REGISTRO', { inicioAnterior: c.inicio || '' });
                    for (const x of resto) { livres.delete(x); row(x, c.id, c.id, 'GUARDAR_NO_CARD', 'duas linhas abertas do mesmo semáforo: inconsistência da fonte', 'ALERTA'); }
                    pendenteFica = c; continue;
                }
                const fechadasLivres = [...livres].filter(l => l.fechada);
                // CONTRATO §13 (caso real 468/790): o relatório é cumulativo no dia — uma linha só some se a
                // fonte a editou. Início do card sumiu + o semáforo aparece com UMA única outra linha, já
                // encerrada, e nenhuma aberta → correção de horário com encerramento no MESMO card.
                if (pend.length === 1 && fechadasLivres.length === 1 && livres.size === 1) {
                    const x = fechadasLivres[0];
                    livres.delete(x);
                    row(x, c.id, c.id, 'RETIFICAR_E_NORMALIZAR',
                        `início do card (${c.inicio || 'sem início'}) sumiu do relatório e o semáforo aparece com um único horário, já encerrado: correção de horário com fim no mesmo card (CONTRATO §13)`,
                        'REGISTRO', { inicioAnterior: c.inicio || '' });
                    predecessor = { tFim: x.tFim, dataRef: x.ev.dataReferencia, card: c.id };
                    continue;
                }
                if (pend.length === 1 && fechadasLivres.length) {
                    for (const x of fechadasLivres) { livres.delete(x); row(x, `novo:${x.idx}`, `nova(${x.ev.inicio})`, 'CRIAR_NORMALIZADO', `início do card (${c.inicio}) sumiu e aparecem várias linhas encerradas: correção ou outras ocorrências?`, 'AMBIGUO', { acaoSegura: 'criar normalizado e manter o card pendente' }); }
                    pendenteFica = c; continue;
                }
                row(null, c.id, c.id, 'MANTER', 'linha ausente não é encerramento; continua pendente', 'ALERTA', { motivo: 'LINHA_AUSENTE' });
                pendenteFica = c;
            }

            // 4. Encerramentos do início atual + linhas novas, em ordem de horário
            const encerrando = pend.find(c => c._encerra);
            if (encerrando) {
                const l = encerrando._encerra;
                const antigasAbertas = encerrando._abertasAntigas || [];
                const abertas = [...[...livres].filter(x => !x.fechada), ...antigasAbertas]
                    .sort((a, b) => (a.tIni ?? 9e15) - (b.tIni ?? 9e15) || a.idx - b.idx);
                const abertaNova = abertas[0];
                const s = abertaNova ? seq(l.tFim, abertaNova.tIni) : 'OK';
                if (s === 'OK') {
                    const liberar = abertaNova && antigasAbertas.includes(abertaNova) ? { liberaId: abertaNova.id } : {};
                    row(l, encerrando.id, encerrando.id, 'NORMALIZAR', 'fim explícito do início atual', 'NENHUMA', liberar);
                    predecessor = { tFim: l.tFim, dataRef: l.ev.dataReferencia, card: encerrando.id }; // encerra neste relatório → passa a pertencer a esta data
                    // horário anterior aberto (guardado) que agora vem depois do fim → vira a nova ocorrência
                    if (abertaNova && antigasAbertas.includes(abertaNova)) {
                        row(abertaNova, `novo:${abertaNova.idx}`, `nova(${abertaNova.ev.inicio})`,
                            predecessor.dataRef === abertaNova.ev.dataReferencia ? 'CRIAR_PENDENTE_REINC' : 'CRIAR_PENDENTE',
                            'linha guardada no card agora vem depois do fim da anterior: nova ocorrência', 'REGISTRO');
                        pendenteFica = `novo:${abertaNova.idx}`;
                        for (const x of antigasAbertas.slice(1)) row(x, pendenteFica, 'mesma pendente', 'GUARDAR_NO_CARD', 'duas linhas abertas do mesmo semáforo: inconsistência da fonte', 'ALERTA');
                    } else {
                        for (const x of antigasAbertas) row(x, encerrando.id, encerrando.id, 'MANTER', 'horário anterior aberto de ocorrência que encerra', 'AMBIGUO');
                    }
                } else {
                    row(l, encerrando.id, encerrando.id, 'IGNORAR_FIM', `fim do início atual ${s === 'SOBREPOSTO' ? 'é posterior ao início da outra linha aberta' : 'sem data/hora suficiente para comparar'}: não presume reincidência`, 'AMBIGUO', { acaoSegura: 'manter pendente' });
                    for (const x of abertas) {
                        livres.delete(x);
                        row(x, encerrando.id, encerrando.id, 'GUARDAR_NO_CARD', 'linha aberta guardada no card que continua pendente', 'AMBIGUO');
                    }
                    pendenteFica = encerrando;
                }
                delete encerrando._encerra; delete encerrando._abertasAntigas;
            }
            for (const l of linhas.filter(x => livres.has(x))) {
                livres.delete(l);
                if (l.fechada) {
                    const reinc = predecessor && seq(predecessor.tFim, l.tIni) === 'OK' && predecessor.dataRef === l.ev.dataReferencia;
                    row(l, `novo:${l.idx}`, `nova(${l.ev.inicio})`, 'CRIAR_NORMALIZADO', reinc ? 'ocorrência já encerrada, depois da anterior (reincidente)' : 'ocorrência já encerrada', 'NENHUMA', { reincidente: !!reinc });
                    if (l.tFim != null && (!predecessor || l.tFim > predecessor.tFim)) predecessor = { tFim: l.tFim, dataRef: l.ev.dataReferencia, card: `novo:${l.idx}` };
                    continue;
                }
                if (pendenteFica) {
                    row(l, typeof pendenteFica === 'string' ? pendenteFica : pendenteFica.id, 'mesma pendente', 'GUARDAR_NO_CARD', 'duas linhas abertas do mesmo semáforo: inconsistência da fonte', 'ALERTA');
                    continue;
                }
                if (!predecessor) { row(l, `novo:${l.idx}`, `nova(${l.ev.inicio || 'sem início'})`, 'CRIAR_PENDENTE', l.id ? 'ocorrência nova' : 'ocorrência nova sem início: identidade provisória', l.id ? 'NENHUMA' : 'REGISTRO'); pendenteFica = `novo:${l.idx}`; continue; }
                const s = seq(predecessor.tFim, l.tIni);
                if (s === 'OK') {
                    const mesmaData = predecessor.dataRef === l.ev.dataReferencia;
                    row(l, `novo:${l.idx}`, `nova(${l.ev.inicio})`, mesmaData ? 'CRIAR_PENDENTE_REINC' : 'CRIAR_PENDENTE', mesmaData ? 'nova ocorrência após o fim da anterior, mesma data: reincidente' : 'nova ocorrência após o fim da anterior, outra data: sem marca');
                } else {
                    row(l, `novo:${l.idx}`, `nova(${l.ev.inicio || 'sem início'})`, 'CRIAR_PENDENTE', `semáforo aberto no relatório; ${s === 'SOBREPOSTO' ? 'sobrepõe a anterior' : 'dados insuficientes'}: sem marca de reincidência`, 'AMBIGUO', { acaoSegura: 'criar pendente (não perder pendência)' });
                }
                pendenteFica = `novo:${l.idx}`;
            }
        },

        // Estado atual dos cards no painel, no formato de _classificarLinhas (só leitura).
        _cardsParaClassificacao() {
            return [...document.querySelectorAll('#tab-semaforo .kanban-card')].map(el => {
                let aliases = [];
                try { aliases = Object.keys(JSON.parse(el.dataset.aliases || '{}')); } catch (e) {}
                const fim = `${el.dataset.data_fim || ''} ${el.dataset.hora_fim || ''}`.trim();
                return { id: el.dataset.eventoid, codigo: el.dataset.codigo, inicio: el.dataset.inicio || '',
                         aliases, normalizado: !!el.closest('#coluna-normalizados'), fim,
                         dataReferencia: el.dataset.datareferencia || '' };
            });
        },

        // ── Carga inicial (painel vazio) ──────────────────────────────────
        // 13.1: decide pela mesma classificação do reprocessamento (_classificarLinhas),
        // com o painel vazio. Grava tudo numa única escrita, como antes.
        _cargaInicial(eventos) {
            const linhas = this._classificarLinhas(eventos, []);
            this._aplicarClassificacao(eventos, linhas, { lote: true });
        },

        // ── Reprocessar (painel já tem cards) ────────────────────────────
        // 13.1: substitui a herança só por código (cardHerdado). A decisão vem de
        // _classificarLinhas, que olha o relatório INTEIRO e o estado dos cards,
        // em ordem de horário — nunca pela ordem das linhas. Regra: um semáforo,
        // no máximo uma pendência (BUSINESS-RULES, 14/10/2026).
        _reprocessar(eventos) {
            const linhas = this._classificarLinhas(eventos, this._cardsParaClassificacao());
            this._aplicarClassificacao(eventos, linhas, { lote: false });
        },

        // Aplica as decisões. Nunca apaga card nem campo operacional (equipe, VT,
        // despacho, histórico): só acrescenta/atualiza campos da ocorrência.
        _aplicarClassificacao(eventos, linhas, { lote }) {
            const cardDe   = id => document.querySelector(`#tab-semaforo .kanban-card[data-eventoid="${id}"]`);
            const lotePayload = {};
            const gravar = (id, patch) => {
                if (lote) { lotePayload[id] = { ...(lotePayload[id] || {}), ...patch }; return; }
                NitFirebase.exec((db, ref, update) => update(ref(db, `kanban/${id}`), { ...patch, ts: Date.now() }));
            };
            const aliasesDe = el => { try { return JSON.parse(el.dataset.aliases || '{}'); } catch (e) { return {}; } };
            const addAlias = (el, idCard, idAlias) => {
                if (!idAlias || idAlias === idCard) return {};
                const a = aliasesDe(el); a[idAlias] = true; el.dataset.aliases = JSON.stringify(a);
                return lote ? { aliases: a } : { [`aliases/${idAlias}`]: true };
            };
            const atualIdDe = el => (el.dataset.inicio ? this.gerarEventoId(el.dataset.codigo, el.dataset.inicio) : null);
            const linhaEhAtual = (el, ev) => {
                const a = atualIdDe(el);
                return a ? (ev.inicio && this.gerarEventoId(ev.codigo, ev.inicio) === a) : !ev.inicio;
            };
            const camposRelatorio = (el, ev) => {
                // observações, tipo e problema podem chegar corrigidos (comportamento anterior preservado)
                const p = {};
                if (ev.observacoes && ev.observacoes !== el.dataset.observacoes) { el.dataset.observacoes = ev.observacoes; p.observacoes = ev.observacoes; }
                const tipoAtual = el.dataset.tipo || '';
                if (ev.tipo && ev.tipo !== 'N/I' && ev.tipo !== tipoAtual) { el.dataset.tipo = ev.tipo; p.tipo = ev.tipo; }
                if (ev.problema && ev.problema !== el.dataset.problema) { el.dataset.problema = ev.problema; p.problema = ev.problema; }
                return p;
            };
            const fimPartes = ev => { const [d = '', h = ''] = (ev.fim || '').trim().split(' '); return { data_fim: d, hora_fim: h }; };
            const normalizar = (el, ev, extra = {}) => {
                DOM.colunaNormalizados.prepend(el);
                el.classList.add('card-foi-normalizado');
                setTimeout(() => el.classList.remove('card-foi-normalizado'), 2000);
                this.ultimoLoteNormalizado.push(el.id);
                el.dataset.datareferencia = ev.dataReferencia;
                const f = fimPartes(ev);
                el.dataset.data_fim = f.data_fim; el.dataset.hora_fim = f.hora_fim;
                gravar(el.dataset.eventoid, {
                    coluna: 'coluna-normalizados', status: 'NORMALIZADO', pl: 'norm',
                    ...f, ts_norm: Date.now(), dataReferencia: ev.dataReferencia,
                    ...(ev.observacoes && { observacoes: ev.observacoes }), ...extra,
                });
            };

            const novos = new Map();   // 'novo:idx' → elemento criado
            const st = { criados: 0, transicoes: 0, herdados: new Set(), retificados: [], registros: new Set(), conferir: new Set() };

            // 1) criações primeiro (outras decisões podem apontar para o card novo)
            for (const r of linhas.filter(r => /^CRIAR_/.test(r.decisao))) {
                const ev = eventos[r.idx];
                const status = r.decisao === 'CRIAR_NORMALIZADO' ? 'NORMALIZADO' : this.statusFromSecao(ev.secao, ev);
                const dados = { ...ev, reincidente: r.decisao === 'CRIAR_PENDENTE_REINC' || !!r.reincidente };
                if (cardDe(ev.eventoId)) continue; // já existe (ex.: outro operador gravou primeiro)
                const el = this.criarElementoCard(`card-${AppState.cardIdCounter++}`, dados);
                this._colocarCardNaColuna(el, status);
                if (status === 'NORMALIZADO') this.ultimoLoteNormalizado.push(el.id);
                if (lote) lotePayload[ev.eventoId] = this._payloadFirebase(dados, status);
                else NitFirebase.exec((db, ref, update) => update(ref(db, `kanban/${ev.eventoId}`), this._payloadFirebase(dados, status)));
                novos.set(`novo:${r.idx}`, el);
                st.criados++;
            }

            // 2) demais decisões sobre cards existentes (ou recém-criados)
            for (const r of linhas) {
                if (/^CRIAR_/.test(r.decisao) || r.idx == null) continue;
                const ev = eventos[r.idx];
                const el = String(r.card).startsWith('novo:') ? novos.get(r.card) : cardDe(r.card);
                if (!el) continue;
                const id = el.dataset.eventoid;
                const pendente = !el.closest('#coluna-normalizados');
                if (r.gravidade === 'ALERTA' || r.gravidade === 'AMBIGUO') st.conferir.add(r.codigo);
                if (r.gravidade === 'REGISTRO' && r.decisao !== 'RETIFICAR' && r.decisao !== 'MANTER') st.registros.add(r.codigo);
                const heranca = () => {
                    if (pendente && ev.dataReferencia && ev.dataReferencia !== el.dataset.datareferencia) {
                        el.dataset.datareferencia = ev.dataReferencia;
                        st.herdados.add(id);
                        return { dataReferencia: ev.dataReferencia, ts_dataReferencia: Date.now() };
                    }
                    return {};
                };

                switch (r.decisao) {
                    case 'MANTER': {
                        if (r.motivo === 'ATIVIDADE_INCOMUM') break; // BR-NOR-007: só com decisão humana
                        const p = { ...(linhaEhAtual(el, ev) ? camposRelatorio(el, ev) : {}), ...heranca() };
                        if (Object.keys(p).length) gravar(id, p);
                        break;
                    }
                    case 'NORMALIZAR': {
                        const extra = {};
                        if (r.voltaInicio) {
                            extra.inicioAnterior = el.dataset.inicio || '';
                            extra.inicio = r.voltaInicio;
                            el.dataset.inicio = r.voltaInicio;
                        }
                        if (r.liberaId) { // o horário passa a ser de outra ocorrência (reincidência)
                            const a = aliasesDe(el); delete a[r.liberaId]; el.dataset.aliases = JSON.stringify(a);
                            if (lote) extra.aliases = a; else extra[`aliases/${r.liberaId}`] = null;
                        }
                        normalizar(el, ev, { ...camposRelatorio(el, ev), ...extra });
                        st.transicoes++;
                        break;
                    }
                    case 'RETIFICAR':
                    case 'RETIFICAR_E_NORMALIZAR': {
                        const de = el.dataset.inicio || '';
                        const patch = { ...addAlias(el, id, atualIdDe(el)), inicio: ev.inicio || '', inicioAnterior: de, ts_retificacao: Date.now() };
                        el.dataset.inicio = ev.inicio || '';
                        el.dataset.inicioAnterior = de;
                        st.retificados.push(`${r.codigo} (${(de.split(' ')[1] || de || 'sem início')} → ${(ev.inicio || '').split(' ')[1] || ev.inicio})`);
                        if (r.decisao === 'RETIFICAR') gravar(id, { ...patch, ...camposRelatorio(el, ev), ...heranca() });
                        else { normalizar(el, ev, { ...patch, ...camposRelatorio(el, ev) }); st.transicoes++; }
                        break;
                    }
                    case 'GUARDAR_NO_CARD': {
                        const p = { ...addAlias(el, id, ev.eventoId), ...heranca() };
                        if (Object.keys(p).length) gravar(id, p);
                        break;
                    }
                    case 'IGNORAR_FIM': {
                        const p = heranca();
                        if (Object.keys(p).length) gravar(id, p);
                        break;
                    }
                }
                // re-render do corpo do card com os dados novos
                const body = el.querySelector('.card-body');
                if (body && ['RETIFICAR', 'RETIFICAR_E_NORMALIZAR', 'NORMALIZAR'].includes(r.decisao)) body.innerHTML = this._buildBodyHTML(el.dataset);
            }

            if (lote) {
                NitFirebase.exec((db, ref, update) => {
                    update(ref(db, 'kanban'), lotePayload);
                    update(ref(db, 'meta'), {
                        dataReferencia:      eventos[0]?.dataReferencia,
                        turnoAtivo:          NitLogin.turno || '',
                        ultimoProcessamento: Date.now(),
                    });
                });
                AppState.totalOcorrenciasCriadas = st.criados;
            } else {
                AppState.totalOcorrenciasCriadas += st.criados;
            }

            const msgs = [];
            if (lote) msgs.push(`${eventos.length} ocorrência(s) processada(s).`);
            else {
                if (st.criados)        msgs.push(`${st.criados} nova(s) adicionada(s).`);
                if (st.transicoes)     msgs.push(`${st.transicoes} normalizada(s).`);
                if (st.herdados.size)  msgs.push(`${st.herdados.size} pendência(s) herdada(s) do dia anterior.`);
            }
            if (st.retificados.length) msgs.push(`⟲ Horário corrigido: ${st.retificados.join(', ')}.`);
            if (st.registros.size)     msgs.push(`ℹ️ Registrado: ${[...st.registros].join(', ')}.`);
            if (st.conferir.size)      msgs.push(`⚠️ Conferir no relatório: ${[...st.conferir].join(', ')}.`);
            showToast(msgs.length ? msgs.join(' ') : 'Nenhuma mudança detectada.', msgs.length ? 'success' : 'info');
            this._ultimaAplicacao = { retificados: st.retificados.slice() };
            return { linhas, ...st };
        },

        // ── Helpers internos ─────────────────────────────────────────────
        _colocarCardNaColuna(el, status) {
            const mapa = {
                NORMALIZADO:     () => DOM.colunaNormalizados.prepend(el),
                SEM_NECESSIDADE: () => document.querySelector('#coluna-sem-necessidade .kanban-cards-container').appendChild(el),
            };
            (mapa[status] || (() => document.querySelector('#coluna-espera .kanban-cards-container').appendChild(el)))();
        },

        _payloadFirebase(ev, status) {
            const colunaMap = { NORMALIZADO: 'coluna-normalizados', SEM_NECESSIDADE: 'coluna-sem-necessidade' };

            // Extrai data e hora de fim do campo ev.fim (formato "DD/MM/YYYY HH:MM")
            const fimPartes = (ev.fim || '').trim().split(' ');
            const dataFim   = fimPartes[0] || '';
            const horaFim   = fimPartes[1] || '';

            return {
                coluna:         colunaMap[status] || 'coluna-espera',
                codigo:         ev.codigo,
                eventoId:       ev.eventoId,
                dataReferencia: ev.dataReferencia || '',
                endereco:       ev.endereco    || '',
                problema:       ev.problema    || '',
                tipo:           ev.tipo        || '',
                inicio:         ev.inicio      || '',
                status,
                // Campos que chegam vazios do relatório NÃO devem sobrescrever
                // dados já gravados no Firebase (equipe, obs gravadas manualmente)
                ...(ev.observacoes && { observacoes: ev.observacoes }),
                ...(ev.equipe      && { equipe:      ev.equipe  }),
                ...(ev.viatura     && { viatura:      ev.viatura }),
                ...(ev.pl          && { pl:           ev.pl      }),
                ...(ev.sub         && { sub:          ev.sub     }),
                reincidente:    ev.reincidente || false,
                plantonista:    ev.plantonista || '',
                operador:       NitLogin.operador || 'anon',
                turno:          NitLogin.turno    || '',
                ts:             Date.now(),
                // Gravar campos de fim quando ocorrência nasce normalizada
                ...(status === 'NORMALIZADO' && {
                    data_fim: dataFim,
                    hora_fim: horaFim,
                    ts_norm:  Date.now(),
                    pl:       'norm',
                }),
            };
        },

        criarNovoCard(cardData, status) {
            const el = this.criarElementoCard(`card-${AppState.cardIdCounter++}`, cardData);
            this._colocarCardNaColuna(el, status);
            NitFirebase.exec((db, ref, update) =>
                update(ref(db, `kanban/${cardData.eventoId}`), this._payloadFirebase(cardData, status))
            );
        },

        // ── DOM do card ───────────────────────────────────────────────────
        criarElementoCard(cardId, cardData) {
            const card = document.createElement('div');
            card.id        = cardId;
            card.className = 'kanban-card';
            card.draggable = true;
            card.setAttribute('role',     'article');
            card.setAttribute('tabindex', '0');

            const _dsMap = { dataReferencia: 'datareferencia', eventoId: 'eventoid' };
            Object.entries(cardData).forEach(([k, v]) => {
                if (v !== undefined) card.dataset[_dsMap[k] || k] = v;
            });
            // 13.1: aliases é objeto no Firebase → guardado como JSON no dataset
            card.dataset.aliases = JSON.stringify(cardData.aliases && typeof cardData.aliases === 'object' ? cardData.aliases : {});

            const frase = this._fraseTecnica(cardData.observacoes, cardData.status, cardData.inicio);
            const reinc = (cardData.reincidente === true || cardData.reincidente === 'true')
                ? '<span class="reincident-tag" title="Reincidência">↺ REINC</span>' : '';

            card.innerHTML = `
                <div class="card-header">
                    <strong>${cardData.codigo}</strong>
                    <span class="card-status-tag">${cardData.problema}</span>
                    ${reinc}
                </div>
                <div class="card-body card-body-lazy"></div>
                <div class="card-footer">
                    <button class="btn-card-action copy-location" title="Copiar Localização"><i class="fa-solid fa-location-crosshairs"></i></button>
                    <button class="btn-card-action details"       title="Central da Ocorrência"><i class="fas fa-info-circle"></i></button>
                    <button class="btn-card-action complete"      title="Normalizar"><i class="fas fa-check-circle"></i></button>
                </div>`;

            // ✅ renderiza o body imediatamente com dados em memória
            // NitLazy continua observando para cards fora do viewport,
            // mas cards visíveis recebem conteúdo sem depender do IntersectionObserver.
            const _renderCardBody = () => {
                const bodyEl = card.querySelector('.card-body');
                if (bodyEl) bodyEl.innerHTML = Semaforo._buildBodyHTML({
                    observacoes:  cardData.observacoes  || card.dataset.observacoes  || '',
                    status:       cardData.status       || card.dataset.status       || '',
                    inicio:       cardData.inicio       || card.dataset.inicio       || '',
                    equipe:       cardData.equipe       || card.dataset.equipe       || '',
                    viatura:      cardData.viatura      || card.dataset.viatura      || '',
                    endereco:     cardData.endereco     || card.dataset.endereco     || '',
                    sub:          cardData.sub          || card.dataset.sub          || '',
                    tsDespacho:   cardData.tsDespacho   || card.dataset.tsDespacho   || '',
                    equipeApoio:  cardData.equipeApoio  || card.dataset.equipeApoio  || '',
                    viaturaApoio: cardData.viaturaApoio || card.dataset.viaturaApoio || '',
                    data_fim:     cardData.data_fim     || card.dataset.data_fim     || '',
                    hora_fim:     cardData.hora_fim     || card.dataset.hora_fim     || '',
                    fim:          cardData.fim          || card.dataset.fim
                                    // Deriva fim combinado de data_fim+hora_fim quando necessário
                                    || (cardData.data_fim ? `${cardData.data_fim}${cardData.hora_fim ? ' ' + cardData.hora_fim : ''}` : '')
                                    || '',
                    // coluna lida do dataset em tempo de render (pode ter mudado desde cardData)
                    coluna:       card.dataset.coluna   || cardData.coluna           || '',
                    // Agendamento de rendição
                    agendamentohora:   cardData.agendamento?.horaAgendada || card.dataset.agendamentohora   || '',
                    agendamentoequipe: cardData.agendamento?.equipe        || card.dataset.agendamentoequipe || '',
                    agendamentosub:    cardData.agendamento?.sub           || card.dataset.agendamentosub    || '',
                    agendamentovt:     cardData.agendamento?.vt            || card.dataset.agendamentovt     || '',
                });
            };

            // Renderiza imediatamente se NitLazy não estiver disponível,
            // ou registra para render quando o card entrar no viewport.
            // Para cards já no viewport no momento da inserção, o IntersectionObserver
            // pode não disparar — por isso forçamos render via requestAnimationFrame.
            if (typeof NitLazy !== 'undefined' && NitLazy.observar) {
                NitLazy.observar(card, _renderCardBody);
                // Força render no próximo frame caso o card já esteja visível
                requestAnimationFrame(() => {
                    if (card.classList.contains('lazy-pending')) {
                        _renderCardBody();
                    }
                });
            } else {
                _renderCardBody();
            }
            return card;
        },

        _fraseTecnica(texto, status, inicio) {
            // Estado INVESTIGANDO — frase padrão com data/hora
            if (String(status).trim().toUpperCase() === 'INVESTIGANDO') {
                if (!inicio) return 'Investigando.';
                const [data, hora] = inicio.split(' ');
                const [dia, mes]   = data.split('/');
                return `Início: ${dia}/${mes} ${hora} — Investigando.`;
            }
            if (!texto) return '';

            // Limpeza base: remove cabeçalhos de seção que podem vazar do parser
            let t = texto
                .replace(/NORMALIZADOS\s*✅/gi, '')
                .replace(/PENDENTES\s*❌/gi,    '')
                .replace(/\*/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (!t) return '';

            // Estado investigando no texto da observação
            if (t.toLowerCase() === 'investigando') return 'Investigando.';

            // Cortar no primeiro ponto final
            const pontoIndex = t.indexOf('.');
            if (pontoIndex !== -1) {
                t = t.substring(0, pontoIndex + 1).trim();
            } else {
                t = t.slice(0, 100);
                if (texto.length > 100) t += '…';
            }

            // Compactar datas longas: 13/06/2026 07:41 → 13/06 07:41
            t = t.replace(/(\d{2}\/\d{2})\/\d{4}(\s+\d{2}:\d{2})/g, '$1$2');

            return t;
        },

        // ── Construção do HTML do body do card (método compartilhado) ───
        // Usado por _renderCardBody e child_changed — fonte única de verdade.
        _buildBodyHTML(d) {
            // Sanitizador — trata undefined, null, "null", "undefined" como vazio
            const _sv = v => (v && v !== 'null' && v !== 'undefined') ? String(v).trim() : '';
            const obs          = _sv(d.observacoes);
            const status       = _sv(d.status);
            const inicio       = _sv(d.inicio);
            const equipe       = _sv(d.equipe);
            const viatura      = _sv(d.viatura);
            const endereco     = _sv(d.endereco);
            const tipo         = (d.sub && d.sub !== 'null') ? d.sub : '';
            const tsDespacho   = (d.tsDespacho  && d.tsDespacho !== 'null') ? d.tsDespacho : '';
            const equipeApoio  = d.equipeApoio  || '';
            const viaturaApoio = d.viaturaApoio || '';
            const fimCombinado = _sv(d.fim);
            const dataFim      = _sv(d.data_fim);
            const horaFim      = _sv(d.hora_fim);
            const fimExib      = fimCombinado
                || (dataFim ? `${dataFim}${horaFim ? ' ' + horaFim : ''}` : '');
            const coluna       = d.coluna || '';
            const isNorm       = coluna === 'coluna-normalizados' || status === 'NORMALIZADO';
            const agendHora    = _sv(d.agendamentohora);
            const agendEquipe  = _sv(d.agendamentoequipe);
            const agendSub     = _sv(d.agendamentosub);
            const agendVt      = _sv(d.agendamentovt);

            // ── Observação ────────────────────────────────────────────────
            // Normalizados: não usar _fraseTecnica (corta no 1º ponto = texto da fase pendente)
            // Exibir o final da obs onde fica a descrição da resolução
            const causaTipo = _sv(d.tipo).toUpperCase();
            const frase = isNorm ? '' : Semaforo._fraseTecnica(obs, status, inicio);
            const obsFallback = obs
                .replace(/NORMALIZADOS\s*✅/gi, '')
                .replace(/PENDENTES\s*❌/gi, '')
                .replace(/\*/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            let obsExibir;
            // INVESTIGANDO sem despacho: exibir label claro independente de obs
            if (!isNorm && !tipo && causaTipo === 'INVESTIGANDO') {
                const partes = (inicio || '').split(' ');
                const dataH  = partes[0] ? partes[0].slice(0,5) : '';
                const hora   = partes[1] || '';
                obsExibir = dataH && hora ? `${dataH} ${hora} — Investigando.` : 'Investigando.';
            } else if (frase) {
                obsExibir = frase;
            } else if (isNorm && obsFallback.length > 120) {
                // Exibe os últimos 110 chars com reticências no início
                obsExibir = '…' + obsFallback.slice(-110).trimStart();
            } else {
                obsExibir = obsFallback.length > 120 ? obsFallback.slice(0, 120) + '…' : obsFallback;
            }

            // ── Bloco de despacho ─────────────────────────────────────────
            let despachoBlock = '';
            if (tipo) {
                const tipoLabel = { vl: 'VIA LIVRE', amc: 'AMC', sn: 'SEM NECESSIDADE' }[tipo] || tipo.toUpperCase();
                const emoji     = { vl: '🟠', amc: '🔵', sn: '⚪' }[tipo] || '🚦';

                // Equipe primária
                const equipeP  = equipeApoio ? (equipe.split(/\s*\+\s*/)[0]  || equipe).trim()  : equipe;
                const viaturaP = viaturaApoio ? (viatura.split(/\s*\+\s*/)[0] || viatura).trim() : viatura;

                // Linha única: "🔵 AMC · Raimundo · VT 222"
                const partes = [equipeP, viaturaP ? `VT ${viaturaP}` : ''].filter(Boolean);
                const linhaP = partes.length ? ` · ${partes.join(' · ')}` : '';
                const linhaA = equipeApoio
                    ? ` + ${equipeApoio}${viaturaApoio ? ` · VT ${viaturaApoio}` : ''}`
                    : '';

                const tsStr = Semaforo._formatarTimestamp(tsDespacho);
                const tsHTML = tsStr ? `<p class="card-ts-despacho">${tsStr}</p>` : '';

                despachoBlock = `<p class="card-despacho-tipo">${emoji} ${tipoLabel}${linhaP}${linhaA}</p>${tsHTML}`;
            }

            // ── Badge de rendição agendada ────────────────────────────────
            let agendBlock = '';
            if (agendHora && !isNorm) {
                const subLabel   = { vl: 'VL', amc: 'AMC' }[agendSub] || agendSub.toUpperCase();
                const equipeStr  = agendEquipe ? ` · ${agendEquipe}` : '';
                const vtStr      = agendVt ? ` · VT ${agendVt}` : '';
                agendBlock = `<p class="card-agendamento">⏰ Rendição ${subLabel} ${agendHora}${equipeStr}${vtStr}</p>`;
            }

            // ── ⏳ Início: pendentes sem despacho ─────────────────────────
            const inicioExib = (!isNorm && !tipo && inicio)
                ? `<p class="card-inicio">⏳ ${inicio.replace(/(\d{2})\/(\d{2})\/\d{4}/, '$1/$2')}</p>`
                : '';

            // Normalizado sem fim gravado → mostra início como referência (opaco)
            const inicioRef = (isNorm && !fimExib && inicio)
                ? `<p class="card-inicio" style="opacity:0.5">⏳ ${inicio.replace(/(\d{2})\/(\d{2})\/\d{4}/, '$1/$2')}</p>`
                : '';

            // ── Hierarquia do body ────────────────────────────────────────
            return `<p class="card-address">${endereco}</p>`
                + inicioExib
                + inicioRef
                + despachoBlock
                + agendBlock
                + (obsExibir ? `<p class="card-obs">${obsExibir}</p>` : '')
                + (fimExib   ? `<p class="card-fim">✅ ${fimExib}</p>` : '');
        },

        _formatarTimestamp(ts) {
            if (!ts || ts === 'null') return '';
            const n = Number(ts);
            if (!n || isNaN(n)) return '';
            const d = new Date(n);
            if (isNaN(d.getTime())) return '';
            return '⏱ ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        },

        // ── Ordenar coluna normalizados (mais recente no topo) ────────────
        // Converte "DD/MM/YYYY HH:MM" → timestamp para ordenação correta.
        // localeCompare sozinho NÃO funciona com esse formato de data.
        _parseFim(str) {
            if (!str) return 0;
            // Aceita "DD/MM/YYYY HH:MM" ou "DD/MM/YYYY" ou "HH:MM"
            const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (!m) return 0;
            return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
        },

        ordenarNormalizados() {
            const container = DOM.colunaNormalizados;
            if (!container) return;
            const cards = Array.from(container.querySelectorAll('.kanban-card'));
            if (cards.length < 2) return;
            cards.sort((a, b) => {
                // Lê data_fim + hora_fim separados (vindos do Firebase via dataset)
                // ou o campo combinado 'fim' (gravado pelo NitNormalizar.confirmar)
                const fimA = a.dataset.fim
                    || ((a.dataset.data_fim || '') + ' ' + (a.dataset.hora_fim || '')).trim();
                const fimB = b.dataset.fim
                    || ((b.dataset.data_fim || '') + ' ' + (b.dataset.hora_fim || '')).trim();
                return this._parseFim(fimB) - this._parseFim(fimA); // mais recente primeiro
            });
            // Reinserir na ordem correta — fragment evita reflow múltiplo
            const frag = document.createDocumentFragment();
            cards.forEach(c => frag.appendChild(c));
            container.appendChild(frag);
        },
        
        
        // ── Painel e relatório ────────────────────────────────────────────
        _painelTimer: null,
        atualizarPainel() {
            clearTimeout(this._painelTimer);
            this._painelTimer = setTimeout(() => this._atualizarPainelAgora(), 80);
        },

        _atualizarPainelAgora() {
            const hoje = NitData.hoje();

            // B3 — filtro visual: oculta cards de dias anteriores
            document.querySelectorAll('#tab-semaforo .kanban-card').forEach(c => {
                c.style.display = c.dataset.datareferencia === hoje ? '' : 'none';
            });

            // Reordena normalizados a cada atualização de painel
            this.ordenarNormalizados();

            // B2 — contadores filtrados por data atual
            const n = sel =>
                Array.from(document.querySelectorAll(sel))
                     .filter(c => c.dataset.datareferencia === hoje).length;

            const total = {
                espera:         n('#coluna-espera .kanban-card'),
                semNecessidade: n('#coluna-sem-necessidade .kanban-card'),
                vl:             n('#coluna-vl .kanban-card'),
                amc:            n('#coluna-amc .kanban-card'),
                normalizados:   Array.from(DOM.colunaNormalizados.querySelectorAll('.kanban-card'))
                                    .filter(c => c.dataset.datareferencia === hoje).length,
            };
            const totalGeral = Object.values(total).reduce((a, b) => a + b, 0);
            const totalNorm  = total.normalizados;
            const totalPend  = totalGeral - totalNorm;

            DOM.displayTotal.textContent        = totalGeral;
            DOM.displayNormalizados.textContent = totalNorm;
            DOM.displayPendentes.textContent    = totalPend;
            DOM.countNormalizados.textContent   = totalNorm;

            document.getElementById('count-espera') && (document.getElementById('count-espera').textContent = total.espera);
            [['vl', total.vl], ['amc', total.amc], ['sem-necessidade', total.semNecessidade]].forEach(([id, v]) => {
                const el = document.getElementById(`count-${id}`);
                if (el) el.textContent = v;
            });

            this.gerarPreviewRelatorio();
        },

        gerarPreviewRelatorio() {
            const incluirNorm = DOM.checkIncluirNormalizados?.checked;
            const filtroData  = NitData.hoje();

            // Filtra por data de referência do plantão atual — evita acumulado de plantões anteriores
            const cards = id => {
                const todos = Array.from(document.querySelectorAll(`#${id} .kanban-card`));
                return todos.filter(c => c.dataset.datareferencia === filtroData);
            };

            const espera = cards('coluna-espera');
            const sn     = cards('coluna-sem-necessidade');
            const vl     = cards('coluna-vl');
            const amc    = cards('coluna-amc');
            const norm   = (() => {
                const todos = Array.from(DOM.colunaNormalizados.querySelectorAll('.kanban-card'));
                return todos.filter(c => c.dataset.datareferencia === filtroData);
            })();

            const totalOcorr  = espera.length + sn.length + vl.length + amc.length + norm.length;
            const totalPend   = espera.length + sn.length + vl.length + amc.length; // VL e AMC são pendentes em atendimento
            const totalNorm   = norm.length;
            const totalAtivos = vl.length + amc.length + espera.length + sn.length;

            let emoji, emojiPendentes;
            if (totalAtivos === 0) {
                emoji = '🟢🟢';
                emojiPendentes = '✅';
            } else if (totalAtivos >= 1 && totalAtivos <= 5) {
                emoji = '🟡🟡';
                emojiPendentes = '⚠️';
            } else {
                emoji = '🔴🔴';
                emojiPendentes = '🚨';
            }
            const hora  = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const data  = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            const fmt = card => {
                const tipo = (card.dataset.tipo || '').toUpperCase();
    
                // Mapeamento — apenas tipos longos são abreviados
                const mapa = {
                    'FALHA DE EQUIPAMENTO': 'FALHA',
                    'INVESTIGANDO': 'INVESTIGANDO',
                    'ROMPIMENTO': 'ROMPIMENTO',
                    'ACIDENTE': 'ACIDENTE',
                    'IMPROCEDENTE': 'IMPROCEDENTE',  // ← COMPLETO
                    'FURTO': 'FURTO',
                    'ENEL': 'ENEL',
                };
                const abrev = mapa[tipo] || tipo;
    
                let desde = '';
                const mts = (card.dataset.inicio || '').match(/(\d{2})\/(\d{2})(?:\/\d+)?\s+(\d{2}:\d{2})/);
                if (mts) desde = ` - Desde ${mts[1]}/${mts[2]} - ${mts[3]}`;
                let t = `${card.dataset.codigo} 🚦 ${card.dataset.endereco} ● *${abrev}${desde} • ${card.dataset.problema}*`;
                if (card.dataset.viatura) {
                    const via   = card.dataset.viatura;
                    const apoio = card.dataset.viaturaApoio || '';
                    if (via.includes('+')) {
                        // Já concatenado em handleSalvarDespachoClick — normaliza "145 + 214" → "VTs: 145, 214"
                        t += ` (VTs: ${via.replace(/\s*\+\s*/g, ', ')})`;
                    } else if (apoio && apoio !== via) {
                        t += ` (VTs: ${via}, ${apoio})`;
                    } else {
                        t += ` (VT: ${via})`;
                    }
                }
                return t;
            };

            const linhas = [
                `${emoji} *STATUS SEMAFÓRICO* ${emoji}`,
                `--------- ${data} - ${hora} ---------`,
                '',
                `*Ocorrências (${totalOcorr})*`,
                `*Pendentes (${totalPend})* ${emojiPendentes}`,  // ← USANDO emojiPendentes
                `*Normalizados (${totalNorm})*`,
                '',
            ];
            if (totalAtivos > 0) {
                if (vl.length)  { linhas.push(`🚔🟠 *VIA LIVRE (${vl.length}):*`);  vl.forEach(c => linhas.push(fmt(c)));  linhas.push(''); }
                if (amc.length) { linhas.push(`🚔🔵 *AMC (${amc.length}):*`); amc.forEach(c => linhas.push(fmt(c))); linhas.push(''); }

                linhas.push('---');
                linhas.push('');
                linhas.push(`⏳ *PENDENTES / OUTROS MOTIVOS*`);
                linhas.push('');
                linhas.push(`*- Aguardando atendimento:*`);
                linhas.push('');
                espera.forEach(c => linhas.push(fmt(c)));

                if (sn.length) {
                    linhas.push('');
                    linhas.push(`*- Sem necessidade de operação:*`);
                    linhas.push('');
                    sn.forEach(c => linhas.push(fmt(c)));
                }
            }

            if (incluirNorm && norm.length) {
                linhas.push('');
                linhas.push(`✅ *NORMALIZADOS (${norm.length}):*`);
                linhas.push('');
                norm.forEach(c => linhas.push(fmt(c)));
            }

            const texto = linhas.join('\n');
            if (DOM.relatorioFinalPreview) DOM.relatorioFinalPreview.value = texto;
            return texto;
        },

        // ── Ações de card ─────────────────────────────────────────────────
        handleKanbanBoardClick(e) {
            const card = e.target.closest('.kanban-card');
            if (!card) return;
            if      (e.target.closest('.btn-card-action.complete'))      this.handleNormalizarClick(card);
            else if (e.target.closest('.btn-card-action.copy-location')) this.copiarLocalizacao(card);
            else if (e.target.closest('.btn-card-action.details'))       NitCentral.abrir(card);
            else if (!e.target.closest('.btn-card-action') && !AppState._wasDrag) NitCentral.abrir(card);
        },

        copiarLocalizacao(card) {
            const txt = `*${card.dataset.codigo} ${card.dataset.endereco} - ${card.dataset.problema}*`;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(txt)
                    .then(() => showToast('Localização copiada!', 'success'))
                    .catch(() => this._clipboardFallback(txt));
            } else {
                this._clipboardFallback(txt);
            }
        },

        _clipboardFallback(texto) {
            const ta = Object.assign(document.createElement('textarea'), {
                value: texto, style: 'position:fixed;opacity:0;',
            });
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(ok ? 'Localização copiada!' : 'Não foi possível copiar.', ok ? 'success' : 'error');
        },

        // ── Despacho ──────────────────────────────────────────────────────
        abrirModalDespacho(cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;
             // ✅ Mostrar/ocultar botão Encerrar Operação
            const tipoAtual = card.dataset.sub || '';
            const btnEncerrar = document.getElementById('btn-encerrar-operacao');
            if (btnEncerrar) {
                btnEncerrar.style.display = tipoAtual ? 'flex' : 'none';
            }
            DOM.despachoSemaforoCardId.value = cardId;
            DOM.despachoSemaforoEquipe.value = card.dataset.equipe  || '';
            DOM.despachoSemaforoVt.value     = card.dataset.viatura || '';
            
            // Resetar campos de apoio
            const chkApoio    = document.getElementById('despacho-tem-apoio');
            const camposApoio = document.getElementById('grupo-apoio-campos');
            const apoioEquipe = document.getElementById('despacho-apoio-equipe');
            const apoioVt     = document.getElementById('despacho-apoio-vt');
            if (chkApoio)    chkApoio.checked    = false;
            if (camposApoio) camposApoio.style.display = 'none';
            if (apoioEquipe) apoioEquipe.value   = '';
            if (apoioVt)     apoioVt.value        = '';
            document.getElementById('despacho-preview')?.classList.remove('show');
            const btnConf = document.getElementById('btn-despacho-semaforo-confirmar');
            if (btnConf) btnConf.innerHTML = 'Confirmar Despacho';
            AppState.despachoTipo = card.dataset.sub || 'vl';
            this.selecionarTipoDespacho(AppState.despachoTipo);
            abrirModal(DOM.modalDespachoSemaforo);
        },

        selecionarTipoDespacho(tipo) {
            AppState.despachoTipo = tipo;
            const btnVl  = document.getElementById('despacho-tipo-vl');
            const btnAmc = document.getElementById('despacho-tipo-amc');
            if (btnVl)  btnVl.style.background  = tipo === 'vl'  ? 'rgba(240,136,62,0.15)'  : '';
            if (btnAmc) btnAmc.style.background = tipo === 'amc' ? 'rgba(88,166,255,0.15)' : '';
            if (btnVl)  btnVl.style.borderColor  = tipo === 'vl'  ? '#f0883e' : '';
            if (btnAmc) btnAmc.style.borderColor = tipo === 'amc' ? '#58a6ff' : '';
        },

        handleSalvarDespachoClick() {
            const cardId  = DOM.despachoSemaforoCardId.value;
            const card    = document.getElementById(cardId);
            if (!card) return;
            const equipe  = DOM.despachoSemaforoEquipe.value.trim();
            const vt      = DOM.despachoSemaforoVt.value.trim();
            const tipo    = AppState.despachoTipo;
            // Ler equipe de apoio
            const apoioEquipe = document.getElementById('despacho-apoio-equipe')?.value.trim() || '';
            const apoioVt     = document.getElementById('despacho-apoio-vt')?.value.trim()     || '';
            const temApoio    = document.getElementById('despacho-tem-apoio')?.checked && apoioEquipe;

            const preview = document.getElementById('despacho-preview');
            const btnConf = document.getElementById('btn-despacho-semaforo-confirmar');
            if (preview && !preview.classList.contains('show')) {
                // Montar linhas do preview
                const linha1 = [equipe, vt ? `VT ${vt}` : ''].filter(Boolean).join(' · ');
                const linha2 = temApoio ? [apoioEquipe, apoioVt ? `VT ${apoioVt}` : ''].filter(Boolean).join(' · ') : '';
                preview.innerHTML = `
                    <div class="despacho-preview-title">Confirmar despacho</div>
                    <div><strong>${card.dataset.codigo}</strong> → ${tipo.toUpperCase()}${linha1 ? ` · ${linha1}` : ''}</div>
                    ${linha2 ? `<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:4px;">Apoio: ${linha2}</div>` : ''}`;
                preview.classList.add('show');
                if (btnConf) btnConf.innerHTML = 'Confirmar';
                return;
            }

            // Coluna: dropdown tem prioridade; fallback = coluna do tipo da operação principal
            const colunaDropdown = document.getElementById('despacho-mover-coluna')?.value || '';
            const colunaDestino  = colunaDropdown || (tipo === 'sn' ? 'coluna-sem-necessidade' : `coluna-${tipo}`);
            const container      = document.querySelector(`#${colunaDestino} .kanban-cards-container`) || document.getElementById(colunaDestino);
            if (container) container.appendChild(card);
            card.dataset.coluna = colunaDestino;

            // Montar strings consolidadas para dataset e Firebase
            const equipeConcat  = [equipe, temApoio ? apoioEquipe : ''].filter(Boolean).join(' + ');
            const viaturaConcat = [vt,     temApoio ? apoioVt     : ''].filter(Boolean).join(' + ');

            card.dataset.equipe  = equipeConcat;
            card.dataset.viatura = viaturaConcat;
            card.dataset.pl      = tipo === 'sn' ? 'sn' : 'atend';
            card.dataset.sub     = tipo;

            // Montar HTML do card com linhas separadas por equipe
            const linhaP = equipe
                ? `<span class="card-equipe-linha">${equipe}${vt ? ` · VT ${vt}` : ''}</span>`
                : '';
            const linhaA = temApoio
                ? `<span class="card-equipe-linha card-equipe-apoio">Apoio: ${apoioEquipe}${apoioVt ? ` · VT ${apoioVt}` : ''}</span>`
                : '';
            const equipeHTML = (linhaP || linhaA)
                ? `<p class="card-equipe">${linhaP}${linhaA}</p>`
                : '';

            const cardFooterEquipe = card.querySelector('.card-equipe');
            if (cardFooterEquipe) cardFooterEquipe.outerHTML = equipeHTML || '<p class="card-equipe"></p>';
            else if (equipeHTML) card.querySelector('.card-body')?.insertAdjacentHTML('beforeend', equipeHTML);

            fecharModal(DOM.modalDespachoSemaforo);
            this._commitDespacho(card, equipe, vt, tipo, apoioEquipe, apoioVt);
        },

        handleEncerrarOperacao() {
    const cardId = DOM.despachoSemaforoCardId.value;
    const card = document.getElementById(cardId);
    if (!card) return;

    const codigo = card.dataset.codigo;
    const equipeAtual = card.dataset.equipe || 'equipe';
    const tipoAtual = card.dataset.sub || '';

    const tipoLabel = tipoAtual === 'vl' ? 'Via Livre' :
                      tipoAtual === 'amc' ? 'AMC' :
                      tipoAtual === 'sn' ? 'Sem Necessidade' : tipoAtual;

    nitConfirm(
        '⏹️ Encerrar Operação',
        `Deseja encerrar a operação do card <strong>${codigo}</strong>?<br><br>
         <strong>${tipoLabel}</strong> · Equipe: <strong>${equipeAtual}</strong><br><br>
         A equipe será liberada e o card voltará para <strong>Aguardando</strong>.`,
        () => {
            // 1. Mover card para Aguardando
            const containerEspera = document.querySelector('#coluna-espera .kanban-cards-container');
            if (containerEspera) {
                containerEspera.appendChild(card);
            }
            card.dataset.coluna = 'coluna-espera';

            // 2. Limpar dados de despacho (liberar equipes)
            delete card.dataset.equipe;
            delete card.dataset.viatura;
            delete card.dataset.pl;
            delete card.dataset.sub;
            delete card.dataset.tsDespacho;
            delete card.dataset.equipeApoio;
            delete card.dataset.viaturaApoio;

            // 3. Remover elementos visuais de despacho do card
            const despachoEls = card.querySelectorAll('.card-despacho-tipo, .card-equipe, .card-ts-despacho');
            despachoEls.forEach(el => el.remove());

            // 4. Atualizar Firebase
            const eventoId = card.dataset.eventoid || card.dataset.codigo;
            NitFirebase.exec((db, ref, update) =>
                update(ref(db, `kanban/${eventoId}`), {
                    coluna: 'coluna-espera',
                    pl: null,
                    sub: null,
                    equipe: '',
                    viatura: '',
                    equipeApoio: '',
                    viaturaApoio: '',
                    tsDespacho: null,
                    ts_encerramento: Date.now(),
                    operador: NitLogin.operador || 'anon',
                    turno: NitLogin.turno || '',
                })
            );

            // 5. Registrar histórico
            gravarHistoricoFirebase(
                eventoId,
                card.dataset.coluna || 'desconhecido',
                'coluna-espera',
                'ENCERRADO',
                '',
                '',
                NitLogin.operador
            );

            registrarAcao(`Operação encerrada: '${codigo}'. Equipe ${equipeAtual} liberada.`);

            // 6. Fechar modal e notificar
            fecharModal(DOM.modalDespachoSemaforo);
            showToast(`${codigo} — Operação encerrada. Equipe liberada.`, 'info');
            Semaforo.atualizarPainel();
        }
    );
},

        _commitDespacho(card, equipe, vt, tipo, equipeApoio, vtApoio) {
    const cod      = card.dataset.codigo;
    const eventoId = card.dataset.eventoid || cod;
    // Coluna já foi definida por handleSalvarDespachoClick antes de chamar _commitDespacho
    const coluna   = card.dataset.coluna || (tipo === 'sn' ? 'coluna-sem-necessidade' : `coluna-${tipo}`);
    
    // Dados concatenados para compatibilidade com código existente
    const equipeConcat  = [equipe, equipeApoio].filter(Boolean).join(' + ');
    const viaturaConcat = [vt, vtApoio].filter(Boolean).join(' + ');
    
    NitFirebase.exec((db, ref, update) =>
        update(ref(db, `kanban/${eventoId}`), {
            coluna,
            pl: tipo === 'sn' ? 'sn' : 'atend',
            sub: tipo,
            equipe: equipeConcat,
            viatura: viaturaConcat,
            equipeApoio: equipeApoio || '',
            viaturaApoio: vtApoio || '',
            tsDespacho: Date.now(),
            operador: NitLogin.operador || 'anon',
            turno: NitLogin.turno || '',
            ts: Date.now(),
        })
    );
    gravarHistoricoFirebase(eventoId, card.dataset.coluna, coluna, tipo, equipeConcat, viaturaConcat, NitLogin.operador);
    registrarAcao(`Despacho '${cod}': ${equipeConcat} VT ${viaturaConcat || 'N/I'} → ${tipo.toUpperCase()}.`);
    showToast(`${cod} → ${tipo === 'sn' ? 'Sem necess.' : equipe || 'despachado'}`, 'success');
    nitAPIFetch('/api/v1/despacho', { method: 'POST', body: JSON.stringify({ cod, eventoId, eq: equipeConcat, vt: viaturaConcat, sub: tipo }) })
        .catch(err => { if (!err.message?.includes('fetch')) console.warn('[NIT] API despacho:', err); });
},


        
        // ── Normalizar ────────────────────────────────────────────────────
        handleNormalizarClick(card) {
            NitNormalizar.abrir(card);
        },

        // ── Edição ────────────────────────────────────────────────────────
        abrirModalEdicao(cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;
            DOM.edicaoCardId.value   = cardId;
            DOM.edicaoCodigo.value   = card.dataset.codigo   || '';
            DOM.edicaoEndereco.value = card.dataset.endereco || '';
            DOM.edicaoProblema.value = card.dataset.problema || 'APAGADO';
            abrirModal(DOM.modalEdicao);
        },

        handleSalvarEdicaoClick() {
            const card = document.getElementById(DOM.edicaoCardId.value);
            if (!card) return;
            const novoEnd  = DOM.edicaoEndereco.value.trim();
            const novoProb = DOM.edicaoProblema.value;
            if (!novoEnd) { showToast('Endereço não pode ser vazio.', 'error'); return; }
            if (novoEnd === card.dataset.endereco && novoProb === card.dataset.problema) {
                fecharModal(DOM.modalEdicao); showToast('Nenhuma alteração.', 'info'); return;
            }
            const eventoId = card.dataset.eventoid || card.dataset.codigo;
            const old      = `End: ${card.dataset.endereco}, Prob: ${card.dataset.problema}`;
            NitFirebase.exec((db, ref, update) =>
                update(ref(db, `kanban/${eventoId}`), {
                    endereco: novoEnd, problema: novoProb,
                    operador: NitLogin.operador || 'anon', turno: NitLogin.turno || '', ts: Date.now(),
                })
            );
            fecharModal(DOM.modalEdicao);
            registrarAcao(`'${card.dataset.codigo}' editado. Antes: ${old}.`);
            showToast('Sincronizando alterações…', 'info');
        },

        // ── Drag & drop ───────────────────────────────────────────────────
        handleDragStart(e) {
            AppState.draggedCard = e.target.closest('.kanban-card');
            if (!AppState.draggedCard) return;
            // Safari exige setData para reconhecer o drag; Chrome/Firefox são permissivos
            e.dataTransfer.setData('text/plain', AppState.draggedCard.id);
            e.dataTransfer.effectAllowed = 'move';
            AppState._wasDrag = true;
            AppState.placeholder = document.createElement('div');
            AppState.placeholder.className = 'kanban-card drag-placeholder';
            AppState.placeholder.style.height = `${AppState.draggedCard.offsetHeight}px`;
            AppState.draggedCard.classList.add('dragging');
        },

        handleDragEnd() {
            AppState.draggedCard?.classList.remove('dragging');
            AppState.placeholder?.remove();
            AppState.draggedCard = null;
            AppState.placeholder = null;
            // Limpa flag com pequeno delay para que o evento click seja absorvido
            setTimeout(() => { AppState._wasDrag = false; }, 50);
        },

        handleDragOver(e) {
            e.preventDefault();
            const container = e.target.closest('.kanban-cards-container');
            if (!container || !AppState.placeholder) return;
            container.classList.add('drag-over');
            const afterEl = this._afterElement(container, e.clientY);
            afterEl ? container.insertBefore(AppState.placeholder, afterEl) : container.appendChild(AppState.placeholder);
        },

        handleDragLeave(e) {
            e.target.closest('.kanban-cards-container')?.classList.remove('drag-over');
        },

        _afterElement(container, y) {
            const cards = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
            return cards.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const off = y - box.top - box.height / 2;
                return (off < 0 && off > (closest.offset ?? -Infinity)) ? { offset: off, element: child } : closest;
            }, {}).element;
        },

                handleDrop(e) {
            e.preventDefault();

            const container = e.target.closest('.kanban-cards-container');
            if (!container || !AppState.draggedCard) return;

            AppState.placeholder?.remove();
            document.querySelectorAll('.kanban-cards-container.drag-over')
                .forEach(c => c.classList.remove('drag-over'));

            const card     = AppState.draggedCard;
            const coluna   = container.closest('.kanban-column')?.id || 'desconhecido';
            const eventoId = card.dataset.eventoid || card.dataset.codigo;
            const origem   = card.dataset.coluna || 'desconhecido';

            // VIA LIVRE / AMC:
            // o arraste passa a registrar também a trajetória operacional (Coluna N).
            const tipoDestino = {
                'coluna-vl':  'vl',
                'coluna-amc': 'amc',
            }[coluna] || null;

            if (tipoDestino) {
                const tsNow = Date.now();

                firebase.database()
                    .ref(`kanban/${eventoId}/historico`)
                    .get()
                    .then(snap => {
                        const hist = snap.exists() ? snap.val() : {};

                        // Primeiro movimento operacional = despacho.
                        // Mudança posterior entre VL/AMC = rendição.
                        const temTrajetoria = Object.values(hist).some(ev =>
                            ['despacho', 'apoio', 'rendição'].includes(ev?.tipo) &&
                            ['vl', 'amc'].includes(ev?.sub)
                        );

                        const tipoEvento = temTrajetoria ? 'rendição' : 'despacho';

                        const colunaN = NitCentral._derivarColunaN(hist, {
                            tipo: tipoEvento,
                            sub: tipoDestino,
                            ts: tsNow + 1,
                        });

                        NitFirebase.exec((db, ref, update) => {
                            const pushKey = ref(
                                db,
                                `kanban/${eventoId}/historico`
                            ).push().key;

                            const updates = {};

                            updates[`kanban/${eventoId}/historico/${pushKey}`] = {
                                tipo: tipoEvento,
                                sub: tipoDestino,
                                equipe: '',
                                vt: '',
                                ts: tsNow,
                                operador: NitLogin.operador || 'anon',
                            };

                            updates[`kanban/${eventoId}/coluna`]   = coluna;
                            updates[`kanban/${eventoId}/sub`]      = tipoDestino;
                            updates[`kanban/${eventoId}/colunaN`]  = colunaN || '';
                            updates[`kanban/${eventoId}/operador`] = NitLogin.operador || 'anon';
                            updates[`kanban/${eventoId}/turno`]    = NitLogin.turno || '';
                            updates[`kanban/${eventoId}/ts`]       =
                                firebase.database.ServerValue.TIMESTAMP;

                            update(ref(db, '/'), updates);
                        });
                    })
                    .catch(err => {
                        console.error('[NIT] Falha ao registrar Coluna N pelo arraste:', err);

                        // Mantém o comportamento antigo caso a leitura do histórico falhe.
                        NitFirebase.exec((db, ref, update) =>
                            update(ref(db, `kanban/${eventoId}`), {
                                coluna,
                                operador: NitLogin.operador || 'anon',
                                turno: NitLogin.turno || '',
                                ts: firebase.database.ServerValue.TIMESTAMP,
                            })
                        );
                    });

            } else {
                // Demais colunas continuam com o comportamento original.
                NitFirebase.exec((db, ref, update) =>
                    update(ref(db, `kanban/${eventoId}`), {
                        coluna,
                        operador: NitLogin.operador || 'anon',
                        turno: NitLogin.turno || '',
                        ts: firebase.database.ServerValue.TIMESTAMP,
                    })
                );
            }

            gravarHistoricoFirebase(
                eventoId,
                origem,
                coluna,
                null,
                null,
                null,
                NitLogin.operador
            );

            registrarAcao(
                `'${card.dataset.codigo}' movido: ${origem} → ${coluna}.`
            );
        },
        // ── Limpar painel ─────────────────────────────────────────────────
        limparPainel() {
            nitConfirm('🗑️ Limpar Painel', '⚠️ Remove <strong>TODOS os dados</strong> para todos os operadores conectados.', () => {
                document.querySelectorAll('#tab-semaforo .kanban-cards-container').forEach(c => c.innerHTML = '');
                if (DOM.relatorioFinalPreview) DOM.relatorioFinalPreview.value = '';
                AppState.cardIdCounter = AppState.totalOcorrenciasCriadas = 0;
                localStorage.removeItem(AppState.STORAGE_KEY_SEMAFORO);
                NitFirebase.exec((db, ref, update) => {
                    ref(db, 'kanban').remove();
                    update(ref(db, 'meta'), {
                        ultimoReset: { ts: Date.now(), operador: NitLogin.operador || 'anon', turno: NitLogin.turno || '' },
                        dataReferencia: null,
                    });
                });
                this.atualizarPainel();
                showToast('Painel limpo para todos os operadores!', 'success');
                registrarAcao('Painel limpo.');
            });
        },

    // ── Init ──────────────────────────────────────────────────────────
    inicializar: function() {
        DOM.btnProcessar.addEventListener('click', this.handleProcessarClick.bind(this));
        DOM.btnEdicaoSalvar.addEventListener('click', this.handleSalvarEdicaoClick.bind(this));
        DOM.btnDespachoSemaforoConfirmar.addEventListener('click', this.handleSalvarDespachoClick.bind(this));
        
        var btnEncerrar = document.getElementById('btn-encerrar-operacao');
        if (btnEncerrar) {
            btnEncerrar.addEventListener('click', this.handleEncerrarOperacao.bind(this));
        }
        
        DOM.btnVisualizarRelatorio.addEventListener('click', function() {
            DOM.modalRelatorioTexto.value = this.gerarPreviewRelatorio();
            abrirModal(DOM.modalRelatorio);
        }.bind(this));
        
        var checkIncluir = document.getElementById('check-incluir-normalizados');
        if (checkIncluir) {
            checkIncluir.addEventListener('change', function() {
                this.gerarPreviewRelatorio();
            }.bind(this));
        }

        var kanbanArea = document.querySelector('#tab-semaforo');
        kanbanArea.addEventListener('dragstart', this.handleDragStart.bind(this));
        kanbanArea.addEventListener('dragend', this.handleDragEnd.bind(this));
        kanbanArea.addEventListener('dragover', this.handleDragOver.bind(this));
        kanbanArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        kanbanArea.addEventListener('drop', this.handleDrop.bind(this));
        kanbanArea.addEventListener('click', this.handleKanbanBoardClick.bind(this));
        // listener Firebase iniciado em NitLogin._concluirLogin()
        // para garantir que auth esteja confirmada antes de ler o banco
    }
};  // ← FECHA O OBJETO SEMAFORO
    // ═════════════════════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═════════════════════════════════════════════════════════════════════════
    async function inicializarApp() {
    queryDOM();
    carregarDadosMestres();
    document.body.setAttribute('data-theme', 'dark');

    await NitFirebase._init();
    Semaforo.inicializar();
    switchTab('tab-semaforo');

    NitLogin.inicializar();
    // Firebase Auth restaura sessão automaticamente via onAuthStateChanged
    // NitLogin.tentarRestaurar() não é mais necessário

    setupModal(DOM.modalRelatorio, DOM.btnModalFechar);
    setupModal(DOM.modalEdicao, DOM.btnEdicaoCancelar);
    setupModal(DOM.modalDespachoSemaforo, DOM.btnDespachoSemaforoCancelar, function() {
        var preview = document.getElementById('despacho-preview');
        if (preview) preview.classList.remove('show');
        var b = document.getElementById('btn-despacho-semaforo-confirmar');
        if (b) b.innerHTML = 'Confirmar Despacho';
    });

    var tabButtons = DOM.tabButtons;
    for (var i = 0; i < tabButtons.length; i++) {
        (function(btn) {
            btn.addEventListener('click', function() {
                switchTab(btn.dataset.tab);
            });
        })(tabButtons[i]);
    }

    // Modal confirmação genérico
    var mc = document.getElementById('modal-confirmar-generico');
    var ok = document.getElementById('btn-confirmar-generico-ok');
    var can = document.getElementById('btn-confirmar-generico-cancel');
    if (ok) {
        ok.addEventListener('click', function() {
            fecharModal(mc);
            if (_confirmCb) { _confirmCb(); _confirmCb = null; }
            _cancelCb = null;
        });
    }
    if (can) {
        can.addEventListener('click', function() {
            fecharModal(mc);
            if (_cancelCb) { _cancelCb(); _cancelCb = null; }
            _confirmCb = null;
        });
    }
    if (mc) {
        mc.addEventListener('click', function(e) {
            if (e.target === mc) {
                fecharModal(mc);
                if (_cancelCb) { _cancelCb(); _cancelCb = null; }
                _confirmCb = null;
            }
        });
    }

    // Copiar relatório
    var btnCopiar = DOM.btnModalCopiar;
    if (btnCopiar) {
        btnCopiar.addEventListener('click', function() {
            var txt = DOM.modalRelatorioTexto ? DOM.modalRelatorioTexto.value : '';
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(txt)
                    .then(function() {
                        fecharModal(DOM.modalRelatorio);
                        showToast('Relatório copiado!', 'success');
                    })
                    .catch(function() {
                        Semaforo._clipboardFallback(txt);
                    });
            } else {
                Semaforo._clipboardFallback(txt);
                fecharModal(DOM.modalRelatorio);
            }
        });
    }

    // Histórico
    var btnH = document.getElementById('btn-ver-historico');
    var modH = document.getElementById('modal-historico');
    var bodH = document.getElementById('historico-body');
    if (btnH && modH) {
        btnH.addEventListener('click', function() {
            var logs = JSON.parse(localStorage.getItem('historicoDeAcoes_v1') || '[]');
            if (logs.length) {
                var html = '';
                for (var j = 0; j < logs.length; j++) {
                    html += '<div style="display:flex;padding:10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;margin-bottom:8px;">' +
                        '<span style="color:var(--color-text-tertiary);min-width:160px;flex-shrink:0;">' + logs[j].timestamp + '</span>' +
                        '<span style="margin-left:16px;">' + logs[j].mensagem + '</span>' +
                        '</div>';
                }
                bodH.innerHTML = html;
            } else {
                bodH.innerHTML = '<p>Nenhuma ação registrada.</p>';
            }
            abrirModal(modH);
        });
        setupModal(modH, document.getElementById('btn-historico-fechar'));
    }

    NitCardDetails.inicializar();
    NitCentral.inicializar();
    NitRecursos.inicializar();
    NitBuscaGlobal.inicializar();
    NitLogout.inicializar();
    NitLazy.inicializar();
    NitSidebar.inicializar();
    NitNormalizar.inicializar();
    NitNormalizados.inicializar();
    inicializarBuscasPorColuna();

    // Toggle campos de apoio no modal de despacho
    var temApoioCheck = document.getElementById('despacho-tem-apoio');
    if (temApoioCheck) {
        temApoioCheck.addEventListener('change', function() {
            var campos = document.getElementById('grupo-apoio-campos');
            if (campos) {
                campos.style.display = this.checked ? 'flex' : 'none';
            }
            if (!this.checked) {
                var apoioEquipe = document.getElementById('despacho-apoio-equipe');
                var apoioVt = document.getElementById('despacho-apoio-vt');
                if (apoioEquipe) apoioEquipe.value = '';
                if (apoioVt) apoioVt.value = '';
            }
        });
    }

    NitViradaDia.inicializar();
}

    function switchTab(tabId) {
        if (!document.getElementById(tabId)) return;
        var contents = DOM.tabContents;
        for (var i = 0; i < contents.length; i++) {
            contents[i].classList.remove('active');
        }
        var buttons = DOM.tabButtons;
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].classList.remove('active');
        }
        document.getElementById(tabId).classList.add('active');
        var activeBtn = document.querySelector('.tab-button[data-tab="' + tabId + '"]');
        if (activeBtn) activeBtn.classList.add('active');
    }
    // ═════════════════════════════════════════════════════════════════════════
    // NORMALIZAR — modal com data/hora fim obrigatórios + undo robusto
    // ═════════════════════════════════════════════════════════════════════════
    // ═════════════════════════════════════════════════════════════════════════
// NORMALIZAR — modal com data/hora fim obrigatórios + undo robusto
// ═════════════════════════════════════════════════════════════════════════
const NitNormalizar = {
    _cardAtual: null,
    _origemAtual: null,

    abrir(card) {
        this._cardAtual = card;
        this._origemAtual = card.closest('.kanban-column')?.id || 'desconhecido';

        var agora = new Date();
        var dataISO = agora.toISOString().slice(0, 10);
        var horaHM = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        var infoEl = document.getElementById('norm-card-info');
        if (infoEl) infoEl.textContent = card.dataset.codigo + ' — ' + card.dataset.endereco;

        var dataInput = document.getElementById('norm-data-fim');
        var horaInput = document.getElementById('norm-hora-fim');
        var obsInput = document.getElementById('norm-obs');
        var erroEl = document.getElementById('norm-erro');

        if (card.dataset.fim) {
            var parts = (card.dataset.fim).split(' ');
            if (parts[0]) {
                var d = parts[0].split('/');
                if (dataInput) dataInput.value = d[2] + '-' + d[1] + '-' + d[0];
            }
            if (parts[1] && horaInput) horaInput.value = parts[1].slice(0, 5);
        } else {
            if (dataInput) dataInput.value = dataISO;
            if (horaInput) horaInput.value = horaHM;
        }

        if (obsInput) obsInput.value = card.dataset.observacoes || '';
        if (erroEl) erroEl.style.display = 'none';

        document.getElementById('norm-card-id').value = card.id;
        abrirModal(document.getElementById('modal-normalizar'));

        setTimeout(function() {
            if (horaInput) horaInput.focus();
        }, 120);
    },

    confirmar() {
        var card = this._cardAtual;
        var origem = this._origemAtual;
        if (!card) return;

        var dataInput = document.getElementById('norm-data-fim');
        var horaInput = document.getElementById('norm-hora-fim');
        var obsInput = document.getElementById('norm-obs');
        var erroEl = document.getElementById('norm-erro');

        if (!dataInput || !dataInput.value || !horaInput || !horaInput.value) {
            if (erroEl) {
                erroEl.textContent = 'Data e hora de normalização são obrigatórios.';
                erroEl.style.display = 'block';
            }
            return;
        }

        var d = dataInput.value.split('-');
        var dataFimBR = d[2] + '/' + d[1] + '/' + d[0];
        var horaFimHM = horaInput.value.slice(0, 5);
        var obsNova = (obsInput && obsInput.value.trim()) || card.dataset.observacoes || '';
        var cod = card.dataset.codigo;
        var eventoId = card.dataset.eventoid || cod;

        fecharModal(document.getElementById('modal-normalizar'));

        var containerNorm = DOM.colunaNormalizados;
        containerNorm.prepend(card);
        card.dataset.coluna = 'coluna-normalizados';
        card.classList.add('card-foi-normalizado');
        setTimeout(function() {
            card.classList.remove('card-foi-normalizado');
        }, 2000);
        Semaforo.atualizarPainel();

        mostrarUndoToast(
            cod + ' normalizado — ' + horaFimHM,
            function() {
                NitFirebase.exec(function(db, ref, update) {
                    update(ref(db, 'kanban/' + eventoId), {
                        coluna: 'coluna-normalizados',
                        status: 'NORMALIZADO',
                        operador: NitLogin.operador || 'anon',
                        turno: NitLogin.turno || '',
                        ts: Date.now(),
                        data_fim: dataFimBR,
                        hora_fim: horaFimHM,
                        observacoes: obsNova,
                        ts_norm: Date.now()
                    });
                });
                card.dataset.fim = dataFimBR + ' ' + horaFimHM;
                card.dataset.observacoes = obsNova;
                gravarHistoricoFirebase(eventoId, origem, 'NORMALIZADO', null, null, null, NitLogin.operador);
                registrarAcao("'" + cod + "' normalizado — fim: " + dataFimBR + ' ' + horaFimHM + '.');
                showToast(cod + ' normalizado!', 'success');
            },
            function() {
                var containerOrigem = document.querySelector('#' + origem + ' .kanban-cards-container');
                if (containerOrigem) containerOrigem.appendChild(card);
                card.dataset.coluna = origem;
                NitFirebase.exec(function(db, ref, update) {
                    update(ref(db, 'kanban/' + eventoId), {
                        coluna: origem,
                        status: 'PENDENTE',
                        operador: NitLogin.operador || 'anon',
                        ts: Date.now(),
                        data_fim: null,
                        hora_fim: null,
                        ts_norm: null
                    });
                });
                Semaforo.atualizarPainel();
                showToast(cod + ' restaurado.', 'info');
            }
        );
    },

    inicializar: function() {
        var modal = document.getElementById('modal-normalizar');
        var btnConf = document.getElementById('btn-norm-confirmar');
        var btnCanc = document.getElementById('btn-norm-cancelar');
        var horaInput = document.getElementById('norm-hora-fim');

        if (!modal) return;

        if (btnConf) {
            btnConf.addEventListener('click', function() {
                this.confirmar();
            }.bind(this));
        }

        if (btnCanc) {
            btnCanc.addEventListener('click', function() {
                fecharModal(modal);
                this._cardAtual = null;
                this._origemAtual = null;
            }.bind(this));
        }

        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                fecharModal(modal);
                this._cardAtual = null;
                this._origemAtual = null;
            }
        }.bind(this));

        if (horaInput) {
            horaInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') this.confirmar();
            }.bind(this));
        }
    }
};
window.NitNormalizar = NitNormalizar;
        

     
    // ═════════════════════════════════════════════════════════════════════════
    // SIDEBAR
    // ═════════════════════════════════════════════════════════════════════════
    const NitSidebar = {
        _KEY: 'nit-sidebar-collapsed',

        inicializar() {
            const btn = document.getElementById('btn-sb-toggle');
            if (!btn) return;
            if (localStorage.getItem(this._KEY) === '1') this._setSidebar(true);
            btn.addEventListener('click', () => this.toggle());
            document.addEventListener('keydown', e => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                if (e.key === '[') this.toggle();
            });
        },

        toggle()   { const sb = document.getElementById('sidebar'); if (sb) this._setSidebar(!sb.classList.contains('collapsed')); },
        expandir() { this._setSidebar(false); },

        _setSidebar(collapsed) {
            const sb = document.getElementById('sidebar');
            if (!sb) return;
            sb.classList.toggle('collapsed', collapsed);
            localStorage.setItem(this._KEY, collapsed ? '1' : '0');
            const btn = document.getElementById('btn-sb-toggle');
            if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
        },

        toggleSec(id) {
            const sec = document.getElementById(id);
            if (sec) sec.classList.toggle('sec-collapsed');
        },
    };
    window.NitSidebar = NitSidebar;

    // ═════════════════════════════════════════════════════════════════════════
    // LAZY RENDER
    // ═════════════════════════════════════════════════════════════════════════
    const NitLazy = {
        _io:    null,
        _queue: new Map(),

        inicializar() {
            if (!('IntersectionObserver' in window)) return;
            this._io = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    const fn = this._queue.get(e.target);
                    if (fn) { fn(); this._queue.delete(e.target); this._io.unobserve(e.target); }
                });
            }, { rootMargin: '120px 0px', threshold: 0 });
        },

        observar(cardEl, renderFn) {
            if (!this._io) { renderFn(); return; }
            this._queue.set(cardEl, renderFn);
            this._io.observe(cardEl);
        },

        liberar(cardEl) {
            if (this._queue.has(cardEl)) {
                this._queue.delete(cardEl);
                this._io?.unobserve(cardEl);
            }
        },
    };
    window.NitLazy = NitLazy;

    // ═════════════════════════════════════════════════════════════════════════
    // MODAL DETALHES DO CARD
    // ═════════════════════════════════════════════════════════════════════════
    const NitCardDetails = {
        _COLUNAS: {
            'coluna-sem-necessidade': { label: 'Sem Necessidade', cor: '#94A3B8' },
            'coluna-espera':          { label: 'Aguardando',      cor: '#f85149' },
            'coluna-vl':              { label: 'Via Livre',       cor: '#f0883e' },
            'coluna-amc':             { label: 'AMC',             cor: '#58a6ff' },
            'coluna-normalizados':    { label: 'Normalizado',     cor: '#3fb950' },
        },

        abrir(card) {
            const ds      = card.dataset;
            const colId   = card.closest('.kanban-column')?.id || ds.coluna || '';
            const colInfo = this._COLUNAS[colId] || { label: colId || '—', cor: '#94A3B8' };

            const set = (id, val) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (val && String(val).trim()) { el.textContent = val; el.classList.remove('vazio'); }
                else { el.textContent = '—'; el.classList.add('vazio'); }
            };

            set('det-codigo',      ds.codigo);
            set('det-problema',    ds.problema);
            set('det-endereco',    ds.endereco);
            set('det-inicio',      ds.inicio);
            set('det-fim',         ds.fim);
            set('det-tipo',        ds.tipo);
            set('det-equipe',      ds.equipe);
            set('det-viatura',     ds.viatura);
            set('det-obs',         ds.observacoes);
            set('det-data',        ds.datareferencia);
            set('det-operador',    ds.operador);
            set('det-reincidente', ds.reincidente === 'true' ? 'Sim' : 'Nao');

            const badge = document.getElementById('detalhe-coluna-badge');
            if (badge) {
                badge.textContent    = colInfo.label;
                badge.style.background = colInfo.cor + '22';
                badge.style.color      = colInfo.cor;
                badge.style.border     = `1px solid ${colInfo.cor}44`;
            }
            abrirModal(document.getElementById('modal-detalhes'));
        },

        inicializar() {
            const modal = document.getElementById('modal-detalhes');
            const btnF  = document.getElementById('btn-detalhes-fechar');
            if (!modal || !btnF) return;
            btnF.addEventListener('click', () => fecharModal(modal));
            modal.addEventListener('click', e => { if (e.target === modal) fecharModal(modal); });
        },
    };

    // ═════════════════════════════════════════════════════════════════════════
    // BUSCA GLOBAL
    // ═════════════════════════════════════════════════════════════════════════
    const NitBuscaGlobal = {
        _aberto: false,
        _idx:    -1,

        _COLUNAS_LABEL: {
            'coluna-sem-necessidade': { label: 'Sem Nec.',    cor: '#94A3B8' },
            'coluna-espera':          { label: 'Aguardando',  cor: '#f85149' },
            'coluna-vl':              { label: 'Via Livre',   cor: '#f0883e' },
            'coluna-amc':             { label: 'AMC',         cor: '#58a6ff' },
            'coluna-normalizados':    { label: 'Normalizado', cor: '#3fb950' },
        },

        abrir() {
            const ov  = document.getElementById('busca-global-overlay');
            const inp = document.getElementById('busca-global-input');
            if (!ov) return;
            ov.classList.add('aberto');
            this._aberto = true;
            if (inp) { inp.value = ''; inp.focus(); }
            this._renderizar('');
        },

        fechar() {
            if (!this._aberto) return;
            document.getElementById('busca-global-overlay')?.classList.remove('aberto');
            this._aberto = false;
            this._idx = -1;
        },

        _coletarCards() {
            return Array.from(document.querySelectorAll('#tab-semaforo .kanban-card')).map(c => ({
                el:       c,
                codigo:   (c.dataset.codigo   || '').toLowerCase(),
                endereco: (c.dataset.endereco || '').toLowerCase(),
                problema: (c.dataset.problema || '').toLowerCase(),
                colId:    c.closest('.kanban-column')?.id || c.dataset.coluna || '',
                raw:      c,
            }));
        },

        _match(card, q) {
            return card.codigo.includes(q) || card.endereco.includes(q) || card.problema.includes(q);
        },

        _hl(texto, q) {
            if (!q || !texto) return texto || '';
            const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return texto.replace(re, '<span class="busca-highlight">$1</span>');
        },

        _renderizar(q) {
            const lista = document.getElementById('busca-global-resultados');
            const vazio = document.getElementById('busca-global-vazio');
            if (!lista || !vazio) return;
            const termo = q.toLowerCase().trim();
            const todos = this._coletarCards();
            const hits  = termo ? todos.filter(c => this._match(c, termo)) : todos.slice(0, 20);
            lista.innerHTML = '';
            vazio.classList.toggle('visivel', !hits.length);
            if (!hits.length && termo) {
                vazio.innerHTML = `<i class="fas fa-search" style="font-size:22px;opacity:0.3;"></i><span>Nenhum card encontrado para <strong>"${termo}"</strong></span>`;
            } else if (!hits.length) {
                vazio.innerHTML = `<i class="fas fa-inbox" style="font-size:22px;opacity:0.3;"></i><span>Nenhum card no painel.</span>`;
            }
            this._idx = -1;
            hits.forEach((c, i) => {
                const colInfo = this._COLUNAS_LABEL[c.colId] || { label: c.colId, cor: '#94A3B8' };
                const item = document.createElement('div');
                item.className = 'busca-resultado-item';
                item.dataset.i = i;
                item.innerHTML = `
                    <span class="busca-res-coluna-dot" style="background:${colInfo.cor};"></span>
                    <span class="busca-res-codigo">${this._hl(c.raw.dataset.codigo, termo)}</span>
                    <span class="busca-res-endereco">${this._hl(c.raw.dataset.endereco, termo)}</span>
                    <span class="busca-res-tag">${this._hl(c.raw.dataset.problema, termo)}</span>
                    <span class="busca-res-coluna-label">${colInfo.label}</span>`;
                item.addEventListener('click', e => { e.stopPropagation(); this._selecionar(c.raw); });
                lista.appendChild(item);
            });
        },

        _selecionar(cardEl) {
            this.fechar();
            requestAnimationFrame(() => {
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                cardEl.style.outline    = '2px solid var(--color-primary)';
                cardEl.style.boxShadow  = '0 0 0 4px rgba(59,130,246,.25)';
                setTimeout(() => { cardEl.style.outline = ''; cardEl.style.boxShadow = ''; }, 2200);
            });
        },

        _moverFoco(dir) {
            const items = document.querySelectorAll('#busca-global-resultados .busca-resultado-item');
            if (!items.length) return;
            items[this._idx]?.classList.remove('ativo');
            this._idx = Math.max(0, Math.min(this._idx + dir, items.length - 1));
            items[this._idx]?.classList.add('ativo');
            items[this._idx]?.scrollIntoView({ block: 'nearest' });
        },

        _confirmarFoco() {
            document.querySelector('#busca-global-resultados .busca-resultado-item.ativo')?.click();
        },

        inicializar() {
            const btnAbrir = document.getElementById('btn-busca-global');
            const overlay  = document.getElementById('busca-global-overlay');
            const input    = document.getElementById('busca-global-input');
            const btnEsc   = document.getElementById('busca-global-esc');
            if (!overlay || !input) return;
            btnAbrir?.addEventListener('click', () => this.abrir());
            btnEsc?.addEventListener('click',  () => this.fechar());
            overlay.addEventListener('click', e => { if (e.target === overlay) this.fechar(); });
            document.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') { e.preventDefault(); this.abrir(); return; }
                if (e.key === 'Escape' && this._aberto) { e.stopPropagation(); this.fechar(); }
            });
            input.addEventListener('keydown', e => {
                if      (e.key === 'ArrowDown') { e.preventDefault(); this._moverFoco(+1); }
                else if (e.key === 'ArrowUp')   { e.preventDefault(); this._moverFoco(-1); }
                else if (e.key === 'Enter')      { e.preventDefault(); this._confirmarFoco(); }
                else if (e.key === 'Escape')     { e.stopPropagation(); this.fechar(); }
            });
            input.addEventListener('input', () => this._renderizar(input.value));
        },
    };

    // ═════════════════════════════════════════════════════════════════════════
    // LOGOUT
    // ═════════════════════════════════════════════════════════════════════════
    const NitLogout = {
        inicializar() {
            const btn = document.getElementById('btn-logout');
            if (!btn) return;
            btn.addEventListener('click', () => this._executar());

            // Mostra botão de logout assim que há sessão Firebase Auth
            firebase.auth().onAuthStateChanged(user => {
                btn.style.display = user ? 'flex' : 'none';
            });
        },

        _executar() {
            nitConfirm(
                '🚪 Sair do Sistema',
                `Tem certeza que deseja encerrar a sessão de <strong>${NitLogin.operador || 'operador'}</strong>?`,
                async () => {
                    registrarAcao(`Logout: ${NitLogin.operador} — ${NitLogin.turno || ''}.`);
                    await NitLogin.sair();
                }
            );
        },
    };

    // ═════════════════════════════════════════════════════════════════════════
    // BUSCA POR COLUNA
    // ═════════════════════════════════════════════════════════════════════════
    // ═════════════════════════════════════════════════════════════════════════
    // COLUNA NORMALIZADOS — colapso inline
    // ═════════════════════════════════════════════════════════════════════════
    const NitNormalizados = {
        _KEY: 'nit-norm-collapsed',

        inicializar() {
            if (localStorage.getItem(this._KEY) === '1') this._set(true);
            // Clicar no header inteiro: toggle em ambos os sentidos
            document.getElementById('coluna-normalizados')
                ?.querySelector('.kanban-column-header')
                ?.addEventListener('click', e => {
                    if (e.target.closest('#btn-toggle-norm')) return;
                    this.toggle();
                });
        },

        toggle() {
            const col = document.getElementById('coluna-normalizados');
            this._set(!col?.classList.contains('collapsed'));
        },

        _set(collapsed) {
            const col   = document.getElementById('coluna-normalizados');
            const board = document.querySelector('.kanban-board');
            if (!col || !board) return;
            col.classList.toggle('collapsed', collapsed);
            board.classList.toggle('norm-collapsed', collapsed);
            localStorage.setItem(this._KEY, collapsed ? '1' : '0');
        },
    };
    window.NitNormalizados = NitNormalizados;

    function inicializarBuscasPorColuna() {
        document.querySelectorAll('.kanban-search').forEach(input => {
            const colunaId = input.dataset.coluna;
            if (!colunaId) return;
            input.addEventListener('input', () => {
                const q       = input.value.toLowerCase();
                const hoje    = NitData.hoje();
                const container = document.querySelector(`#${colunaId} .kanban-cards-container`);
                if (!container) return;
                container.querySelectorAll('.kanban-card').forEach(c => {
                    if (c.dataset.datareferencia !== hoje) { c.style.display = 'none'; return; }
                    const match = (c.dataset.codigo   || '').toLowerCase().includes(q)
                               || (c.dataset.endereco || '').toLowerCase().includes(q)
                               || (c.dataset.problema || '').toLowerCase().includes(q);
                    c.style.display = match ? '' : 'none';
                });
            });
        });
    }



    // ══════════════════════════════════════════════════════════════════
// NitRecursos — Banco de Equipes e Viaturas
// Persiste em /recursos/equipes no Firebase RTDB
// Alimenta os datalists da Central da Ocorrência
// ══════════════════════════════════════════════════════════════════
const NitRecursos = {
    _cache: {},   // { nome: { vt, tipo } }
    _listener: null,

    // ── Inicializa listener Firebase ──────────────────────────────────
    inicializar() {
        firebase.database().ref('recursos/equipes').on('value', snap => {
            this._cache = {};
            if (snap.exists()) {
                snap.forEach(child => {
                    const d = child.val();
                    this._cache[d.nome] = { vt: d.vt || '', tipo: d.tipo || 'vl' };
                });
            }
            this._atualizarDatalist();
        });
    },

    // ── Atualiza datalists do DOM ─────────────────────────────────────
    _atualizarDatalist() {
        const dlEquipes = document.getElementById('datalist-central-equipes');
        const dlVTs     = document.getElementById('datalist-central-vts');
        if (!dlEquipes || !dlVTs) return;

        const nomes = Object.keys(this._cache).sort();
        const vts   = [...new Set(Object.values(this._cache).map(r => r.vt).filter(Boolean))].sort();

        dlEquipes.innerHTML = nomes.map(n => `<option value="${n}">`).join('');
        dlVTs.innerHTML     = vts.map(v => `<option value="${v}">`).join('');
    },

    // ── Auto-fill VT ao selecionar equipe ────────────────────────────
    // Chame em oninput dos campos de equipe na Central
    autoFillVT(nomeEquipe, campoVT) {
        const rec = this._cache[nomeEquipe.trim()];
        if (!rec) return;
        const el = document.getElementById(campoVT);
        if (el && !el.value) el.value = rec.vt;
        // Sugere tipo também
        return rec.tipo; // 'vl' | 'amc'
    },

    // ── Salva ou atualiza uma equipe ─────────────────────────────────
    salvar(nome, vt, tipo) {
        if (!nome) return;
        const chave = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        firebase.database().ref(`recursos/equipes/${chave}`).set({
            nome, vt: vt || '', tipo: tipo || 'vl',
            atualizadoEm: Date.now(),
            operador: NitLogin.operador || 'anon',
        });
    },

    // ── Remove uma equipe ─────────────────────────────────────────────
    remover(nome) {
        const chave = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        firebase.database().ref(`recursos/equipes/${chave}`).remove();
    },

    // ── Aprende automaticamente ao despachar ─────────────────────────
    // Chame após qualquer despacho/apoio/rendição confirmado
    aprenderDeDespacho(nome, vt, tipo) {
        if (!nome || this._cache[nome]) return; // não sobrescreve existente
        this.salvar(nome, vt, tipo);
    },

    // ── Retorna lista para exibição (ex: painel admin) ────────────────
    listar() {
        return Object.entries(this._cache)
            .map(([nome, r]) => ({ nome, ...r }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    },
};

    
// Modal de gestão operacional com abas: Despacho | Apoio | Rendição | Normalizar
// Histórico via Firebase push keys (append-only, collision-safe)
// ══════════════════════════════════════════════════════════════════
const NitCentral = {
    _card:         null,
    _timerSLA:     null,
    _timerOp:      null,
    _tipoDespacho: 'vl',
    _tipoApoio:    'vl',
    _tipoRendicao: 'vl',

    abrir(card) {
        if (!card) return;
        this._card = card;
        this._tipoDespacho = 'vl';
        this._tipoApoio    = 'vl';
        this._tipoRendicao = 'vl';
        // Resetar histórico para colapsado
        const lista   = document.getElementById('central-historico-lista');
        const chevron = document.getElementById('central-hist-chevron');
        const header  = document.getElementById('central-hist-header');
        if (lista)   lista.classList.remove('aberto');
        if (chevron) chevron.textContent = '▼';
        if (header)  header.setAttribute('aria-expanded', 'false');
        this._renderHeader(card);
        this._renderHistorico(card);
        this._determinarAbaInicial(card);
        this._iniciarTimers(card);
        abrirModal(document.getElementById('modal-central-ocorrencia'));
    },

    fechar() {
        this._pararTimers();
        fecharModal(document.getElementById('modal-central-ocorrencia'));
        this._card = null;
    },

    _sv: v => (v && v !== 'null' && v !== 'undefined') ? String(v).trim() : '',

    // ── Header ───────────────────────────────────────────────────────
    _renderHeader(card) {
        const sv = this._sv;

        // Zona 1 — identidade do semáforo
        document.getElementById('central-codigo').textContent   = sv(card.dataset.codigo) || '---';
        document.getElementById('central-endereco').textContent = sv(card.dataset.endereco);
        const tipoLinha = document.getElementById('central-tipo-linha');
        const tipo = sv(card.dataset.tipo) || sv(card.dataset.problema);
        if (tipoLinha) {
            tipoLinha.textContent   = tipo || '';
            tipoLinha.style.display = tipo ? '' : 'none';
        }

        // Zona 2 — status operacional com equipe (não pertence à identidade do semáforo)
        const statusEl = document.getElementById('central-status-operacional');
        const coluna   = sv(card.dataset.coluna);
        const sub      = sv(card.dataset.sub);
        const equipe   = sv(card.dataset.equipe);
        const viatura  = sv(card.dataset.viatura);
        if (statusEl) {
            let html = '';
            if (sub && sub !== 'sn') {
                const emoji    = sub === 'vl' ? '🟠' : '🔵';
                const label    = sub === 'vl' ? 'VIA LIVRE' : 'AMC';
                const equipeStr = equipe ? `${equipe}${viatura ? ` · VT ${viatura}` : ''}` : '';
                html = `<span class="nit-sop-badge nit-sop-${sub}">${emoji} ${label}</span>`
                     + (equipeStr ? `<span class="nit-sop-equipe">${equipeStr}</span>` : '');
            } else if (sub === 'sn') {
                html = `<span class="nit-sop-badge nit-sop-sn">— Sem Necessidade</span>`;
            } else if (coluna === 'coluna-normalizados' || sv(card.dataset.status) === 'NORMALIZADO') {
                html = `<span class="nit-sop-badge nit-sop-norm">✅ Normalizado</span>`;
            } else {
                html = `<span class="nit-sop-badge nit-sop-esp">⏳ Aguardando despacho</span>`;
            }
            statusEl.innerHTML = html;
        }

        // Zona 2b — banner de rendição agendada (opcional)
        const agendBanner = document.getElementById('central-agend-banner');
        const agendHora   = sv(card.dataset.agendamentohora);
        const agendEquipe = sv(card.dataset.agendamentoequipe);
        const agendSub    = sv(card.dataset.agendamentosub);
        if (agendBanner) {
            if (agendHora) {
                const subLabel  = { vl: 'VIA LIVRE', amc: 'AMC' }[agendSub] || agendSub.toUpperCase();
                const equipeStr = agendEquipe ? ` · ${agendEquipe}` : '';
                agendBanner.innerHTML = `⏰ Rendição agendada: <strong>${agendHora}</strong> — ${subLabel}${equipeStr}`;
                agendBanner.style.display = '';
            } else {
                agendBanner.style.display = 'none';
            }
        }

        // Zona 2c — observação completa (colapsável)
        const obsFaixa   = document.getElementById('central-obs-faixa');
        const obsPreview = document.getElementById('central-obs-preview');
        const obsTexto   = document.getElementById('central-obs-texto');
        const obsCorpo   = document.getElementById('central-obs-corpo');
        const obsToggle  = document.getElementById('central-obs-toggle');
        const obsRaw     = sv(card.dataset.observacoes);
        if (obsFaixa) {
            if (obsRaw) {
                const preview = obsRaw.length > 60 ? obsRaw.slice(0, 60) + '…' : obsRaw;
                if (obsPreview) obsPreview.textContent = `📋 ${preview}`;
                if (obsTexto)   obsTexto.textContent   = obsRaw;
                if (obsCorpo)   obsCorpo.style.display = 'none';
                if (obsToggle)  obsToggle.setAttribute('aria-expanded', 'false');
                const chv = obsToggle?.querySelector('.nit-central-obs-chevron');
                if (chv) chv.textContent = '▼';
                obsFaixa.style.display = '';
            } else {
                obsFaixa.style.display = 'none';
            }
        }
    },

    // ── Timers ───────────────────────────────────────────────────────
    _iniciarTimers(card) {
        this._pararTimers();
        const sv      = this._sv;
        const coluna  = sv(card.dataset.coluna);
        const status  = sv(card.dataset.status);
        const isNorm  = coluna === 'coluna-normalizados' || status === 'NORMALIZADO';
        const elSLA   = document.getElementById('central-tempo-sla');
        const elOp    = document.getElementById('central-tempo-op');
        const elRes   = document.getElementById('central-resultado');

        if (isNorm) {
            // ── Normalizado: tempos finais estáticos (sem interval) ───────
            const tsInicio = this._parseBR(sv(card.dataset.inicio));
            const fimRaw   = `${sv(card.dataset.data_fim)} ${sv(card.dataset.hora_fim)}`.trim();
            const tsFim    = this._parseBR(fimRaw) || 0;
            const tsOp     = parseInt(sv(card.dataset.tsDespacho)) || 0;
            const duracao  = tsInicio && tsFim ? tsFim - tsInicio : 0;
            const duracaoOp = tsOp && tsFim ? tsFim - tsOp : 0;

            if (elSLA) {
                elSLA.textContent = duracao > 0 ? this._formatDelta(duracao) : '--:--';
                elSLA.className   = 'nit-central-tempo-valor sla-ok';
            }
            if (elOp) {
                elOp.textContent = duracaoOp > 0 ? this._formatDelta(duracaoOp) : '--:--';
                elOp.className   = 'nit-central-tempo-valor nit-central-tempo-op' +
                    (duracaoOp > 0 ? ' sla-ok' : '');
            }

            // ── Resultado final ───────────────────────────────────────────
            if (elRes && tsInicio && tsFim && duracao > 0) {
                const fmt = ts => {
                    const d = new Date(ts);
                    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                };
                document.getElementById('central-resultado-periodo').textContent =
                    `${fmt(tsInicio)} → ${fmt(tsFim)}`;
                const elTotal = document.getElementById('central-resultado-total');
                if (elTotal) elTotal.style.display = 'none'; // duração já está no timer REGISTRO
                elRes.style.display = '';
            } else if (elRes) {
                elRes.style.display = 'none';
            }
            return; // não inicia interval
        }

        // ── Ativo: timers em tempo real ───────────────────────────────────
        if (elRes) elRes.style.display = 'none';
        const tsInicio   = this._parseBR(sv(card.dataset.inicio));
        const tsChegada  = parseInt(sv(card.dataset.tsChegada))  || 0;
        const tsDespacho = parseInt(sv(card.dataset.tsDespacho)) || 0;
        // OPERAÇÃO conta desde a chegada ao local; fallback para despacho se ainda não chegou
        const tsOp = tsChegada || tsDespacho;

        const tick = () => {
            const now = Date.now();
            if (elSLA) {
                elSLA.textContent = tsInicio ? this._formatDelta(now - tsInicio) : '--:--';
                if (tsInicio) {
                    const h = (now - tsInicio) / 3600000;
                    elSLA.className = 'nit-central-tempo-valor' +
                        (h > 8 ? ' sla-critico' : h > 4 ? ' sla-alerta' : ' sla-ok');
                }
            }
            if (elOp) {
                elOp.textContent = tsOp ? this._formatDelta(now - tsOp) : '--:--';
                if (tsOp) {
                    const hOp = (now - tsOp) / 3600000;
                    elOp.className = 'nit-central-tempo-valor nit-central-tempo-op' +
                        (hOp > 2 ? ' sla-critico' : hOp > 1 ? ' sla-alerta' : ' sla-ok');
                }
            }
        };
        tick();
        this._timerSLA = setInterval(tick, 10000);
    },

    _pararTimers() {
        clearInterval(this._timerSLA);
        clearInterval(this._timerOp);
    },

    _parseBR(str) {
        const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        return m ? new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]).getTime() : 0;
    },

    _formatDelta(ms) {
        if (ms < 0) return '--:--';
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h}h${String(m).padStart(2,'0')}m` : `${m}min`;
    },

    // ── Histórico Firebase ────────────────────────────────────────────
    _renderHistorico(card) {
        const sv       = this._sv;
        const eventoId = sv(card.dataset.eventoid) || card.id;
        const lista    = document.getElementById('central-historico-lista');
        const elUltimo = document.getElementById('central-hist-ultimo');
        if (!lista) return;
        lista.innerHTML = '<div class="nit-central-historico-vazio">Carregando...</div>';
        if (elUltimo) elUltimo.textContent = '—';

        firebase.database().ref(`kanban/${eventoId}/historico`).get()
            .then(snap => {
                if (!snap.exists()) {
                    const sub = sv(card.dataset.sub);
                    const eq  = sv(card.dataset.equipe);
                    if (sub && eq) {
                        const ev = {
                            tipo: 'despacho', sub, equipe: eq,
                            vt: sv(card.dataset.viatura),
                            ts: parseInt(sv(card.dataset.tsDespacho)) || 0,
                            operador: '', _legado: true
                        };
                        lista.innerHTML = this._renderEventoHTML(ev);
                        this._atualizarUltimo(elUltimo, [ev]);
                    } else {
                        lista.innerHTML = '<div class="nit-central-historico-vazio">Nenhum registro de operação.</div>';
                        if (elUltimo) elUltimo.textContent = '—';
                    }
                    return;
                }
                const eventos = Object.values(snap.val()).sort((a,b) => (a.ts||0)-(b.ts||0));
                lista.innerHTML = eventos.map(ev => this._renderEventoHTML(ev)).join('');
                this._atualizarUltimo(elUltimo, eventos);
            })
            .catch(() => {
                lista.innerHTML = '<div class="nit-central-historico-vazio">Erro ao carregar histórico.</div>';
            });
    },

    _atualizarUltimo(el, eventos) {
        if (!el || !eventos.length) return;
        const last = eventos[eventos.length - 1];
        const labelMap = { despacho: 'Despacho', apoio: 'Apoio', 'rendição': 'Rendição', encerramento: 'Encerrado' };
        const label = labelMap[last.tipo] || last.tipo;
        const ts    = last.ts ? new Date(last.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        el.textContent = `Último: ${label}${ts ? ` · ${ts}` : ''}`;
    },

    _renderEventoHTML(ev) {
        const dotMap = {
            despacho:     'dot-despacho',
            apoio:        'dot-apoio',
            'rendição':   'dot-rendição',
        };
        const labelMap = {
            despacho:     'Despacho',
            apoio:        'Apoio',
            'rendição':   'Rendição',
            encerramento: 'Encerrado',
        };
        const dotCls  = dotMap[ev.tipo]   || 'dot-default';
        const label   = labelMap[ev.tipo] || ev.tipo;
        const ts      = ev.ts ? new Date(ev.ts).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '--:--';
        const sub     = ev.sub === 'vl' ? 'VIA LIVRE' : ev.sub === 'amc' ? 'AMC' : (ev.sub||'').toUpperCase();
        const legado  = ev._legado ? ' <em style="opacity:.5">(legado)</em>' : '';
        return `<div class="nit-central-historico-item">
            <div class="nit-central-hist-dot ${dotCls}"></div>
            <div class="nit-central-hist-body">
                <span class="nit-central-hist-tipo">${label} · ${sub}${legado}</span>
                <span class="nit-central-hist-detalhe">${ev.equipe||''}${ev.vt ? ` · VT ${ev.vt}` : ''}</span>
                ${ev.operador ? `<span class="nit-central-hist-op">${ev.operador}</span>` : ''}
            </div>
            <span class="nit-central-hist-ts">${ts}</span>
        </div>`;
    },

    // ── Aba inicial ───────────────────────────────────────────────────
    _determinarAbaInicial(card) {
        const sv         = this._sv;
        const sub        = sv(card.dataset.sub);
        const tsChegada  = parseInt(sv(card.dataset.tsChegada)) || 0;
        const coluna     = sv(card.dataset.coluna);
        const isNorm     = coluna === 'coluna-normalizados' || sv(card.dataset.status) === 'NORMALIZADO';
        this._abrirAba(sub ? 'apoio' : 'despacho');

        const btnEncerrar    = document.getElementById('btn-central-encerrar');
        const chegadaBloco   = document.getElementById('central-chegada-bloco');
        const chegadaHora    = document.getElementById('central-chegada-hora');
        const btnChegada     = document.getElementById('btn-central-chegada');

        if (btnEncerrar) btnEncerrar.style.display = sub ? 'flex' : 'none';

        // Bloco chegada: visível se despachado e não normalizado
        if (chegadaBloco) {
            const mostrar = !!sub && !isNorm;
            chegadaBloco.style.display = mostrar ? '' : 'none';

            if (mostrar) {
                if (tsChegada && chegadaHora) {
                    // Chegada já registrada — mostrar hora e ocultar botão
                    const d = new Date(tsChegada);
                    chegadaHora.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    chegadaBloco.classList.add('chegada-registrada');
                    if (btnChegada) btnChegada.style.display = 'none';
                } else {
                    // Aguardando chegada
                    if (chegadaHora) chegadaHora.textContent = '—';
                    chegadaBloco.classList.remove('chegada-registrada');
                    if (btnChegada) btnChegada.style.display = '';
                }
            }
        }
    },

    // ── Tabs ──────────────────────────────────────────────────────────
    _abrirAba(aba) {
        const temDespacho = this._sv(this._card?.dataset.sub) !== '';
        document.querySelectorAll('.nit-central-tab').forEach(btn => {
            const t = btn.dataset.tab;
            const bloqueada = (t === 'apoio' || t === 'rendicao') && !temDespacho;
            btn.classList.toggle('active', t === aba);
            btn.classList.toggle('disabled', bloqueada);
            btn.disabled = bloqueada;
        });
        document.querySelectorAll('.nit-central-panel').forEach(p => {
            p.style.display = p.id === `central-panel-${aba}` ? '' : 'none';
        });
        if (aba === 'normalizar') this._preencherNormalizarDefaults();
        if (aba === 'rendicao')   { this._atualizarPreviewRendicao(); this._renderEstadoRendicao(); }
    },

    _preencherNormalizarDefaults() {
        const agora = new Date();
        const pad   = n => String(n).padStart(2,'0');
        const dEl   = document.getElementById('central-norm-data');
        const hEl   = document.getElementById('central-norm-hora');
        const oEl   = document.getElementById('central-norm-obs');
        if (dEl && !dEl.value) dEl.value = `${agora.getFullYear()}-${pad(agora.getMonth()+1)}-${pad(agora.getDate())}`;
        if (hEl && !hEl.value) hEl.value = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
        if (oEl && !oEl.value) oEl.value = this._sv(this._card?.dataset.observacoes);
    },

    // ── Tipo selector ─────────────────────────────────────────────────
    _selecionarTipo(panel, tipo, prop) {
        this[prop] = tipo;
        document.querySelectorAll(`#central-panel-${panel} .nit-central-tipo-btn`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tipo === tipo);
        });
        if (panel === 'despacho') {
            const campos = document.getElementById('central-despacho-campos-equipe');
            if (campos) campos.style.display = tipo === 'sn' ? 'none' : '';
        }
        if (panel === 'rendicao') this._atualizarPreviewRendicao();
        if (panel === 'apoio')    this._atualizarPreviewApoio();
    },

    // ── Coluna N ─────────────────────────────────────────────────────
    _derivarColunaN(historico, eventoExtra) {
        const todos = [
            ...Object.values(historico || {}),
            ...(eventoExtra ? [eventoExtra] : [])
        ].sort((a,b) => (a.ts||0)-(b.ts||0));

        const segmentos = [];
        let seg = [];
        for (const ev of todos) {
            const label = ev.sub === 'vl' ? 'VIA LIVRE' : ev.sub === 'amc' ? 'AMC' : null;
            if (!label) continue;
            if (ev.tipo === 'despacho') { seg = [label]; }
            else if (ev.tipo === 'apoio')   { if (!seg.includes(label)) seg.push(label); }
            else if (ev.tipo === 'rendição') { if (seg.length) segmentos.push(seg.join(' + ')); seg = [label]; }
        }
        if (seg.length) segmentos.push(seg.join(' + '));
        return segmentos.join(' → ');
    },

    _buscarHistoricoEDerivar(elId, eventoExtra) {
        const eventoId = this._sv(this._card?.dataset.eventoid) || this._card?.id;
        if (!eventoId) return;
        firebase.database().ref(`kanban/${eventoId}/historico`).get()
            .then(snap => {
                const hist    = snap.exists() ? snap.val() : {};
                const colunaN = this._derivarColunaN(hist, eventoExtra);
                const el = document.getElementById(elId);
                if (el) el.textContent = colunaN || '—';
            });
    },

    _atualizarPreviewRendicao() {
        this._buscarHistoricoEDerivar('central-rendicao-coluna-n',
            { tipo: 'rendição', sub: this._tipoRendicao, ts: Date.now() + 1 });
    },

    _atualizarPreviewApoio() {
        const divPrev = document.getElementById('central-apoio-preview');
        this._buscarHistoricoEDerivar('central-apoio-coluna-n',
            { tipo: 'apoio', sub: this._tipoApoio, ts: Date.now() + 1 });
        if (divPrev) divPrev.style.display = '';
    },

    // ── Ações ─────────────────────────────────────────────────────────
    confirmarDespacho() {
        const card   = this._card; if (!card) return;
        const tipo   = this._tipoDespacho;
        const equipe = document.getElementById('central-despacho-equipe')?.value.trim() || '';
        const vt     = document.getElementById('central-despacho-vt')?.value.trim()     || '';
        if (tipo !== 'sn' && !equipe) { showToast('Informe a equipe.', 'warning'); return; }

        const eventoId  = this._sv(card.dataset.eventoid) || card.id;
        const colunaMap = { vl: 'coluna-vl', amc: 'coluna-amc', sn: 'coluna-sem-necessidade' };
        const colunaDest = colunaMap[tipo] || 'coluna-vl';
        const tsNow     = Date.now();

        NitFirebase.exec((db, ref, update) => {
            const pushKey = ref(db, `kanban/${eventoId}/historico`).push().key;
            const updates = {};
            updates[`kanban/${eventoId}/historico/${pushKey}`] = {
                tipo: 'despacho', sub: tipo, equipe, vt, ts: tsNow, operador: NitLogin.operador || 'anon',
            };
            if (!this._sv(card.dataset.tsfirstdispatch)) {
                updates[`kanban/${eventoId}/tsFirstDispatch`] = tsNow;
            }
            Object.assign(updates, {
                [`kanban/${eventoId}/equipe`]:     equipe,
                [`kanban/${eventoId}/viatura`]:    vt,
                [`kanban/${eventoId}/sub`]:        tipo,
                [`kanban/${eventoId}/pl`]:         tipo === 'sn' ? 'sn' : 'atend',
                [`kanban/${eventoId}/coluna`]:     colunaDest,
                [`kanban/${eventoId}/tsDespacho`]: tsNow,
                [`kanban/${eventoId}/operador`]:   NitLogin.operador || 'anon',
                [`kanban/${eventoId}/colunaN`]:    { vl: 'VIA LIVRE', amc: 'AMC', sn: '' }[tipo] || '',
            });
            update(ref(db, '/'), updates);
        });

        const container = document.querySelector(`#${colunaDest} .kanban-cards-container`);
        if (container) container.appendChild(card);
        card.dataset.coluna = colunaDest;
        NitRecursos.aprenderDeDespacho(equipe, vt, tipo);
        showToast(`Despacho: ${tipo.toUpperCase()}`, 'success');
        this.fechar();
    },

    confirmarApoio() {
        const card   = this._card; if (!card) return;
        const tipo   = this._tipoApoio;
        const equipe = document.getElementById('central-apoio-equipe')?.value.trim() || '';
        const vt     = document.getElementById('central-apoio-vt')?.value.trim()     || '';
        if (!equipe) { showToast('Informe a equipe de apoio.', 'warning'); return; }

        const eventoId = this._sv(card.dataset.eventoid) || card.id;
        const tsNow    = Date.now();

        // Derivar colunaN do historico Firebase (garante valor correto independente do timing do DOM)
        firebase.database().ref(`kanban/${eventoId}/historico`).get().then(snap => {
            const hist    = snap.exists() ? snap.val() : {};
            const colunaN = this._derivarColunaN(hist, { tipo: 'apoio', sub: tipo, ts: tsNow + 1 });

            NitFirebase.exec((db, ref, update) => {
                const pushKey = ref(db, `kanban/${eventoId}/historico`).push().key;
                const updates = {};
                updates[`kanban/${eventoId}/historico/${pushKey}`] = {
                    tipo: 'apoio', sub: tipo, equipe, vt, ts: tsNow, operador: NitLogin.operador || 'anon',
                };
                updates[`kanban/${eventoId}/equipeApoio`]  = equipe;
                updates[`kanban/${eventoId}/viaturaApoio`] = vt;
                updates[`kanban/${eventoId}/colunaN`]      = colunaN || '';
                update(ref(db, '/'), updates);
            });
            NitRecursos.aprenderDeDespacho(equipe, vt, tipo);

            // Limpa campos para próximo apoio sem fechar o modal
            const eqEl = document.getElementById('central-apoio-equipe');
            const vtEl = document.getElementById('central-apoio-vt');
            if (eqEl) eqEl.value = '';
            if (vtEl) vtEl.value = '';
            showToast(`Apoio adicionado: ${tipo.toUpperCase()}`, 'success');
            // Atualiza preview da Coluna N para refletir o apoio recém-adicionado
            setTimeout(() => this._atualizarPreviewApoio(), 400);
        });
    },

    // ── Estado do painel de Rendição ─────────────────────────────────
    _renderEstadoRendicao() {
        const card    = this._card; if (!card) return;
        const sv      = this._sv;
        const agendHora   = sv(card.dataset.agendamentohora);
        const agendEquipe = sv(card.dataset.agendamentoequipe);
        const agendSub    = sv(card.dataset.agendamentosub);
        const agendVt     = sv(card.dataset.agendamentovt);

        const elAgend  = document.getElementById('central-rendicao-agendada');
        const elNormal = document.getElementById('central-rendicao-normal');

        if (agendHora) {
            // Preencher info do agendamento
            const subLabel = { vl: '🟠 VIA LIVRE', amc: '🔵 AMC' }[agendSub] || agendSub.toUpperCase();
            const vtStr    = agendVt ? ` · VT ${agendVt}` : '';
            const infoEl   = document.getElementById('central-agend-execucao-info');
            if (infoEl) infoEl.innerHTML =
                `<span class="nit-agend-exec-hora">⏰ ${agendHora}</span>` +
                `<span class="nit-agend-exec-sub">${subLabel}</span>` +
                (agendEquipe ? `<span class="nit-agend-exec-equipe">${agendEquipe}${vtStr}</span>` : '');

            // Pré-preencher hora real com hora agendada
            const horaRealEl = document.getElementById('central-rendicao-hora-real');
            if (horaRealEl) horaRealEl.value = agendHora;

            if (elAgend)  elAgend.style.display  = '';
            if (elNormal) elNormal.style.display  = 'none';

            // Derivar Coluna N com o agendamento como evento extra
            this._buscarHistoricoEDerivar('central-rendicao-coluna-n-exec',
                { tipo: 'rendição', sub: agendSub, ts: Date.now() + 1 });
        } else {
            if (elAgend)  elAgend.style.display  = 'none';
            if (elNormal) elNormal.style.display  = '';
        }
    },

    // ── Executar rendição agendada ────────────────────────────────────
    confirmarExecutarRendicao() {
        const card = this._card; if (!card) return;
        const sv   = this._sv;
        const agendEquipe = sv(card.dataset.agendamentoequipe);
        const agendVt     = sv(card.dataset.agendamentovt);
        const agendSub    = sv(card.dataset.agendamentosub);
        const horaReal    = document.getElementById('central-rendicao-hora-real')?.value || '';

        if (!horaReal)    { showToast('Informe a hora real de execução.', 'warning'); return; }
        if (!agendEquipe) { showToast('Agendamento sem equipe definida.', 'warning'); return; }

        // Calcular ts a partir da hora real (data de hoje)
        const [h, m]   = horaReal.split(':').map(Number);
        const agora    = new Date();
        const tsExec   = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m).getTime();

        const eventoId   = sv(card.dataset.eventoid) || card.id;
        const colunaMap  = { vl: 'coluna-vl', amc: 'coluna-amc' };
        const colunaDest = colunaMap[agendSub] || 'coluna-vl';

        NitFirebase.exec((db, ref, update) => {
            const pushKey = ref(db, `kanban/${eventoId}/historico`).push().key;
            const updates = {};
            updates[`kanban/${eventoId}/historico/${pushKey}`] = {
                tipo: 'rendição', sub: agendSub, equipe: agendEquipe,
                vt: agendVt, ts: tsExec, operador: NitLogin.operador || 'anon',
            };
            Object.assign(updates, {
                [`kanban/${eventoId}/equipe`]:       agendEquipe,
                [`kanban/${eventoId}/viatura`]:      agendVt,
                [`kanban/${eventoId}/sub`]:          agendSub,
                [`kanban/${eventoId}/equipeApoio`]:  '',
                [`kanban/${eventoId}/viaturaApoio`]: '',
                [`kanban/${eventoId}/agendamento`]:  null,
                [`kanban/${eventoId}/coluna`]:       colunaDest,
                [`kanban/${eventoId}/tsDespacho`]:   tsExec,
                [`kanban/${eventoId}/operador`]:     NitLogin.operador || 'anon',
                [`kanban/${eventoId}/colunaN`]:      (() => { const v = document.getElementById('central-rendicao-coluna-n-exec')?.textContent?.trim(); return (v && v !== '—') ? v : ''; })(),
            });
            update(ref(db, '/'), updates);
        });

        // Atualizar DOM imediatamente
        const container = document.querySelector(`#${colunaDest} .kanban-cards-container`);
        if (container) container.appendChild(card);
        Object.assign(card.dataset, {
            coluna: colunaDest, equipe: agendEquipe, viatura: agendVt, sub: agendSub,
            agendamentohora: '', agendamentoequipe: '', agendamentosub: '', agendamentovt: '',
        });
        NitRecursos.aprenderDeDespacho(agendEquipe, agendVt, agendSub);
        showToast(`Rendição executada às ${horaReal}.`, 'success');
        this.fechar();
    },

    // ── Cancelar agendamento ──────────────────────────────────────────
    cancelarAgendamento() {
        const card = this._card; if (!card) return;
        const eventoId = this._sv(card.dataset.eventoid) || card.id;
        nitConfirm('Cancelar Agendamento',
            'Remover a rendição agendada? O card permanece no estado atual.',
            () => {
                NitFirebase.exec((db, ref, update) =>
                    update(ref(db, `kanban/${eventoId}`), { agendamento: null })
                );
                Object.assign(card.dataset, {
                    agendamentohora: '', agendamentoequipe: '',
                    agendamentosub: '', agendamentovt: '',
                });
                showToast('Agendamento cancelado.', 'info');
                this.fechar();
            });
    },

    confirmarRendicao() {
        const card   = this._card; if (!card) return;
        const tipo   = this._tipoRendicao;
        const equipe = document.getElementById('central-rendicao-equipe')?.value.trim() || '';
        const vt     = document.getElementById('central-rendicao-vt')?.value.trim()     || '';
        if (!equipe) { showToast('Informe a equipe que entra.', 'warning'); return; }

        // ── Agendamento ─────────────────────────────────────────────
        const isAgendado   = document.getElementById('central-rendicao-agendar')?.checked || false;
        const horaAgendada = document.getElementById('central-rendicao-hora-agendada')?.value || '';

        if (isAgendado) {
            if (!horaAgendada) { showToast('Informe o horário da rendição agendada.', 'warning'); return; }
            const eventoId = this._sv(card.dataset.eventoid) || card.id;
            NitFirebase.exec((db, ref, update) => {
                update(ref(db, `kanban/${eventoId}/agendamento`), {
                    tipo: 'rendição', sub: tipo, equipe, vt,
                    horaAgendada, tsRegistro: Date.now(),
                    operador: NitLogin.operador || 'anon',
                });
            });
            NitRecursos.aprenderDeDespacho(equipe, vt, tipo);
            showToast(`Rendição agendada para ${horaAgendada}.`, 'info');
            this.fechar();
            return;
        }

        // ── Execução imediata ─────────────────────────────────────────────
        const eventoId   = this._sv(card.dataset.eventoid) || card.id;
        const colunaMap  = { vl: 'coluna-vl', amc: 'coluna-amc' };
        const colunaDest = colunaMap[tipo] || 'coluna-vl';
        const tsNow      = Date.now();

        // Derivar colunaN do historico Firebase antes de gravar
        firebase.database().ref(`kanban/${eventoId}/historico`).get().then(snap => {
            const hist    = snap.exists() ? snap.val() : {};
            const colunaN = this._derivarColunaN(hist, { tipo: 'rendição', sub: tipo, ts: tsNow + 1 });

            NitFirebase.exec((db, ref, update) => {
                const pushKey = ref(db, `kanban/${eventoId}/historico`).push().key;
                const updates = {};
                updates[`kanban/${eventoId}/historico/${pushKey}`] = {
                    tipo: 'rendição', sub: tipo, equipe, vt, ts: tsNow, operador: NitLogin.operador || 'anon',
                };
                Object.assign(updates, {
                    [`kanban/${eventoId}/equipe`]:        equipe,
                    [`kanban/${eventoId}/viatura`]:       vt,
                    [`kanban/${eventoId}/sub`]:           tipo,
                    [`kanban/${eventoId}/equipeApoio`]:   '',
                    [`kanban/${eventoId}/viaturaApoio`]:  '',
                    [`kanban/${eventoId}/agendamento`]:   null,
                    [`kanban/${eventoId}/coluna`]:        colunaDest,
                    [`kanban/${eventoId}/tsDespacho`]:    tsNow,
                    [`kanban/${eventoId}/operador`]:      NitLogin.operador || 'anon',
                    [`kanban/${eventoId}/colunaN`]:       colunaN || '',
                });
                update(ref(db, '/'), updates);
            });

            const container = document.querySelector(`#${colunaDest} .kanban-cards-container`);
            if (container) container.appendChild(card);
            card.dataset.coluna = colunaDest;
            NitRecursos.aprenderDeDespacho(equipe, vt, tipo);
            showToast('Rendição registrada.', 'success');
            this.fechar();
        });
    },

    // ── Registrar chegada ao local ────────────────────────────────────
    confirmarChegada() {
        const card = this._card; if (!card) return;
        const sv   = this._sv;
        if (parseInt(sv(card.dataset.tsChegada)) > 0) {
            showToast('Chegada já registrada.', 'info'); return;
        }
        const eventoId  = sv(card.dataset.eventoid) || card.id;
        const tsAgora   = Date.now();

        NitFirebase.exec((db, ref, update) =>
            update(ref(db, `kanban/${eventoId}`), {
                tsChegada: tsAgora,
                operador:  NitLogin.operador || 'anon',
            })
        );
        // Atualiza dataset e UI imediatamente (otimista)
        card.dataset.tsChegada = String(tsAgora);
        const d = new Date(tsAgora);
        const horaStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const horaEl  = document.getElementById('central-chegada-hora');
        const btnEl   = document.getElementById('btn-central-chegada');
        const bloco   = document.getElementById('central-chegada-bloco');
        if (horaEl) horaEl.textContent = horaStr;
        if (btnEl)  btnEl.style.display = 'none';
        if (bloco)  bloco.classList.add('chegada-registrada');
        // Reinicia timer para usar tsChegada no OPERAÇÃO
        this._iniciarTimers(card);
        showToast(`Chegada registrada às ${horaStr}.`, 'success');
    },

    confirmarEncerrar() {
        const card = this._card; if (!card) return;
        nitConfirm('⏹️ Encerrar Operação',
            `Encerrar operação do card <strong>${card.dataset.codigo}</strong>?<br>
             A equipe será liberada e o card voltará para <strong>Aguardando</strong>.`,
            () => {
                const eventoId = this._sv(card.dataset.eventoid) || card.id;
                NitFirebase.exec((db, ref, update) => {
                    update(ref(db, `kanban/${eventoId}`), {
                        coluna: 'coluna-espera', sub: null, pl: null,
                        equipe: '', viatura: '', equipeApoio: '', viaturaApoio: '',
                        tsDespacho: null, ts_encerramento: Date.now(),
                        operador: NitLogin.operador || 'anon',
                    });
                });
                const cont = document.querySelector('#coluna-espera .kanban-cards-container');
                if (cont) cont.appendChild(card);
                card.dataset.coluna = 'coluna-espera';
                showToast('Operação encerrada.', 'info');
                this.fechar();
            });
    },

    confirmarNormalizar() {
        const card = this._card; if (!card) return;
        const dEl  = document.getElementById('central-norm-data');
        const hEl  = document.getElementById('central-norm-hora');
        const oEl  = document.getElementById('central-norm-obs');
        if (!dEl?.value || !hEl?.value) { showToast('Informe data e hora de fim.', 'warning'); return; }

        const [y,m,d]  = dEl.value.split('-');
        const dataFimBR = `${d}/${m}/${y}`;
        const horaFimHM = hEl.value.slice(0,5);
        const obsNova   = oEl?.value.trim() || this._sv(card.dataset.observacoes);
        const eventoId  = this._sv(card.dataset.eventoid) || card.id;

        NitFirebase.exec((db, ref, update) =>
            update(ref(db, `kanban/${eventoId}`), {
                coluna: 'coluna-normalizados', status: 'NORMALIZADO',
                data_fim: dataFimBR, hora_fim: horaFimHM,
                observacoes: obsNova, ts_norm: Date.now(),
                operador: NitLogin.operador || 'anon',
            })
        );

        const cont = document.querySelector('#coluna-normalizados .kanban-cards-container');
        if (cont) cont.prepend(card);
        Object.assign(card.dataset, { coluna: 'coluna-normalizados', status: 'NORMALIZADO', data_fim: dataFimBR, hora_fim: horaFimHM });
        showToast(`${card.dataset.codigo} normalizado.`, 'success');
        registrarAcao(`Normalizado: ${card.dataset.codigo} às ${horaFimHM}`);
        this.fechar();
    },

    // ── Setup de eventos ──────────────────────────────────────────────
    inicializar() {
        document.getElementById('btn-central-fechar')
            ?.addEventListener('click', () => this.fechar());

        document.querySelectorAll('.nit-central-tab').forEach(btn =>
            btn.addEventListener('click', () => { if (!btn.disabled) this._abrirAba(btn.dataset.tab); })
        );

        // Tipo buttons por painel
        [['despacho','_tipoDespacho'], ['apoio','_tipoApoio'], ['rendicao','_tipoRendicao']].forEach(([panel, prop]) => {
            document.querySelectorAll(`#central-panel-${panel} .nit-central-tipo-btn`).forEach(btn =>
                btn.addEventListener('click', () => this._selecionarTipo(panel, btn.dataset.tipo, prop))
            );
        });

        // Auto-fill VT + sugestão de tipo ao selecionar equipe
        // Despacho e rendição: auto-fill VT + tipo (pré-seleciona com base no histórico)
        // Apoio: auto-fill VT apenas — tipo não é sobrescrito (usuário define a missão, não o histórico)
        [
            ['central-despacho-equipe', 'central-despacho-vt', 'despacho', '_tipoDespacho', true ],
            ['central-apoio-equipe',    'central-apoio-vt',    'apoio',    '_tipoApoio',    false],
            ['central-rendicao-equipe', 'central-rendicao-vt', 'rendicao', '_tipoRendicao', true ],
        ].forEach(([elEquipe, elVT, panel, prop, autoTipo]) => {
            document.getElementById(elEquipe)?.addEventListener('input', e => {
                const tipo = NitRecursos.autoFillVT(e.target.value, elVT);
                if (tipo && autoTipo) this._selecionarTipo(panel, tipo, prop);
                if (panel === 'rendicao') this._atualizarPreviewRendicao();
            });
        });

        // Preview ao vivo — rendição (VT change)
        ['central-rendicao-vt'].forEach(id =>
            document.getElementById(id)?.addEventListener('input', () => this._atualizarPreviewRendicao())
        );

        // Botões de ação
        const bind = (id, fn) => document.getElementById(id)?.addEventListener('click', () => fn.call(this));
        bind('btn-central-despachar',         this.confirmarDespacho);
        bind('btn-central-encerrar',          this.confirmarEncerrar);
        bind('btn-central-chegada',           this.confirmarChegada);
        bind('btn-central-apoio',             this.confirmarApoio);
        bind('btn-central-rendicao',          this.confirmarRendicao);
        bind('btn-central-executar-rendicao', this.confirmarExecutarRendicao);
        bind('btn-central-cancelar-agend',    this.cancelarAgendamento);
        bind('btn-central-normalizar',        this.confirmarNormalizar);

        // Toggle da observação completa
        document.getElementById('central-obs-toggle')
            ?.addEventListener('click', () => {
                const corpo   = document.getElementById('central-obs-corpo');
                const toggle  = document.getElementById('central-obs-toggle');
                const chevron = toggle?.querySelector('.nit-central-obs-chevron');
                const aberto  = corpo?.style.display === 'none';
                if (corpo)   corpo.style.display  = aberto ? '' : 'none';
                if (toggle)  toggle.setAttribute('aria-expanded', String(aberto));
                if (chevron) chevron.textContent   = aberto ? '▲' : '▼';
            });

        // Toggle do histórico colapsável
        const histHeader = document.getElementById('central-hist-header');
        if (histHeader) {
            const toggleHist = () => {
                const lista   = document.getElementById('central-historico-lista');
                const chevron = document.getElementById('central-hist-chevron');
                const aberto  = lista?.classList.toggle('aberto');
                if (chevron) chevron.textContent = aberto ? '▲' : '▼';
                histHeader.setAttribute('aria-expanded', String(!!aberto));
            };
            histHeader.addEventListener('click', toggleHist);
            histHeader.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHist(); }
            });
        }

        // Toggle de agendamento de rendição
        document.getElementById('central-rendicao-agendar')
            ?.addEventListener('change', function() {
                const campos = document.getElementById('central-rendicao-agendar-campos');
                const btn    = document.getElementById('btn-central-rendicao');
                if (campos) campos.style.display = this.checked ? '' : 'none';
                if (btn)    btn.textContent       = this.checked ? '⏰ Agendar Rendição' : 'Registrar Rendição';
            });

        // Fechar ao clicar fora
        document.getElementById('modal-central-ocorrencia')
            ?.addEventListener('click', e => { if (e.target === e.currentTarget) this.fechar(); });
    },
};

    // ══════════════════════════════════════════════════════════════════
// NitViradaDia — versão compatível com NitProcessamento
// Apenas delega a verificação para o módulo principal.
// Não restaura relatórios automaticamente — isso agora é feito
// pelo NitProcessamento com base em metadados e orientação ao operador.
// ══════════════════════════════════════════════════════════════════
const NitViradaDia = {
    inicializar() {
        // Aguarda DOM e Firebase sincronizarem, então verifica lacuna noturna
        setTimeout(() => {
            if (typeof NitProcessamento !== 'undefined') {
                NitProcessamento.verificar();
            } else {
                console.warn('[NitViradaDia] NitProcessamento não encontrado.');
            }
        }, 1800);
    },
};

    // ═══════════════════════════════════════════════════════════════════════
    // NIT PROCESSAMENTO — rastreabilidade e verificação de turno
    // Registra metadados de cada processamento e orienta o operador da manhã
    // sobre relatórios postados na lacuna noturna (21:30 – 05:30).
    // ═══════════════════════════════════════════════════════════════════════
    const NitProcessamento = {
        _KEY_META:  'nit-ultimo-processamento-v1',
        _KEY_HIST:  'nit-historico-relatorios-v1',
        _MAX_DIAS:  7, // dias mantidos no histórico

        // ── Hash simples para identificar relatórios ─────────────────────
        _hash(str) {
            let h = 0;
            for (let i = 0; i < Math.min(str.length, 300); i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h |= 0;
            }
            return Math.abs(h).toString(16);
        },

        // ── Formata DD/MM/YYYY ────────────────────────────────────────────
        _hojeStr() {
            const d  = new Date();
            return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
        },

        // ── Registra metadados ao final de cada processamento ────────────
        registrar(texto, eventos, dataReferencia) {
            const agora = new Date();
            const meta = {
                dataReferencia,
                data:        this._hojeStr(),
                horario:     agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
                operador:    NitLogin.operador || 'anon',
                turno:       NitLogin.turno    || '',
                totalEventos: eventos.length,
                timestamp:   agora.getTime(),
                hashTexto:   this._hash(texto),
            };

            // Salva o último processamento
            localStorage.setItem(this._KEY_META, JSON.stringify(meta));

            // Salva histórico por dia (não sobrescreve dias anteriores)
            try {
                const hist = JSON.parse(localStorage.getItem(this._KEY_HIST) || '{}');
                const diaKey = meta.data;
                if (!hist[diaKey]) hist[diaKey] = [];
                // Evita duplicata exata (mesmo hash)
                if (!hist[diaKey].some(r => r.hashTexto === meta.hashTexto)) {
                    hist[diaKey].push({
                        ts:          meta.timestamp,
                        horario:     meta.horario,
                        operador:    meta.operador,
                        turno:       meta.turno,
                        totalEventos: meta.totalEventos,
                        hashTexto:   meta.hashTexto,
                        // Texto completo para replay (limitado a 80KB)
                        textoRaw:    texto.length < 80000 ? texto : '[TRUNCADO]',
                    });
                }
                // Limpa dias antigos (mantém _MAX_DIAS)
                const dias = Object.keys(hist).sort((a, b) => {
                    const parse = d => { const [dd,mm,yyyy] = d.split('/'); return new Date(+yyyy,+mm-1,+dd); };
                    return parse(b) - parse(a);
                });
                if (dias.length > this._MAX_DIAS) {
                    dias.slice(this._MAX_DIAS).forEach(d => delete hist[d]);
                }
                localStorage.setItem(this._KEY_HIST, JSON.stringify(hist));
            } catch(e) {
                console.warn('[NitProcessamento] Falha ao salvar histórico:', e.message);
            }

            // Espelha no Firebase para visibilidade multi-operador
            NitFirebase.exec((db, ref, update) =>
                update(ref(db, 'meta/ultimoProcessamento'), meta)
            );
        },

        // ── Verifica se há lacuna desde o último processamento ───────────
        verificar() {
            if (this._verificado) return;
            this._verificado = true;
            const raw = localStorage.getItem(this._KEY_META);
            if (!raw) return; // Primeira vez — sem histórico

            let meta;
            try { meta = JSON.parse(raw); } catch { return; }

            const agora    = new Date();
            const hoje     = this._hojeStr();
            const ontem    = (() => {
                const d = new Date(agora); d.setDate(d.getDate() - 1);
                return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            })();

            // Só exibe modal se o último processamento foi ontem
            if (meta.data !== ontem) return;

            // Extrai hora do último processamento
            const [hh, mm] = meta.horario.split(':').map(Number);
            const foiAposLacuna = hh >= 21 || hh < 6; // entre 21h e 06h

            this._exibirModal(meta, foiAposLacuna);
        },

        // ── Exibe modal orientando o operador da manhã ───────────────────
        _exibirModal(meta, foiAposLacuna) {
            const modal = document.getElementById('modal-virada-dia');
            const corpo = document.getElementById('modal-virada-corpo');
            const btnOk = document.getElementById('btn-virada-ok');
            const btnPr = document.getElementById('btn-virada-processar');
            if (!modal || !corpo) return;

            const lacunaMsg = foiAposLacuna
                ? `<div style="margin-top:14px;padding:12px 14px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:8px;font-size:13px;line-height:1.6;color:var(--color-warning);">
                    <i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>
                    <strong>Atenção:</strong> O último processamento foi às <strong>${meta.horario}</strong>.
                    Se houver relatório postado no WhatsApp <strong>após ${meta.horario.slice(0,5)}</strong> e antes de 23:59, cole e processe antes de continuar.
                  </div>`
                : `<div style="margin-top:14px;padding:10px 14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px;font-size:13px;color:var(--color-success);">
                    <i class="fas fa-check-circle" style="margin-right:6px;"></i>
                    Processamento recente. Nenhuma lacuna detectada.
                  </div>`;

            corpo.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
                    <div style="background:var(--color-bg);border-radius:8px;padding:12px;">
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-tertiary);margin-bottom:4px;">Operador</div>
                        <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);">${meta.operador}</div>
                    </div>
                    <div style="background:var(--color-bg);border-radius:8px;padding:12px;">
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-tertiary);margin-bottom:4px;">Turno</div>
                        <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);">${meta.turno || '—'}</div>
                    </div>
                    <div style="background:var(--color-bg);border-radius:8px;padding:12px;">
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-tertiary);margin-bottom:4px;">Data</div>
                        <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);">${meta.data}</div>
                    </div>
                    <div style="background:var(--color-bg);border-radius:8px;padding:12px;">
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-tertiary);margin-bottom:4px;">Último processamento</div>
                        <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);">${meta.horario.slice(0,5)}</div>
                    </div>
                    <div style="background:var(--color-bg);border-radius:8px;padding:12px;grid-column:1/-1;">
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-tertiary);margin-bottom:4px;">Ocorrências processadas</div>
                        <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);">${meta.totalEventos} evento(s)</div>
                    </div>
                </div>
                ${lacunaMsg}
            `;

            // Botão "Já verifiquei"
            btnOk?.addEventListener('click', () => fecharModal(modal), { once: true });

            // Botão "Processar relatório pendente"
            btnPr?.addEventListener('click', () => {
                fecharModal(modal);
                // Expande sidebar se colapsada e foca na textarea
                if (typeof NitSidebar !== 'undefined') NitSidebar.expandir();
                setTimeout(() => {
                    const ta = document.getElementById('relatorio-bruto-input');
                    ta?.focus();
                    ta?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 200);
            }, { once: true });

            // Fecha ao clicar fora
            modal.addEventListener('click', e => { if (e.target === modal) fecharModal(modal); }, { once: true });

            abrirModal(modal);
        },

        // ── Consulta histórico de um dia ──────────────────────────────────
        historicoDodia(dataStr) {
            try {
                const hist = JSON.parse(localStorage.getItem(this._KEY_HIST) || '{}');
                return hist[dataStr] || [];
            } catch { return []; }
        },

        // ── Replay de um processamento anterior ───────────────────────────
        replay(hashTexto) {
            try {
                const hist = JSON.parse(localStorage.getItem(this._KEY_HIST) || '{}');
                for (const dia of Object.values(hist)) {
                    const reg = dia.find(r => r.hashTexto === hashTexto);
                    if (reg) {
                        console.log('[NitProcessamento] Texto para replay:', reg.textoRaw);
                        return reg.textoRaw;
                    }
                }
                console.warn('[NitProcessamento] Hash não encontrado:', hashTexto);
                return null;
            } catch { return null; }
        },
    };
    window.NitProcessamento = NitProcessamento;
    // 13.1 (laboratório): classificação somente leitura, exposta para a bateria de testes.
    window.NitClassificador = {
        classificar:   (eventos, cards) => Semaforo._classificarLinhas(eventos, cards),
        cardsDoPainel: () => Semaforo._cardsParaClassificacao(),
        parsear:       texto => Semaforo._parsearRelatorio(texto),
    };

    document.addEventListener('DOMContentLoaded', () => {
        inicializarApp().catch(e => console.error('[NIT] Falha crítica:', e));
    });


        // ── Placeholder overlay do círculo ───────────────────────────────
        (function() {
            const ta    = document.getElementById('relatorio-bruto-input');
            const label = document.getElementById('circulo-placeholder-label');
            if (!ta || !label) return;
            const update = () => { label.style.display = ta.value ? 'none' : 'flex'; };
            ta.addEventListener('input', update);
            ta.addEventListener('focus', () => { label.style.opacity = '0.4'; });
            ta.addEventListener('blur',  () => { label.style.opacity = '1'; update(); });
            update();
        })();

        // ── Sidebar overlay (mobile/tablet) ──────────────────────────────
        (function() {
            const sidebar   = document.getElementById('sidebar');
            const backdrop  = document.getElementById('sb-backdrop');
            const hamburger = document.getElementById('btn-sb-hamburger');
            if (!sidebar || !backdrop || !hamburger) return;

            function openSidebar() {
                sidebar.classList.add('sb-open');
                backdrop.classList.add('visible');
                hamburger.querySelector('i').className = 'fas fa-times';
            }
            function closeSidebar() {
                sidebar.classList.remove('sb-open');
                backdrop.classList.remove('visible');
                hamburger.querySelector('i').className = 'fas fa-bars';
            }

            hamburger.addEventListener('click', () => {
                sidebar.classList.contains('sb-open') ? closeSidebar() : openSidebar();
            });
            backdrop.addEventListener('click', closeSidebar);

            // fechar ao redimensionar para desktop
            window.addEventListener('resize', () => {
                if (window.innerWidth > 960) closeSidebar();
            });
        })();
