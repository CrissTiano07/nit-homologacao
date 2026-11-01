// Bateria NIT Móvel (01/11/2026): LIMPAR/RESTAURAR pelo celular têm o MESMO efeito do botão do computador (BR-ADM-001).
// Roda contra o NIT de verdade (jsdom): o computador limpa num banco; o celular limpa em outro, igual; compara os bancos
// e confere que as janelas de computador abertas reagem à gravação do celular.
const h = require('./harness');
const M = require('../movel.js');
const { montar } = require('./estresse-mundo');
const D = '24/10/2026', t = x => `${D} ${x}`, ISO = '2026-10-24T14:00:00', DIA = '24102026';
const ADM = { nit_admins: { 'teste|nit|local': true } };
const REL = [[{ cod: '601', ini: t('06:50') }, { cod: '602', ini: '' }], [{ cod: '608', ini: t('06:00'), fim: t('06:40') }]];
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
const doc = n => n.w.document;
const cards = n => doc(n).querySelectorAll('#tab-semaforo .kanban-card').length;
async function proc(n, p, q) { await h.processar(n, montar(D, p, q)); while (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(500); }
// o que importa comparar (sem horários e chaves geradas)
const resumo = e => {
  const lix = Object.values(e.lixeira || {});
  const aud = Object.values((e.auditoria || {})[DIA] || {}).flatMap(x => x.linhas || []).filter(l => /Painel/.test(l));
  return JSON.stringify({ kanban: Object.keys(e.kanban || {}).sort(), decisoes: !!(e.meta || {}).decisoes_ativas, dataRef: (e.meta || {}).dataReferencia || null,
    reset: (e.meta || {}).ultimoReset ? { operador: e.meta.ultimoReset.operador, turno: e.meta.ultimoReset.turno } : null,
    lixeira: lix.map(c => ({ cards: c.cards, por: c.por, email: c.email, kanban: Object.keys(c.kanban || {}).sort(), dec: !!c.decisoes_ativas, rest: !!c.restauradoTs })), aud });
};
(async () => {
  // mesmo painel inicial nos dois bancos
  const fb0 = h.criarFirebaseFalso(ADM, h.criarRelogio(ISO));
  const P = await h.subirNIT({ estado: ADM, relogioIso: ISO, fb: fb0 }); await h.dormir(400); await proc(P, ...REL); await h.dormir(400);
  const inicial = fb0.estado(); P.dom.window.close();

  // 1) computador limpa
  const fbA = h.criarFirebaseFalso(inicial, h.criarRelogio(ISO));
  const A = await h.subirNIT({ estado: inicial, relogioIso: ISO, fb: fbA }); await h.dormir(600);
  await A.w.NitAdmin._limpar(); await h.dormir(800);
  const depoisPC = fbA.estado();

  // 2) celular limpa (com um computador aberto no mesmo banco)
  const fbB = h.criarFirebaseFalso(inicial, h.criarRelogio(ISO));
  const B = await h.subirNIT({ estado: inicial, relogioIso: ISO, fb: fbB }); await h.dormir(600);
  const antesB = { cards: cards(B), aviso: !!doc(B).querySelector('#nit-integridade-processamento .nd-card') };
  const db = fbB.firebase.database(), ler = async p => (await db.ref(p).get()).val();
  const ts = Date.now();
  const L = M.montarLimpeza({ kanban: await ler('kanban'), decisoes: await ler('meta/decisoes_ativas'), lixeira: await ler('lixeira'),
    ts, por: 'Operador Teste', email: 'teste@nit.local', turno: 'manha', dia: DIA, chaveAud: db.ref(`auditoria/${DIA}`).push().key });
  await db.ref().update(L.lote); await h.dormir(800);
  const depoisCel = fbB.estado();
  reg('PA1', 'LIMPAR pelo celular deixa o banco igual ao LIMPAR do computador', [
    ck(resumo(depoisCel) === resumo(depoisPC), `computador: ${resumo(depoisPC)}\n     celular:    ${resumo(depoisCel)}`),
  ]);
  reg('PA2', 'Computador aberto reage na hora à limpeza feita pelo celular', [
    ck(antesB.cards === 3 && antesB.aviso, `antes: ${JSON.stringify(antesB)}`),
    ck(cards(B) === 0 && !doc(B).querySelector('#nit-integridade-processamento .nd-card'), `depois: ${cards(B)} cards, aviso ${!!doc(B).querySelector('#nit-integridade-processamento .nd-card')}`),
  ]);

  // 3) restaurar: computador x celular
  await A.w.NitAdmin._restaurar(); await h.dormir(800); const restPC = fbA.estado();
  const Rr = M.montarRestauro({ lixeira: await ler('lixeira'), kanban: await ler('kanban'), decisoes: await ler('meta/decisoes_ativas'),
    ts: Date.now(), por: 'Operador Teste', dia: DIA, chaveAud: db.ref(`auditoria/${DIA}`).push().key });
  await db.ref().update(Rr.lote); await h.dormir(900); const restCel = fbB.estado();
  reg('PA3', 'RESTAURAR pelo celular = RESTAURAR do computador; o computador aberto mostra os cards de volta', [
    ck(resumo(restCel) === resumo(restPC), `computador: ${resumo(restPC)}\n     celular:    ${resumo(restCel)}`),
    ck(cards(B) === 3, `computador aberto: ${cards(B)} cards`),
  ]);
  A.dom.window.close(); B.dom.window.close();
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO movel-paridade', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(f ? 1 : 0);
})();
