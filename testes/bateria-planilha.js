// Bateria 14.0 — relatório da planilha: processa sozinho (uma janela só), avisa forte quando para.
const h = require('./harness');
const { montarRelatorio } = require(process.env.MONTAR || './planilha-montar.js');
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
const doc = n => n.w.document;
const btn = n => doc(n).getElementById('sb-estado');
const faixa = n => doc(n).getElementById('nit-planilha-faixa');
const aud = n => JSON.stringify(n.fb.estado().auditoria || {});
const conta = (t, re) => (t.match(re) || []).length;
const lin = (scn, ini, fim, causa = 'ENEL') => { const [di, hi] = ini.split(' '), [df = '', hf = ''] = (fim || '').split(' ');
  return [scn, `RUA ${scn} & AV TESTE`, di, 'JORDAN', 'APAGADO', causa, di, hi, ini, df, hf, fim || '', '', '', '', '', `obs ${scn}`]; };
const ISO = '2026-10-28T11:00:00', T0 = new Date(ISO).getTime();
let ver = 0;
const fonte = (linhas, { D = '28/10/2026', em = T0 } = {}) => { const r = montarRelatorio(linhas, D);
  return { conteudo: { texto: r.texto, dataReferencia: D, geradoEm: em, pendentes: r.pendentes, normalizados: r.normalizados, itens: r.itens, assinatura: 'v' + (++ver) }, verificadoEm: em }; };
