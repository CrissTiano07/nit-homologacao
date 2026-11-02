// Bateria NIT Móvel fase 1 (31/10/2026): regras da lista do celular (funções puras do movel.js).
const M = require('../movel.js');
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
const DIA = '31/10/2026', agora = new Date(2026, 9, 31, 12, 0).getTime();
const c = (cod, col, ini, extra = {}) => ({ codigo: cod, coluna: col, inicio: ini, dataReferencia: DIA, endereco: `RUA ${cod}`, problema: 'APAGADO', tipo: 'ENEL', ...extra });
const K = {
  '100_a': c('100', 'coluna-espera', '31/10/2026 09:00'),
  '200_a': c('200', 'coluna-espera', '31/10/2026 06:30'),
  '300_a': c('300', 'coluna-espera', '30/10/2026 19:00'),                        // herança: dataReferencia já é hoje
  '400_a': c('400', 'coluna-vl', '31/10/2026 08:00', { equipe: 'FREITAS', viatura: '03', tsDespacho: agora - 25 * 60000 }),
  '500_a': c('500', 'coluna-amc', '31/10/2026 07:00', { equipe: 'LIMA', viatura: 'VT 12', equipeApoio: 'MOURA' }),
  '600_a': c('600', 'coluna-normalizados', '31/10/2026 05:00', { data_fim: DIA, hora_fim: '08:10' }),
  '700_a': c('700', 'coluna-normalizados', '31/10/2026 05:00', { fim: '31/10/2026 11:40' }),
  '800_a': c('800', 'coluna-espera', '31/10/2026 10:00', { status: 'NORMALIZADO' }), // a coluna decide (igual ao computador)
  '900_a': c('900', 'coluna-espera', '30/10/2026 10:00', { dataReferencia: '30/10/2026' }), // ontem: fora
  '950_a': c('950', 'coluna-espera', '31/10/2026 10:00', { retirado: true }),      // retirado do painel: fora
  '960_a': c('960', 'coluna-sem-necessidade', '31/10/2026 10:30'),
  '970_a': c('', 'coluna-xyz', '', { endereco: '' }),                              // coluna desconhecida e sem dados
  'ruim': null,
};
const por = M.montar(K, DIA), t = M.totais(por), ids = g => por[g].map(x => x.codigo).join(',');

