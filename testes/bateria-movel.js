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
const f = R.filter(x => x !== 'PASSOU').length;
console.log('RESUMO movel', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
process.exit(f ? 1 : 0);