const relogio = (ns, iso) => ns.forEach(n => n.relogio.definir(iso));
(async () => {
  { const A = await h.subirNIT({ estado: {}, relogioIso: ISO }); await h.dormir(400);
    reg('PA1', 'Sem fonte_planilha: nada aparece', [ck(!/PLANILHA/.test(btn(A)?.textContent || '') && !faixa(A), `sem planilha na linha de estado ("${btn(A)?.textContent}") e sem faixa`)]); A.dom.window.close(); }

  const L1 = [lin('965', '28/10/2026 10:44'), lin('611', '28/10/2026 10:44'), lin('311', '28/10/2026 08:15', '28/10/2026 08:34')];
  const ini = { fonte_planilha: fonte(L1) };
  const fb = h.criarFirebaseFalso(ini, h.criarRelogio(ISO));
  const A = await h.subirNIT({ estado: ini, relogioIso: ISO, fb }), B = await h.subirNIT({ estado: ini, relogioIso: ISO, fb });
  await h.dormir(2500);
  const pa = h.painel(A), pb = h.painel(B);
  reg('PA2', 'Duas janelas abertas: processa sozinho, uma vez só, e as duas mostram o mesmo', [
    ck(conta(aud(A), /processado sozinho/g) === 1, `LINHA DO TEMPO: ${conta(aud(A), /processado sozinho/g)} processamento automático`),
    ck(+pa.pendentes === 2 && +pa.normalizados === 1 && +pb.pendentes === 2 && +pb.normalizados === 1, `A P${pa.pendentes}/N${pa.normalizados} · B P${pb.pendentes}/N${pb.normalizados} (planilha P2/N1)`),
    ck(/^✓ ATUALIZADO \d\d:\d\d · PLANILHA$/.test(btn(A).textContent) && /^✓ ATUALIZADO \d\d:\d\d · PLANILHA$/.test(btn(B).textContent), `botões: "${btn(A).textContent}" / "${btn(B).textContent}"`),
    ck(!faixa(A) && !faixa(B), 'sem faixa vermelha'),
  ]);
  // 965 normaliza na planilha
  const L2 = L1.slice(); L2[0] = lin('965', '28/10/2026 10:44', '28/10/2026 11:20');
  relogio([A, B], '2026-10-28T11:21:00');
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte(L2, { em: T0 + 21 * 60000 })); await h.dormir(2500);
  reg('PA3', 'A planilha muda: o painel acompanha sozinho', [
    ck(+h.painel(A).pendentes === 1 && +h.painel(B).normalizados === 2, `A P${h.painel(A).pendentes}/N${h.painel(A).normalizados} · B P${h.painel(B).pendentes}/N${h.painel(B).normalizados} (planilha P1/N2)`),
    ck(conta(aud(A), /processado sozinho/g) === 2, `${conta(aud(A), /processado sozinho/g)} processamentos automáticos no total`),
  ]);
  // automação para: 3 min sem verificação
  relogio([A, B], '2026-10-28T11:24:30'); A.w.NitPlanilha._render(); B.w.NitPlanilha._render();
  const semPisca = !faixa(A) && !faixa(B);   // 1º sinal de parada: ainda não declara (precisa durar 30 s)
  relogio([A, B], '2026-10-28T11:25:05'); A.w.NitPlanilha._render(); B.w.NitPlanilha._render(); await h.dormir(300);
  reg('PA4', 'Automação parou (3 min): faixa vermelha nas duas janelas, com a ação', [
    ck(semPisca, 'no 1º sinal ainda não declara (confirma em 30 s)'),
    ck(faixa(A) && /PLANILHA PAROU ÀS 11:21 · COLE O RELATÓRIO DO WHATSAPP/.test(faixa(A).textContent) && faixa(B), `faixa: "${faixa(A)?.textContent}"`),
    ck(btn(A).classList.contains('parada') && /PLANILHA PAROU 11:21 · COLE O RELATÓRIO/.test(btn(A).textContent) && /há 4 min/.test(btn(A).title), `botão: "${btn(A).textContent}"`),
    ck(doc(A).body.classList.contains('nit-planilha-parada'), 'campo de colar o relatório em destaque'),
    ck(conta(aud(A), /Planilha parou/g) >= 1, 'LINHA DO TEMPO registra a parada'),
  ]);
  // operador cola o relatório do WhatsApp: funciona normalmente
  await h.processar(A, fonte(L2).conteudo.texto); while (h.modalAberto(A)) await h.responderModal(A, true); await h.dormir(800);
  reg('PA5', 'Com a faixa, colar o relatório funciona como sempre', [ck(+h.painel(A).pendentes === 1, `A P${h.painel(A).pendentes}/N${h.painel(A).normalizados}`)]);
  // voltou
  await A.w.NitFirebase.db.ref('fonte_planilha/verificadoEm').set(new Date('2026-10-28T11:24:30').getTime()); await h.dormir(400);
  A.w.NitPlanilha._render(); B.w.NitPlanilha._render();
  reg('PA6', 'Automação voltou: a faixa some sozinha', [ck(!faixa(A) && !faixa(B) && /Planilha voltou/.test(aud(A)), 'faixa sumiu; LINHA DO TEMPO: "✓ Planilha voltou."')]);
  // impedimentos: relatório de outra data, e texto colado esperando
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte([...L2, lin('700', '27/10/2026 23:00')], { D: '27/10/2026', em: new Date('2026-10-28T11:24:30').getTime() })); await h.dormir(2000);
  reg('PA7', 'Relatório com data diferente de hoje: não processa sozinho; o botão pede o operador', [
    ck(conta(aud(A), /processado sozinho/g) === 2, `${conta(aud(A), /processado sozinho/g)} automáticos (continua 2)`),
    ck(btn(A).classList.contains('precisa') && /NOVIDADE/.test(btn(A).textContent) && /data diferente/.test(btn(A).title), `botão: "${btn(A).textContent}" — ${btn(A).title}`),
  ]);
  doc(B).getElementById('relatorio-bruto-input').value = 'colando...';
  doc(A).getElementById('relatorio-bruto-input').value = 'colando...';
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte([...L2, lin('701', '28/10/2026 11:23')], { em: new Date('2026-10-28T11:24:30').getTime() })); await h.dormir(2000);
  reg('PA8', 'Operador colando um relatório: a automação espera', [ck(conta(aud(A), /processado sozinho/g) === 2, `${conta(aud(A), /processado sozinho/g)} automáticos (continua 2)`)]);
  // ── avisos de mudança ──
  const notifs = []; for (const n of [A, B]) { n.w.Notification = class { constructor(t, o) { notifs.push({ t, body: o.body, tag: o.tag }); } static get permission() { return 'granted'; } };
    Object.defineProperty(n.w.document, 'hidden', { configurable: true, get: () => n === B }); n.w.document.hasFocus = () => n === A; n.w.NitPlanilha._fora = 0; n.w.NitPlanilha._tituloAtualizar(); }
  doc(A).getElementById('relatorio-bruto-input').value = ''; doc(B).getElementById('relatorio-bruto-input').value = '';
  const tA0 = h.toasts ? h.toasts(A).length : 0;
  const L3 = [...L2, lin('702', '28/10/2026 11:24')]; L3[1] = lin('611', '28/10/2026 10:44', '28/10/2026 11:23');
  await A.w.NitFirebase.db.ref('fonte_planilha').set(fonte(L3, { em: new Date('2026-10-28T11:24:30').getTime() })); await h.dormir(3200);
  const toastA = [...doc(A).querySelectorAll('#toast-container .toast')].map(t => t.textContent).join(' | ');
  reg('PA9', 'Na tela: aviso passageiro diz o que mudou e o card brilha', [
    ck(/📋 11:24 · .*entrou 702.*normalizou 611/.test(toastA), `aviso: "${toastA}"`),
    ck(doc(A).querySelector('.kanban-card[data-codigo="702"].nit-planilha-mudou'), 'card 702 com a borda piscando'),
    ck(doc(A).querySelector('#toast-container .toast.nit-toast-pisca'), 'aviso passageiro piscando'),
  ]);
  const corB = []; for (let i = 0; i < 4; i++) { corB.push(/ef4444/.test(decodeURIComponent(doc(B).querySelector('link[rel="icon"]').getAttribute('href')))); await h.dormir(450); }
  reg('PA10', 'Fora da tela: número no título da aba e notificação do sistema (uma só com duas abas)', [
    ck(/^(🔴 )?\(\d+\) /.test(doc(B).title) && !/\(\d+\)/.test(doc(A).title), `títulos: A "${doc(A).title}" · B "${doc(B).title}"`),
    ck(notifs.length === 1 && /RELATÓRIO ATUALIZADO 11:24/.test(notifs[0].t) && /Atualize o grupo/.test(notifs[0].body), `notificações: ${JSON.stringify(notifs)}`),
    ck(B.w.NitPlanilha._pisca && corB.includes(true) && corB.includes(false), `ícone da aba B pisca em vermelho (${corB.map(x => x ? '🔴' : '·').join('')})`),
  ]);
  Object.defineProperty(B.w.document, 'hidden', { configurable: true, get: () => false }); B.w.document.dispatchEvent(new B.w.Event('visibilitychange'));
  reg('PA11', 'Voltou para a aba: o número e o vermelho somem', [
    ck(!/^(🔴 )?\(/.test(doc(B).title) && !B.w.NitPlanilha._pisca && !/ef4444/.test(decodeURIComponent(doc(B).querySelector('link[rel="icon"]').getAttribute('href'))), `título B: "${doc(B).title}"`),
  ]);
  await h.dormir(9000);
  reg('PA11b', 'Depois de 8 piscadas a borda some (sem contorno fixo)', [ck(!doc(A).querySelector('.nit-planilha-mudou') && !doc(B).querySelector('.nit-planilha-mudou'), 'nenhum card com borda nas duas janelas')]);
  // planilha mudou de formato
  await A.w.NitFirebase.db.ref('fonte_planilha/erro').set('F: esperado CAUSA, veio CAUSA X'); await h.dormir(500);
  reg('PA12', 'Planilha mudou de formato: faixa vermelha na hora, com a ação', [
    ck(faixa(A) && /PLANILHA MUDOU DE FORMATO · COLE O RELATÓRIO DO WHATSAPP/.test(faixa(A).textContent), `faixa: "${faixa(A)?.textContent}"`),
    ck(/^⚠ PAROU · /.test(doc(A).title), `título: "${doc(A).title}"`),
    ck(/mudou de formato \(F: esperado CAUSA/.test(aud(A)), 'LINHA DO TEMPO registra o motivo'),
  ]);
  await A.w.NitFirebase.db.ref('fonte_planilha/erro').remove(); await h.dormir(500);
  // janela travada: B "pegou" a versão e não processou; A assume depois de 2 min
  const L4 = [...L3, lin('703', '28/10/2026 11:25')];
  const f4 = fonte(L4, { em: new Date('2026-10-28T11:25:00').getTime() });
  await A.w.NitFirebase.db.ref('meta/planilha_processada').set({ assinatura: f4.conteudo.assinatura, janela: 'travada', ts: new Date('2026-10-28T11:25:00').getTime() });
  relogio([A, B], '2026-10-28T11:25:10');
  await A.w.NitFirebase.db.ref('fonte_planilha').set(f4); await h.dormir(1500);
  const antes703 = !!doc(A).querySelector('.kanban-card[data-codigo="703"]');
  relogio([A, B], '2026-10-28T11:27:30'); await A.w.NitFirebase.db.ref('fonte_planilha/verificadoEm').set(new Date('2026-10-28T11:27:20').getTime()); await h.dormir(2500);
  const p = (A.fb.estado().meta || {}).planilha_processada || {};
  reg('PA13', 'Janela que pegou a vez travou: depois de 2 min outra assume', [
    ck(!antes703, 'nos primeiros 2 min espera (outra janela tem a vez)'),
    ck(doc(A).querySelector('.kanban-card[data-codigo="703"]') && p.retomado === true, `703 entrou; vez retomada (${JSON.stringify(p)})`),
  ]);
  // sem conexão: não é "planilha parou"; e o clique na linha marca PLANILHA (não COLADO)
  fb.controle.definirOnline(false); relogio([A, B], '2026-10-28T11:40:00'); A.w.NitPlanilha._render();
  relogio([A, B], '2026-10-28T11:40:35'); A.w.NitPlanilha._render(); await h.dormir(300);
  reg('PA14', 'Sem internet: a faixa diz SEM INTERNET (não "planilha parou")', [
    ck(faixa(A) && /SEM INTERNET/.test(faixa(A).textContent) && !/PAROU/.test(faixa(A).textContent), `faixa: "${faixa(A)?.textContent}"`),
    ck(/SEM INTERNET/.test(btn(A).textContent), `linha: "${btn(A).textContent}"`),
  ]);
  fb.controle.definirOnline(true); await A.w.NitFirebase.db.ref('fonte_planilha/verificadoEm').set(new Date('2026-10-28T11:40:30').getTime()); await h.dormir(500); A.w.NitPlanilha._render();
  btn(A).click(); await h.dormir(2500);
  reg('PA15', 'Conexão voltou: a faixa some; clicar na linha processa e marca PLANILHA', [
    ck(!faixa(A) && /Conexão voltou/.test(aud(A)), 'faixa sumiu; LINHA DO TEMPO: "✓ Conexão voltou."'),
    ck(/· PLANILHA$/.test(btn(B).textContent), `linha: "${btn(B).textContent}"`),
  ]);
  // aba congelada acorda com dados velhos e em seguida chegam os novos: nada de "parou/voltou"
  const antes = (aud(A).match(/Planilha parou|Planilha voltou/g) || []).length;
  relogio([A, B], '2026-10-28T12:30:00');            // 50 min sem render (aba congelada)
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange'));   // acordou
  A.w.NitPlanilha._render(); relogio([A, B], '2026-10-28T12:30:10'); A.w.NitPlanilha._render();
  await A.w.NitFirebase.db.ref('fonte_planilha/verificadoEm').set(new Date('2026-10-28T12:30:05').getTime()); await h.dormir(300);
  relogio([A, B], '2026-10-28T12:31:00'); A.w.NitPlanilha._render(); await h.dormir(200);
  const depois = (aud(A).match(/Planilha parou|Planilha voltou/g) || []).length;
  reg('PA16', 'Aba que acorda com dados velhos: não registra "parou/voltou" (sem pisca-pisca)', [ck(depois === antes && !faixa(A), `registros parou/voltou: ${antes} → ${depois}; faixa: ${!!faixa(A)}`)]);
  // 14.4.1: script a cada 5 min fora do turno (avisa intervaloMin): 5 min sem sinal NÃO é parada; 8 min é
  await A.w.NitFirebase.db.ref('fonte_planilha/intervaloMin').set(5); await h.dormir(200);
  await A.w.NitFirebase.db.ref('fonte_planilha/verificadoEm').set(new Date('2026-10-28T22:00:00').getTime()); await h.dormir(300);
  relogio([A, B], '2026-10-28T22:05:40'); A.w.NitPlanilha._render(); relogio([A, B], '2026-10-28T22:06:20'); A.w.NitPlanilha._render(); await h.dormir(200);
  const aos6 = !!faixa(A);
  relogio([A, B], '2026-10-28T22:07:30'); A.w.NitPlanilha._render(); relogio([A, B], '2026-10-28T22:08:10'); A.w.NitPlanilha._render(); await h.dormir(200);
  const aos8 = !!faixa(A);
  await A.w.NitFirebase.db.ref('fonte_planilha/intervaloMin').set(1); await h.dormir(200);
  await A.w.NitFirebase.db.ref('fonte_planilha/verificadoEm').set(new Date('2026-10-28T22:08:05').getTime()); await h.dormir(300); A.w.NitPlanilha._render();
  relogio([A, B], '2026-10-28T22:11:20'); A.w.NitPlanilha._render(); relogio([A, B], '2026-10-28T22:12:00'); A.w.NitPlanilha._render(); await h.dormir(200);
  reg('PA17', 'Intervalo de 5 min fora do turno: sem faixa até 7 min sem sinal; volta a 3 min quando o intervalo volta a 1', [
    ck(!aos6, `6 min sem sinal com intervalo 5: sem faixa (${aos6})`), ck(aos8, `8 min sem sinal: faixa (${aos8})`),
    ck(!!faixa(A), `intervalo 1 de novo: 4 min sem sinal já mostra a faixa (${!!faixa(A)})`),
  ]);
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO planilha', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(0);
})();
