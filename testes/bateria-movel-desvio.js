// Bateria NIT Móvel fase 1 (31/10/2026): quem vai para o movel.html ao abrir o NIT.
// Regra (01/11): no celular, o endereço normal abre o movel.html antes do login (lá o login funciona no iPhone);
// quem não é ADM volta com ?versao=computador e fica. Computador: nada muda.
const h = require('./harness');
const ISO = '2026-10-31T12:00:00', ADM = { nit_admins: { 'teste|nit|local': true } };
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
const navegou = n => n.erros.some(e => /navigation/i.test(e));   // jsdom não navega: registra a tentativa
const botao = n => !!n.w.document.getElementById('nit-admin-limpar');
(async () => {
  const caso = async (estado, celular, url) => { const n = await h.subirNIT({ estado, relogioIso: ISO, celular, ...(url ? { url } : {}) }); await h.dormir(1500); return n; };
  { const n = await caso(ADM, true);
    reg('MD1', 'ADM no celular: vai para o movel.html', [ck(navegou(n), 'tentou abrir movel.html'), ck(!botao(n), 'não monta os botões de ADM')]); n.dom.window.close(); }
  { const n = await caso({}, true);
    reg('MD2', 'Operador comum no celular: também passa pelo movel.html (lá entra e é devolvido ao NIT)', [ck(navegou(n), 'abriu movel.html')]); n.dom.window.close(); }
  { const n = await caso({}, true, 'https://nit.teste/index.html?versao=computador');
    reg('MD5', 'Celular com ?versao=computador (devolvido pelo móvel ou escolha): fica no NIT de computador', [ck(!navegou(n), 'não saiu do NIT')]); n.dom.window.close(); }
  { const n = await caso(ADM, true, 'https://nit.teste/index.html?versao=computador');
    reg('MD6', 'ADM no celular que escolheu "versão computador": fica e vê os botões de ADM', [ck(!navegou(n), 'não saiu do NIT'), ck(botao(n), 'botões de ADM')]); n.dom.window.close(); }
  { const n = await caso(ADM, false);
    reg('MD3', 'ADM no computador: nada muda', [ck(!navegou(n), 'não saiu do NIT'), ck(botao(n), 'botões de ADM continuam')]); n.dom.window.close(); }
  { const n = await caso(ADM, false);
    const r = n.w.NitAdmin._irParaMovel();
    reg('MD4', 'Sem matchMedia de celular, a função responde "fica"', [ck(r === false, `_irParaMovel() = ${r}`)]); n.dom.window.close(); }
  const f = R.filter(x => x !== 'PASSOU').length;
  console.log('RESUMO movel-desvio', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
  process.exit(f ? 1 : 0);
})();