reg('MV1', 'Só cards do dia, sem retirados (mesmo critério dos totais do computador)', [
  ck(t.total === 10 && t.pend === 8 && t.norm === 2, `total ${t.total} · pend ${t.pend} · norm ${t.norm} (esperado 10/8/2)`),
  ck(![].concat(...Object.values(por)).some(x => ['900', '950'].includes(x.codigo)), '900 (ontem) e 950 (retirado) fora'),
]);
reg('MV2', 'Aguardando: quem espera há mais tempo primeiro; coluna desconhecida cai em Aguardando', [
  ck(ids('espera') === '300,200,100,800,970', `ordem ${ids('espera')}`),
]);
reg('MV3', 'Normalizados: o mais recente primeiro; a coluna decide, não o status (igual ao computador)', [
  ck(ids('norm') === '700,600', `ordem ${ids('norm')}`),
]);
const L = (cod, g) => M.linha(por[g].find(x => x.codigo === cod), g, agora);
reg('MV4', 'Tempo de espera e alerta (2h ou mais em Aguardando fica vermelho)', [
  ck(L('100', 'espera').tempo === 'há 3h00' && L('100', 'espera').alerta, `100: ${L('100', 'espera').tempo}, alerta ${L('100', 'espera').alerta}`),
  ck(L('300', 'espera').tempo === 'há 17h00', `300 (herança): ${L('300', 'espera').tempo}`),
  ck(M.desde(agora - 59000, agora) === 'agora' && M.desde(agora - 25 * 60000, agora) === 'há 25 min' && M.desde(agora - 27 * 3600000, agora) === 'há 1d 3h', 'agora / há 25 min / há 1d 3h'),
  ck(L('970', 'espera').tempo === '' && L('970', 'espera').titulo === '(sem endereço)' && !L('970', 'espera').alerta, 'card sem início e sem endereço não quebra'),
]);
reg('MV5', 'Via Livre e AMC mostram equipe, viatura e apoio', [
  ck(L('400', 'vl').sub === 'FREITAS · VT 03' && L('400', 'vl').tempo === 'desp. há 25 min', `400: ${L('400', 'vl').sub} | ${L('400', 'vl').tempo}`),
  ck(L('500', 'amc').sub === 'LIMA · VT 12 + apoio MOURA', `500: ${L('500', 'amc').sub}`),
  ck(L('700', 'norm').tempo === 'às 11:40' && L('600', 'norm').tempo === 'às 08:10', `normalizados: ${L('700', 'norm').tempo}, ${L('600', 'norm').tempo}`),
]);
reg('MV6', 'Busca por código, endereço, causa e equipe', [
  ck(M.busca(K['400_a'], 'frei') && M.busca(K['400_a'], '400') && M.busca(K['400_a'], 'rua 4') && M.busca(K['400_a'], 'enel'), 'acha por equipe, código, endereço, causa'),
  ck(!M.busca(K['400_a'], 'xyz') && M.busca(K['400_a'], '  '), 'não acha o que não tem; busca vazia mostra tudo'),
]);
reg('MV7', 'Chave do e-mail igual à do NIT (nit_admins / usuarios_autorizados)', [
  ck(M.chave(' Fulano.Silva@Gmail.com ') === 'fulano|silva|gmail|com' && M.chave('') === null && M.chave(null) === null, M.chave(' Fulano.Silva@Gmail.com ')),
]);
reg('MV8', '"novo" é por card E grupo: mudar de coluna conta como novidade', [
  ck(M.marcaVista({ eventoId: 'x' }, 'espera') !== M.marcaVista({ eventoId: 'x' }, 'vl'), 'x@espera ≠ x@vl'),
]);
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
reg('MV9', 'Plataforma para a instrução certa (iPhone, iPad, Android, computador)', [
  ck(M.plataforma(IOS, 5) === 'ios' && M.plataforma(IPAD, 5) === 'ios' && M.plataforma(IPAD, 0) === 'outro' && M.plataforma(AND, 5) === 'android' && M.plataforma('', 0) === 'outro', 'ios / ipad / mac / android / vazio'),
]);
const lc = M.linkChrome('https://crisstiano07.github.io/nit-homologacao/movel.html?x=1#y');
reg('MV10', 'Android: link que abre o mesmo endereço no Chrome, com volta ao endereço normal sem Chrome', [
  ck(lc.startsWith('intent://crisstiano07.github.io/nit-homologacao/movel.html?x=1#Intent;scheme=https;package=com.android.chrome;') && lc.includes('S.browser_fallback_url=https%3A%2F%2Fcrisstiano07.github.io%2Fnit-homologacao%2Fmovel.html%3Fx%3D1%23y') && lc.endsWith(';end'), lc),
]);
reg('MV11', 'Erro de login sempre com motivo e código (nenhum erro mudo)', [
  ck(M.motivo('auth/popup-blocked') === 'Este navegador bloqueou a janela do Google. (auth/popup-blocked)', M.motivo('auth/popup-blocked')),
  ck(M.motivo('auth/xyz') === 'Não foi possível entrar. (auth/xyz)' && M.motivo(undefined) === 'Não foi possível entrar. (sem código)', `${M.motivo('auth/xyz')} | ${M.motivo(undefined)}`),
]);
// ── login ir e voltar pela própria página
const jwt = p => ['e30', Buffer.from(JSON.stringify(p)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), 'x'].join('.');
const u = new URL(M.urlGoogle('123.apps.googleusercontent.com', 'https://crisstiano07.github.io/nit-homologacao/movel.html', 'N1', 'S1'));
reg('MV12', 'Pedido ao Google: só comprovante de identidade (id_token), com nonce e state, voltando ao próprio movel.html', [
  ck(u.origin + u.pathname === 'https://accounts.google.com/o/oauth2/v2/auth', u.origin + u.pathname),
  ck(u.searchParams.get('response_type') === 'id_token' && u.searchParams.get('scope') === 'openid email profile', 'response_type=id_token, scope openid email profile (sem token de acesso)'),
  ck(u.searchParams.get('nonce') === 'N1' && u.searchParams.get('state') === 'S1' && u.searchParams.get('redirect_uri') === 'https://crisstiano07.github.io/nit-homologacao/movel.html', 'nonce, state e endereço de volta'),
]);
const G = { nonce: 'N1', state: 'S1', ts: agora - 60000 }, tok = jwt({ nonce: 'N1', email: 'cristianovlivre@gmail.com' });
const ret = h => M.conferirRetorno(M.lerRetorno(h), G, agora);
reg('MV13', 'Volta do Google: aceita só o que este aparelho pediu', [
  ck(M.lerRetorno('') === null && M.lerRetorno('#x=1') === null, 'sem retorno → nada a fazer'),
  ck(ret(`#state=S1&id_token=${tok}`).ok && ret(`#state=S1&id_token=${tok}`).email === 'cristianovlivre@gmail.com', 'certo → aceita'),
  ck(!ret(`#state=OUTRO&id_token=${tok}`).ok, 'state diferente → recusa'),
  ck(!ret(`#state=S1&id_token=${jwt({ nonce: 'N2' })}`).ok, 'nonce diferente → recusa'),
  ck(!M.conferirRetorno(M.lerRetorno(`#state=S1&id_token=${tok}`), { ...G, ts: agora - 11 * 60000 }, agora).ok, 'mais de 10 min → recusa'),
  ck(!M.conferirRetorno(M.lerRetorno(`#state=S1&id_token=${tok}`), null, agora).ok, 'sem pedido guardado → recusa'),
  ck(ret('#error=access_denied&state=S1').motivo === 'Login cancelado no Google.', ret('#error=access_denied&state=S1').motivo),
  ck(M.payloadJwt('lixo') === null, 'comprovante ilegível não quebra'),
]);
// ── ADM no celular: limpar / restaurar / causas
{ const kb = { a_1: { codigo: 'a' }, b_2: { codigo: 'b' } }, lix = {}; for (let i = 1; i <= 5; i++) lix[`c${i}`] = { ts: i };
  const { lote, cards } = M.montarLimpeza({ kanban: kb, decisoes: { x: 1 }, lixeira: lix, ts: 99, por: 'Cris', email: 'c@x', turno: 'manha', dia: '01112026', chaveAud: 'K' });
  reg('MV14', 'Limpar: mesmo lote do computador + LINHA DO TEMPO na mesma gravação; lixeira fica com 5', [
    ck(cards === 2 && lote.kanban === null && lote['meta/decisoes_ativas'] === null && lote['meta/dataReferencia'] === null, 'apaga cards, avisos e dataReferencia'),
    ck(lote['lixeira/c99'].cards === 2 && lote['lixeira/c99'].kanban === kb && lote['lixeira/c99'].decisoes_ativas.x === 1 && lote['lixeira/c99'].por === 'Cris', 'cópia completa'),
    ck(lote['meta/ultimoReset'].operador === 'Cris' && lote['meta/ultimoReset'].turno === 'manha', 'ultimoReset com quem e turno'),
    ck(lote['auditoria/01112026/K'].linhas[0] === '🧹 Painel limpo (2 cards). Cópia guardada.' && lote['auditoria/01112026/K'].tipo === 'acao', 'LINHA DO TEMPO'),
    ck(lote['lixeira/c1'] === null && !('lixeira/c2' in lote), 'apaga só a cópia mais antiga (fica com 5)'),
  ]); }
{ const lix = { c1: { ts: 1, kanban: { a_1: { q: 1 } } }, c2: { ts: 2, kanban: { a_1: { q: 2 }, b_2: { q: 2 } }, decisoes_ativas: { d: 1 } } };
  const r = M.montarRestauro({ lixeira: lix, kanban: { b_2: { novo: true }, z_9: {} }, decisoes: null, ts: 5, por: 'Cris', dia: 'D', chaveAud: 'K' });
  const r2 = M.montarRestauro({ lixeira: { c2: { ...lix.c2, restauradoTs: 3 } }, kanban: {}, decisoes: null, ts: 5, por: 'Cris', dia: 'D', chaveAud: 'K' });
  reg('MV15', 'Restaurar: a última cópia; quem entrou depois fica; não restaura duas vezes', [
    ck(r.copia === 'c2' && r.n === 1 && r.lote['kanban/a_1'].q === 2 && !('kanban/b_2' in r.lote), `devolve a_1, mantém b_2 atual (n=${r.n})`),
    ck(r.lote['meta/decisoes_ativas'].d === 1 && r.lote['lixeira/c2/restauradoTs'] === 5 && r.lote['auditoria/D/K'].linhas[0] === '↩ Painel restaurado (1 cards).', 'avisos, marca e LINHA DO TEMPO'),
    ck(r2 === null && M.montarRestauro({ lixeira: null }) === null, 'já restaurada ou sem cópia: nada'),
  ]); }
{ const por = M.montar({ ...K, s1: c('s1', 'coluna-espera', '31/10/2026 09:00', { tipo: '' }), f1: c('f1', 'coluna-vl', '31/10/2026 09:00', { tipo: 'furto' }), f2: c('f2', 'coluna-normalizados', '31/10/2026 09:00', { tipo: 'FURTO' }) }, DIA), cs = M.causas(por);
  reg('MV16', 'CAUSAS DO DIA (mesmo critério do computador) e conferência da palavra', [
    ck(JSON.stringify(cs) === '[["ENEL",10],["FURTO",2],["SEM CAUSA",1]]', JSON.stringify(cs)),
    ck(M.confere(' limpar ', 'LIMPAR') && !M.confere('LIMPA', 'LIMPAR') && !M.confere('', 'LIMPAR'), 'palavra'),
  ]); }
{ const G = n => M.GRUPOS.find(g => g.id === n), A = new Date(2026, 10, 1, 21, 0).getTime();
  const nrm = { codigo: '293', inicio: '01/11/2026 14:59', data_fim: '01/11/2026', hora_fim: '15:32', problema: 'APAGADO', tipo: 'FALHA DE EQUIPAMENTO',
    colunaN: 'VIA LIVRE → AMC', equipe: 'FREITAS', viatura: '03', equipeApoio: 'LIMA', viaturaApoio: 'VT 12' };
  const cn = M.camposDetalhe(nrm, G('norm'), A), ks = cn.map(x => x[0]).join(',');
  const so = M.camposDetalhe({ codigo: '1', inicio: '01/11/2026 14:59', fim: '01/11/2026 16:04' }, G('norm'), A);
  reg('MV17', 'Detalhes do normalizado: só início, fim, tempo aberto e quem atuou (sem problema/causa)', [
    ck(ks === 'Início,Fim,Tempo aberto,Atuou', ks),
    ck(cn[2][1] === '33 min' && cn[3][1] === 'VIA LIVRE → AMC · FREITAS · VT 03 + LIMA · VT 12', `${cn[2][1]} | ${cn[3][1]}`),
    ck(so.map(x => x[0]).join(',') === 'Início,Fim,Tempo aberto' && so[2][1] === '1h05', 'sem equipe: não mostra "Atuou"; fim pelo campo "fim"'),
    ck(M.duracao(0, 27 * 3600000) === '1d 3h' && M.duracao(5, 1) === '' && M.duracao(null, 1) === '', 'duração longa / fim antes do início / sem início'),
    ck(M.camposDetalhe(nrm, G('espera'), A).map(x => x[0]).includes('Problema'), 'pendentes continuam com problema e causa'),
  ]); }
const f = R.filter(x => x !== 'PASSOU').length;
console.log('RESUMO movel', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
process.exit(f ? 1 : 0);
