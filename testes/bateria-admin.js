// Bateria 13.2.2 — ADM limpa o painel (com cópia) e restaura. Pedido do supervisor, decisões do Cristiano em 24/10/2026:
// limpa painel + avisos; a LINHA DO TEMPO fica; cópia para RESTAURAR. (As REGRAS do banco são testadas à parte, no emulador.)
const h = require('./harness');
const { montar } = require('./estresse-mundo');
const D = '24/10/2026', t = x => `${D} ${x}`, ISO = '2026-10-24T14:00:00';
const doc = n => n.w.document;
const R = [];
const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
async function proc(n, p, q) { await h.processar(n, montar(D, p, q)); while (h.modalAberto(n)) await h.responderModal(n, true); await h.dormir(500); }
const cards = n => doc(n).querySelectorAll('#tab-semaforo .kanban-card').length;
const kb = n => Object.keys(n.fb.estado().kanban || {});
const lix = n => Object.values(n.fb.estado().lixeira || {});
const campo = n => doc(n).getElementById('nit-confirmar-digitar-campo');
const okBtn = n => doc(n).getElementById('btn-confirmar-generico-ok');
function digitar(n, txt) { const c = campo(n); c.value = txt; c.dispatchEvent(new n.w.Event('input')); }
function enter(n) { campo(n).dispatchEvent(new n.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
const ADM = { nit_admins: { 'teste|nit|local': true } };
const REL = [[{ cod: '601', ini: t('06:50') }, { cod: '602', ini: '' }], [{ cod: '608', ini: t('06:00'), fim: t('06:40') }]];
(async () => {
  // AD1 — quem não é ADM não vê o botão
  { const A = await h.subirNIT({ estado: {}, relogioIso: ISO }); await h.dormir(400); await proc(A, ...REL);
    reg('AD1', 'Operador comum: sem botão de limpar', [
      ck(!doc(A).getElementById('nit-admin-limpar'), 'sem 🧹 LIMPAR PAINEL'),
      ck(A.w.NitAdmin.ehAdmin === false, 'NitAdmin.ehAdmin = false'),
    ]);
    A.w.NitAdmin.limpar(); await h.dormir(200);
    reg('AD1b', 'Chamar a função sem ser ADM não faz nada', [ck(!h.modalAberto(A) && kb(A).length === 3, `nada apagado (${kb(A).length} cards no banco)`)]);
    A.dom.window.close(); }

  // AD2..AD4 — ADM limpa, a outra janela vê, restaura
  const fb = h.criarFirebaseFalso(ADM, h.criarRelogio(ISO));
  const A = await h.subirNIT({ estado: ADM, relogioIso: ISO, fb }), B = await h.subirNIT({ estado: ADM, relogioIso: ISO, fb });
  await h.dormir(400); await proc(A, ...REL); await h.dormir(400);
  const btn = doc(A).getElementById('nit-admin-limpar');
  const antes = { a: cards(A), b: cards(B), dec: !!doc(B).querySelector('#nit-integridade-processamento .nd-card') };
  reg('AD2', 'ADM vê o botão; antes de limpar', [
    ck(btn && /LIMPAR PAINEL/.test(btn.textContent), 'botão 🧹 LIMPAR PAINEL no topo'),
    ck(doc(A).getElementById('nit-admin-restaurar')?.style.display === 'none', 'RESTAURAR escondido (nada limpo ainda)'),
    ck(antes.a === 3 && antes.b === 3 && antes.dec, `3 cards nas duas janelas e um aviso (602 sem hora) — ${JSON.stringify(antes)}`),
  ]);
  btn.click(); await h.dormir(200);
  const m = h.modalAberto(A);
  await h.responderModal(A, false); await h.dormir(300);
  const cancelou = kb(A).length === 3;
  // 14.3: sem digitar a palavra, nem clique nem Enter limpam
  btn.click(); await h.dormir(200);
  const trava = { campo: !!campo(A), bloqueado: okBtn(A).disabled };
  await h.responderModal(A, true); enter(A); await h.dormir(300);
  const naoLimpouSemDigitar = kb(A).length === 3 && !!h.modalAberto(A);
  digitar(A, 'LIMPA'); const meio = okBtn(A).disabled; enter(A); await h.dormir(300);
  const naoLimpouErrado = kb(A).length === 3;
  digitar(A, 'limpar '); const liberou = !okBtn(A).disabled;
  reg('AD6', 'LIMPAR só depois de digitar a palavra (pedido do Cristiano em 31/10)', [
    ck(trava.campo && trava.bloqueado, `campo para digitar e botão LIMPAR travado (${JSON.stringify(trava)})`),
    ck(naoLimpouSemDigitar, 'clique em LIMPAR e Enter sem digitar: nada apagado, pergunta continua aberta'),
    ck(meio && naoLimpouErrado, '"LIMPA" (incompleto): continua travado, Enter não apaga'),
    ck(liberou, '"limpar " (minúsculas e espaço): libera'),
  ]);
  enter(A); await h.dormir(900);
  const aud = JSON.stringify(A.fb.estado().auditoria || {});
  const l = lix(A);
  reg('AD3', 'Limpar: pergunta, CANCELAR não apaga, LIMPAR apaga para todos e guarda cópia', [
    ck(m && /LIMPAR O PAINEL\?/.test(m.titulo) && /3 cards/.test(m.msg) && /RESTAURAR/.test(m.msg), `pergunta: "${m?.titulo} — ${m?.msg}"`),
    ck(cancelou, 'CANCELAR: nada apagado'),
    ck(kb(A).length === 0, `banco sem cards (${kb(A).length})`),
    ck(cards(A) === 0 && cards(B) === 0, `painel vazio nas duas janelas (A ${cards(A)} · B ${cards(B)})`),
    ck(!doc(B).querySelector('#nit-integridade-processamento .nd-card') && !A.fb.estado().meta?.decisoes_ativas, 'avisos limpos (também na outra janela)'),
    ck(l.length === 1 && l[0].cards === 3 && Object.keys(l[0].kanban || {}).length === 3, `cópia na lixeira com 3 cards (${l.length} cópia)`),
    ck(/Painel limpo \(3 cards\)\. Cópia guardada\./.test(aud), 'LINHA DO TEMPO registra "🧹 Painel limpo (3 cards). Cópia guardada."'),
    ck(doc(A).getElementById('nit-admin-restaurar')?.style.display === '', 'botão ↩ RESTAURAR aparece'),
  ]);
  reg('AD7', 'Depois de limpar, outras perguntas voltam ao normal (sem campo, botão liberado)', [
    ck(!campo(A) && !okBtn(A).disabled, `campo: ${!!campo(A)} · botão travado: ${okBtn(A).disabled}`),
  ]);
  // entra um card novo depois da limpeza; restaurar junta os dois
  await proc(A, [{ cod: '700', ini: t('13:50') }], []);
  doc(A).getElementById('nit-admin-restaurar').click(); await h.dormir(200);
  const tr = { campo: !!campo(A), bloqueado: okBtn(A).disabled, rotulo: doc(A).querySelector('#nit-confirmar-digitar strong')?.textContent };
  await h.responderModal(A, true); enter(A); await h.dormir(300);
  const naoRestaurou = kb(A).length === 1 && !!h.modalAberto(A);
  digitar(A, 'LIMPAR'); const outraPalavra = okBtn(A).disabled;
  reg('AD9', 'RESTAURAR só depois de digitar RESTAURAR (pedido do Cristiano em 31/10)', [
    ck(tr.campo && tr.bloqueado && tr.rotulo === 'RESTAURAR', `campo pede RESTAURAR e o botão está travado (${JSON.stringify(tr)})`),
    ck(naoRestaurou, 'clique e Enter sem digitar: nada volta, pergunta continua aberta'),
    ck(outraPalavra, '"LIMPAR" não serve para restaurar'),
  ]);
  digitar(A, 'restaurar'); enter(A); await h.dormir(900);
  const ids = kb(A).sort();
  reg('AD4', 'Restaurar devolve os cards e mantém os que entraram depois', [
    ck(ids.length === 4 && ids.some(i => i.startsWith('700_')), `banco: ${ids.join(', ')}`),
    ck(cards(A) === 4 && cards(B) === 4, `as duas janelas com 4 cards (A ${cards(A)} · B ${cards(B)})`),
    ck(doc(A).getElementById('nit-admin-restaurar')?.style.display === 'none', 'RESTAURAR some (já restaurado)'),
    ck(/Painel restaurado \(3 cards\)/.test(JSON.stringify(A.fb.estado().auditoria || {})), 'LINHA DO TEMPO registra "↩ Painel restaurado (3 cards)."'),
  ]);
  // AD5 — guarda só as últimas 5 cópias
  for (let i = 0; i < 6; i++) { await A.w.NitAdmin._limpar(); await h.dormir(150); await proc(A, [{ cod: String(800 + i), ini: t('13:55') }], []); }
  // AD8 — cancelar com a palavra pela metade não deixa a próxima pergunta travada
  doc(A).getElementById('nit-admin-limpar').click(); await h.dormir(200); digitar(A, 'LIM'); await h.responderModal(A, false);
  doc(A).getElementById('nit-admin-restaurar').style.display = ''; A.w.NitAdmin.restaurar(); await h.dormir(200);
  reg('AD8', 'CANCELAR no meio da digitação: a pergunta seguinte (RESTAURAR) começa limpa, com a palavra dela', [
    ck(campo(A)?.value === '' && okBtn(A).disabled && doc(A).querySelector('#nit-confirmar-digitar strong')?.textContent === 'RESTAURAR' && /RESTAURAR/.test(h.modalAberto(A)?.titulo || ''),
      `campo vazio: ${campo(A)?.value === ''} · travado: ${okBtn(A).disabled} · palavra: ${doc(A).querySelector('#nit-confirmar-digitar strong')?.textContent}`),
  ]);
  await h.responderModal(A, false);
  reg('AD5', 'Lixeira guarda só as últimas 5 cópias (plano gratuito)', [ck(lix(A).length === 5, `${lix(A).length} cópias`)]);
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO admin', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(0);
})();
