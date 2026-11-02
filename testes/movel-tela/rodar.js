const G = process.argv[2]; const { chromium } = require(G + '/playwright');
const fs = require('fs'), path = require('path');
const REPO = process.argv[3], FAKE = fs.readFileSync(path.join(__dirname, 'fakefb.js'), 'utf8');
const R = []; const ck = (ok, d) => ({ ok: !!ok, d });
function reg(id, nome, cs) { const s = cs.every(c => c.ok) ? 'PASSOU' : 'FALHOU'; R.push(s); console.log(`${s.padEnd(7)} ${id} ${nome}`); cs.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.d}`)); }
// datas relativas a hoje (o teste não pode envelhecer)
const fmt = ms => { const d = new Date(ms), z = n => String(n).padStart(2, '0'); return { dia: `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`, hm: `${z(d.getHours())}:${z(d.getMinutes())}` }; };
const DIA = fmt(Date.now()).dia, ONTEM = fmt(Date.now() - 86400000).dia;
const ini = minAtras => { const f = fmt(Date.now() - minAtras * 60000); return `${f.dia} ${f.hm}`; };
const ruas = ['AV. BEZERRA DE MENEZES × R. DIAS DA ROCHA', 'AV. AGUANAMBI × R. VISCONDE DO RIO BRANCO', 'AV. DOMINGOS OLÍMPIO × R. OTOKAR DOLEJSCHI', 'AV. SANTOS DUMONT × AV. BARÃO DE STUDART', 'R. MONSENHOR TABOSA × R. JOAQUIM NABUCO', 'AV. WASHINGTON SOARES × R. CORONEL JUCÁ', 'AV. DOM LUÍS × R. CEL. JUCÁ', 'AV. GODOFREDO MACIEL × R. ANTÔNIO BANDEIRA'];
const causas = ['ENEL', 'FURTO', 'FALHA DE EQUIPAMENTO', 'ENEL', 'ROMPIMENTO', 'ABALROAMENTO'];
function crise() {
  const k = {}; let n = 0;
  const add = (col, qtd, extra = () => ({})) => { for (let i = 0; i < qtd; i++, n++) {
    const cod = String(100 + n * 17 % 900);
    k[`${cod}_${n}`] = { codigo: cod, coluna: col, dataReferencia: DIA, inicio: ini(360 - n * 8), endereco: ruas[n % 8], problema: n % 3 ? 'APAGADO' : 'PISCANTE', tipo: causas[n % 6], ...extra(i) };
  } };
  add('coluna-espera', 18);
  add('coluna-vl', 6, i => ({ equipe: ['FREITAS', 'MOURA', 'SILVA'][i % 3], viatura: `0${i + 1}`, tsDespacho: Date.now() - (20 + i * 15) * 60000 }));
  add('coluna-amc', 5, i => ({ equipe: ['LIMA', 'COSTA'][i % 2], viatura: `VT 1${i}` }));
  add('coluna-sem-necessidade', 4);
  add('coluna-normalizados', 9, i => { const f = fmt(Date.now() - (100 - i * 10) * 60000); return { data_fim: f.dia, hora_fim: f.hm }; });
  k['999_ontem'] = { codigo: '999', coluna: 'coluna-espera', dataReferencia: ONTEM, inicio: `${ONTEM} 10:00`, endereco: 'ONTEM' };
  return k;
}
const U = { email: 'Teste.Adm@Gmail.com', uid: 'u1' };
async function abrir(b, F, url = 'http://nit.teste/sistemaintegrado/movel.html', vistos, ua, google) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(ua ? { userAgent: ua } : {}) });
  await ctx.addInitScript(([f, v]) => { window.__FB = f; if (v) localStorage.setItem('nit-movel-vistos', v); }, [F, vistos || null]);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'www.gstatic.com') return r.fulfill({ contentType: 'text/javascript', body: /app-compat/.test(u.pathname) ? FAKE : '' });
    if (u.hostname === 'nit.teste') { const f = path.join(REPO, path.basename(u.pathname));
      if (!fs.existsSync(f)) return r.fulfill({ status: 200, body: `PAGINA ${u.pathname}${u.search}` });
      // com google: preenche o ID do cliente (como ficará depois do Google Cloud)
      if (google && /movel\.html$/.test(u.pathname)) return r.fulfill({ contentType: 'text/html', body: fs.readFileSync(f, 'utf8').replace(/window\.NIT_GOOGLE_CLIENT = [^\n]*/, "window.NIT_GOOGLE_CLIENT = 'teste.apps.googleusercontent.com';") });
      return r.fulfill({ path: f }); }
    // Google simulado: devolve ao endereço pedido com o comprovante (ou o erro) depois do #
    if (google && u.hostname === 'accounts.google.com') { const q = u.searchParams; google.pedidos.push(Object.fromEntries(q));
      const pl = Buffer.from(JSON.stringify({ email: google.email, nonce: google.nonceErrado ? 'outro' : q.get('nonce') })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const frag = google.erro ? `error=${google.erro}&state=${q.get('state')}` : `id_token=e30.${pl}.x&state=${q.get('state')}`;
      return r.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(`${q.get('redirect_uri')}#${frag}`)})</script>` }); }
    return r.abort();
  });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) erros.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(500); return { p, ctx, erros };
}
(async () => {
  const b = await chromium.launch();
  const base = { estado: { kanban: crise(), usuarios_autorizados: { 'teste|adm|gmail|com': { nome: 'Adm', ativo: true }, 'teste|op|gmail|com': { nome: 'Op' } }, nit_admins: { 'teste|adm|gmail|com': true }, meta: { ultimo_processamento: { ts: Date.now() - 120000, planilha: true } } }, online: true };
  // E1 ADM: lista do dia
  { const { p, ctx, erros } = await abrir(b, { ...base, usuario: U });
    const chips = await p.$$eval('.m-chip', xs => xs.map(x => x.textContent));
    const linhas = await p.$$eval('.m-pag.on .m-r', xs => xs.length);
    const primeiro = await p.$eval('.m-pag.on .m-r time', x => x.textContent);
    const tempos = await p.$$eval('.m-pag.on .m-r', xs => xs.map(x => x.querySelector('time').textContent));
    await p.screenshot({ path: path.join(__dirname, 'movel-aguardando.png') });
    reg('E1', 'ADM abre: Aguardando, 18 linhas, mais antiga primeiro, totais batem', [
      ck(chips.join('|') === 'Aguardando18|Via Livre6|AMC5|Sem nec.4|Normalizados9|Todos42', chips.join(' | ')),
      ck(linhas === 18, `${linhas} linhas`), ck(/^há \d+h/.test(primeiro), `1ª linha: ${primeiro}`),
      ck(await p.$eval('#m-resumo', x => x.textContent) === '33 pend. · 9 norm.', await p.$eval('#m-resumo', x => x.textContent)),
      ck(/ATUALIZADO \d\d:\d\d · PLANILHA/.test(await p.$eval('#m-estado', x => x.textContent)), await p.$eval('#m-estado', x => x.textContent)),
      ck(!erros.length, `erros: ${erros.join('; ') || 'nenhum'}`),
      ck(!(await p.evaluate(() => window.__FB.cfg.databaseURL)).includes('homologacao'), 'endereço de produção usa o banco de produção'),
    ]);
    await p.click('.m-chip >> text=Via Livre'); await p.waitForTimeout(100);
    const sub = await p.$eval('.m-pag.on .m-r .m-z span', x => x.textContent);
    await p.screenshot({ path: path.join(__dirname, 'movel-vialivre.png') });
    await p.click('.m-chip >> text=Todos'); await p.fill('#m-busca', 'aguanambi'); await p.waitForTimeout(100);
    const achou = await p.$$eval('.m-pag.on .m-r', xs => xs.length);
    await p.fill('#m-busca', ''); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelector('.m-pag.on').scrollTop = 1600; }); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(__dirname, 'movel-todos-rolado.png') });
    const gh = await p.evaluate(() => { const pg = document.querySelector('.m-pag.on'), t = pg.getBoundingClientRect().top; const g = [...pg.querySelectorAll('.m-gh')].find(x => Math.abs(x.getBoundingClientRect().top - t) < 2); return g ? g.textContent : null; });
    reg('E2', 'Filtro Via Livre, busca e cabeçalho do grupo preso no topo', [
      ck(/ · VT 0\d$/.test(sub), `Via Livre mostra equipe: ${sub}`), ck(achou === 6, `busca "aguanambi" em Todos: ${achou} (6 esperadas: 42/8 ruas)`),
      ck(gh, `cabeçalho preso ao rolar: ${gh}`),
    ]);
    // ao vivo: um card novo chega
    await p.click('.m-chip >> text=Aguardando');
    await p.evaluate(([dia, inicio]) => { window.__FB.estado.kanban['777_n'] = { codigo: '777', coluna: 'coluna-espera', dataReferencia: dia, inicio, endereco: 'AV. NOVA', problema: 'APAGADO', tipo: 'ENEL' }; window.__FBemitir(); }, [DIA, ini(2)]);
    await p.waitForTimeout(150);
    const ult = await p.$$eval('.m-pag.on .m-r', xs => xs.map(x => x.querySelector('.m-av').textContent + (x.querySelector('.m-novo') ? '*' : '')));
    reg('E3', '1ª visita no aparelho: card que chega ao vivo aparece, sem "novo"', [ck(ult.length === 19 && ult.includes('777'), `${ult.length} linhas; 777 = ${ult.find(x => x.startsWith('777'))}`)]);
    // sai do app (guarda vistos), volta depois com 2 mudanças
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const vistos = await p.evaluate(() => localStorage.getItem('nit-movel-vistos'));
    await ctx.close();
    const F2 = JSON.parse(JSON.stringify({ ...base, usuario: U })); F2.estado.kanban = crise(); F2.estado.kanban['777_n'] = { codigo: '777', coluna: 'coluna-vl', dataReferencia: DIA, inicio: ini(2), endereco: 'AV. NOVA', equipe: 'SILVA', viatura: '09' };
    F2.estado.kanban['888_n'] = { codigo: '888', coluna: 'coluna-espera', dataReferencia: DIA, inicio: ini(1), endereco: 'AV. OUTRA', problema: 'PISCANTE', tipo: 'FURTO' };
    const s2 = await abrir(b, F2, undefined, vistos);
    const novos = await s2.p.$$eval('.m-pag.on .m-r', xs => xs.filter(x => x.querySelector('.m-novo')).map(x => x.querySelector('.m-av').textContent));
    const pontos = await s2.p.$$eval('.m-chip', xs => xs.filter(x => x.querySelector('.m-chip-novo')).map(x => x.firstChild.textContent));
    await s2.p.screenshot({ path: path.join(__dirname, 'movel-novo.png') });
    reg('E4', 'Volta depois: "novo" no que entrou ou mudou de coluna; ponto no filtro', [
      ck(novos.join() === '888', `novos em Aguardando: ${novos.join() || 'nenhum'}`), ck(pontos.join() === 'Aguardando,Via Livre', `filtros com ponto: ${pontos.join()}`)]);
    await s2.ctx.close(); }
  // E5 operador comum → computador
  { const { p, ctx } = await abrir(b, { ...base, usuario: { email: 'teste.op@gmail.com' } });
    reg('E5', 'Operador comum no movel.html: volta para o NIT de computador', [ck(p.url().endsWith('index.html?versao=computador'), p.url())]); await ctx.close(); }
  // E6 não autorizado
  { const { p, ctx } = await abrir(b, { ...base, usuario: { email: 'estranho@gmail.com' } });
    const st = await p.$eval('#m-login-status', x => x.textContent);
    reg('E6', 'Não autorizado: fica no login com aviso e é desconectado', [ck(/não autorizado/i.test(st) && await p.$eval('#m-app', x => x.hidden), st)]); await ctx.close(); }
  // E7 sem sessão → login → entra
  { const { p, ctx } = await abrir(b, { ...base, usuario: null, proximo: U });
    const antes = await p.$eval('#m-login', x => !x.hidden);
    await p.screenshot({ path: path.join(__dirname, 'movel-login.png') });
    await p.click('#m-btn-login'); await p.waitForTimeout(400);
    reg('E7', 'Sem sessão: tela de login; após entrar, abre a lista', [ck(antes, 'login visível'), ck(await p.$$eval('.m-pag.on .m-r', xs => xs.length) === 18, 'lista aberta')]); await ctx.close(); }
  // E8 sem internet
  { const { p, ctx } = await abrir(b, { ...base, usuario: U });
    await p.evaluate(() => { window.__FB.online = false; window.__FBemitir(); }); await p.waitForTimeout(1000);
    const cedo = await p.$eval('#m-estado', x => x.textContent);
    await p.waitForTimeout(4500); const depois = await p.$eval('#m-estado', x => x.textContent);
    reg('E8', 'Sem internet: espera 5 s (oscilação não assusta), depois avisa', [ck(/ATUALIZADO/.test(cedo), `após 1 s: ${cedo}`), ck(/SEM INTERNET/.test(depois), `após 5,5 s: ${depois}`)]); await ctx.close(); }
  // E9 homologação usa o banco de teste
  { const { p, ctx } = await abrir(b, { ...base, usuario: U }, 'http://nit.teste/nit-homologacao/movel.html');
    reg('E9', 'Endereço de homologação usa o banco nit-homologacao e mostra a marca', [ck((await p.evaluate(() => window.__FB.cfg.databaseURL)).includes('homologacao'), 'banco nit-homologacao'), ck(await p.$eval('body', x => x.classList.contains('m-homolog')), 'marca HOMOLOG')]);
    await p.screenshot({ path: path.join(__dirname, 'movel-homolog.png') }); await ctx.close(); }
  // ── Login só pela janela (01/11): falhas mostram motivo e a saída para o navegador; nunca "vai e volta"
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const AND = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  const vis = (p, id) => p.$eval('#' + id, x => !x.hidden && !x.closest('[hidden]'));
  { const { p, ctx, erros } = await abrir(b, { ...base, usuario: null, popup: { erro: 'auth/operation-not-supported-in-this-environment' } }, undefined, null, IOS);
    await p.click('#m-btn-login'); await p.waitForTimeout(300);
    const st = await p.$eval('#m-login-status', x => x.textContent);
    await p.screenshot({ path: path.join(__dirname, 'movel-login-falhou-iphone.png') });
    reg('E10', 'iPhone, navegador que não deixa entrar: motivo na tela + "Abrir no Safari"; não tenta ir e voltar', [
      ck(/não permite entrar com o Google\. \(auth\/operation-not-supported-in-this-environment\)/.test(st), st),
      ck(await vis(p, 'm-ajuda-ios') && !(await vis(p, 'm-ajuda-android')) && await vis(p, 'm-copiar'), 'instrução do iPhone + Copiar link'),
      ck(!(await p.evaluate(() => window.__FB.redirects)), 'nenhum redirecionamento'),
      ck(!(await p.$eval('#m-btn-login', x => x.disabled)), 'botão Entrar liberado para tentar de novo'),
    ]); await ctx.close(); }
  { const { p, ctx } = await abrir(b, { ...base, usuario: null, popup: { erro: 'auth/popup-blocked' } }, undefined, null, AND);   // sem ID do cliente (produção hoje): janela
    await p.click('#m-btn-login'); await p.waitForTimeout(300);
    const href = await p.$eval('#m-abrir-chrome', x => x.getAttribute('href'));
    reg('E11', 'Android, janela bloqueada: botão "Abrir no Chrome" com o mesmo endereço', [
      ck(await vis(p, 'm-ajuda-android') && !(await vis(p, 'm-ajuda-ios')), 'instrução do Android'),
      ck(href.startsWith('intent://nit.teste/sistemaintegrado/movel.html#Intent;scheme=https;package=com.android.chrome;'), href),
    ]); await ctx.close(); }
  { const { p, ctx } = await abrir(b, { ...base, usuario: null, popup: 'trava' }, undefined, null, IOS);
    await p.evaluate(() => { NitMovel.S.demoraMs = 600; }); await p.click('#m-btn-login'); await p.waitForTimeout(250);
    const cedo = await vis(p, 'm-ajuda'); await p.waitForTimeout(600);
    reg('E12', 'Janela que nunca responde: depois da espera mostra a saída (sem cancelar)', [
      ck(!cedo, 'antes da espera: só "Abrindo o Google..."'),
      ck(await vis(p, 'm-ajuda') && /demorando/.test(await p.$eval('#m-login-status', x => x.textContent)), await p.$eval('#m-login-status', x => x.textContent)),
    ]); await ctx.close(); }
  { const { p, ctx } = await abrir(b, { ...base, usuario: null, popup: { erro: 'auth/network-request-failed' } }, undefined, null, IOS);
    await p.click('#m-btn-login'); await p.waitForTimeout(300);
    reg('E13', 'Sem internet: diz isso e não manda trocar de navegador', [
      ck(/Sem internet/.test(await p.$eval('#m-login-status', x => x.textContent)) && !(await vis(p, 'm-ajuda')), await p.$eval('#m-login-status', x => x.textContent)),
    ]); await ctx.close(); }
  { const { p, ctx } = await abrir(b, { ...base, usuario: null, popup: { erro: 'auth/popup-blocked' }, proximo: U }, undefined, null, IOS);
    await p.click('#m-btn-login'); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__FB.popup = null; }); await p.click('#m-btn-login'); await p.waitForTimeout(400);
    reg('E14', 'Tentou de novo e deu certo: a instrução some e a lista abre', [
      ck(!(await vis(p, 'm-ajuda')) && await p.$$eval('.m-pag.on .m-r', xs => xs.length) === 18, 'lista aberta, ajuda escondida'),
    ]); await ctx.close(); }
  { const g = { email: 'teste.adm@gmail.com', pedidos: [] };
    const ctx = await b.newContext({ isMobile: true, userAgent: IOS });
    await ctx.addInitScript(f => { window.__FB = f; }, { ...base, usuario: null });
    await ctx.route('**/*', r => { const u = new URL(r.request().url());
      if (u.hostname === 'www.gstatic.com') return r.fulfill({ contentType: 'text/javascript', body: /app-compat/.test(u.pathname) ? FAKE : '' });
      if (u.hostname === 'nit.teste') return r.fulfill({ path: path.join(REPO, path.basename(u.pathname)) });
      if (u.hostname === 'accounts.google.com') { g.pedidos.push(Object.fromEntries(u.searchParams)); return r.fulfill({ body: 'GOOGLE' }); }
      return r.abort(); });
    const p = await ctx.newPage(); await p.goto('http://nit.teste/nit-homologacao/movel.html'); await p.waitForTimeout(400);
    await p.click('#m-btn-login'); await p.waitForTimeout(600);
    reg('E20', 'Arquivo real: homologação já vai ao Google com o ID do cliente dela; produção (sem ID) continua na janela', [
      ck(g.pedidos[0]?.client_id === '865942699083-attv4bvurge6i2efsiv8seat4sc8ri33.apps.googleusercontent.com' && !(await p.evaluate(() => window.__FB.janelas)), `client_id: ${g.pedidos[0]?.client_id}`),
    ]); await ctx.close(); }
  { const ctx = await b.newContext({ isMobile: true, userAgent: IOS });
    await ctx.route('**/*', r => { const u = new URL(r.request().url());
      if (u.hostname === 'nit.teste') return r.fulfill({ path: path.join(REPO, path.basename(u.pathname)) });
      return r.abort(); });   // Firebase (gstatic) não carrega
    const p = await ctx.newPage(); await p.goto('http://nit.teste/nit-homologacao/movel.html'); await p.waitForTimeout(500);
    const st = await p.$eval('#m-login-status', x => x.textContent), dg = await p.$eval('#m-diag', x => x.textContent);
    reg('E21', 'Firebase não carregou (rede/bloqueador): a tela diz isso; versão visível', [
      ck(/Firebase não carregou/.test(st), st), ck(/^movelhomolog\d+/.test(dg), `linha da versão: ${dg}`),
    ]); await ctx.close(); }
  // ── Ir e voltar pela própria página (com o ID do cliente configurado)
  { const g = { email: 'teste.adm@gmail.com', pedidos: [] };
    const { p, ctx, erros } = await abrir(b, { ...base, usuario: null }, 'http://nit.teste/nit-homologacao/movel.html', null, IOS, g);
    await p.click('#m-btn-login'); await p.waitForURL(/movel\.html/); await p.waitForTimeout(800);
    const ped = g.pedidos[0] || {};
    reg('E15', 'iPhone, ir e voltar: Google devolve ao movel.html, sessão abre, lista aparece', [
      ck(ped.response_type === 'id_token' && ped.redirect_uri === 'http://nit.teste/nit-homologacao/movel.html' && ped.client_id === 'teste.apps.googleusercontent.com', `pedido: ${JSON.stringify(ped).slice(0, 160)}`),
      ck(await p.$$eval('.m-pag.on .m-r', xs => xs.length) === 18, 'lista aberta (ADM)'),
      ck(!p.url().includes('#') && !p.url().includes('id_token'), `comprovante tirado do endereço: ${p.url()}`),
      ck(!(await p.evaluate(() => window.__FB.janelas)), 'sem janela (pop-up)'),
      ck(/sessão aberta/.test(await p.evaluate(() => localStorage.getItem('nit-movel-login-passo'))), `rastro: ${await p.evaluate(() => localStorage.getItem('nit-movel-login-passo'))}`),
      ck(!erros.length, `erros: ${erros.join('; ') || 'nenhum'}`),
    ]); await ctx.close(); }
  { const g = { email: 'teste.adm@gmail.com', pedidos: [], nonceErrado: true };
    const { p, ctx } = await abrir(b, { ...base, usuario: null }, 'http://nit.teste/nit-homologacao/movel.html', null, IOS, g);
    await p.click('#m-btn-login'); await p.waitForURL(/movel\.html/); await p.waitForTimeout(600);
    const st = await p.$eval('#m-login-status', x => x.textContent);
    reg('E16', 'Comprovante que não é deste pedido (nonce): recusa, diz o motivo, não abre sessão', [
      ck(/nonce/.test(st) && !(await p.evaluate(() => window.__FB.creds)) && await p.$eval('#m-app', x => x.hidden), st),
      ck(/não confere/.test(await p.$eval('#m-diag', x => x.textContent)), `rastro na tela: ${await p.$eval('#m-diag', x => x.textContent)}`),
    ]); await ctx.close(); }
  { const g = { email: 'teste.adm@gmail.com', pedidos: [], erro: 'access_denied' };
    const { p, ctx } = await abrir(b, { ...base, usuario: null }, 'http://nit.teste/nit-homologacao/movel.html', null, IOS, g);
    await p.click('#m-btn-login'); await p.waitForURL(/movel\.html/); await p.waitForTimeout(600);
    reg('E17', 'Cancelou no Google: "Login cancelado no Google." e o botão volta', [
      ck(await p.$eval('#m-login-status', x => x.textContent) === 'Login cancelado no Google.' && !(await p.$eval('#m-btn-login', x => x.disabled)), await p.$eval('#m-login-status', x => x.textContent)),
    ]); await ctx.close(); }
  { const g = { email: 'estranho@gmail.com', pedidos: [] };
    const { p, ctx } = await abrir(b, { ...base, usuario: null }, 'http://nit.teste/nit-homologacao/movel.html', null, IOS, g);
    await p.click('#m-btn-login'); await p.waitForURL(/movel\.html/); await p.waitForTimeout(800);
    reg('E18', 'Conta Google fora da lista: entra no Google, mas o NIT recusa como sempre', [
      ck(/não autorizado/i.test(await p.$eval('#m-login-status', x => x.textContent)) && await p.$eval('#m-app', x => x.hidden), await p.$eval('#m-login-status', x => x.textContent)),
    ]); await ctx.close(); }
  { const g = { email: 'teste.adm@gmail.com', pedidos: [] };
    const { p, ctx } = await abrir(b, { ...base, usuario: null, credErro: 'auth/invalid-credential' }, 'http://nit.teste/nit-homologacao/movel.html', null, IOS, g);
    await p.click('#m-btn-login'); await p.waitForURL(/movel\.html/); await p.waitForTimeout(600);
    reg('E19', 'Firebase recusa o comprovante: motivo com código na tela', [
      ck(/auth\/invalid-credential/.test(await p.$eval('#m-login-status', x => x.textContent)), await p.$eval('#m-login-status', x => x.textContent)),
    ]); await ctx.close(); }
  // ── Arrastar para o lado troca a lista (01/11) + abas + ADM
  { const { p, ctx, erros } = await abrir(b, JSON.parse(JSON.stringify({ ...base, usuario: U })));
    const w = await p.$eval('#m-paginas', x => x.clientWidth);
    await p.evaluate(wd => { document.getElementById('m-paginas').scrollTo({ left: wd }); }, w); await p.waitForTimeout(300);
    const st1 = { chip: await p.$eval('.m-chip.on', x => x.dataset.id), pag: await p.$eval('.m-pag.on', x => x.dataset.pag), sub: await p.$eval('.m-pag.on .m-r .m-z span', x => x.textContent) };
    await p.evaluate(wd => { document.getElementById('m-paginas').scrollTo({ left: wd * 4 }); }, w); await p.waitForTimeout(300);
    const st2 = await p.$eval('.m-chip.on', x => x.dataset.id);
    await p.click('.m-chip >> text=AMC'); await p.waitForTimeout(800);
    const st3 = { left: await p.$eval('#m-paginas', x => x.scrollLeft), pag: await p.$eval('.m-pag.on', x => x.dataset.pag) };
    await p.screenshot({ path: path.join(__dirname, 'movel-arrastar.png') });
    reg('E22', 'Arrastar para o lado troca a lista e o filtro acompanha; tocar no filtro leva à lista', [
      ck(st1.chip === 'vl' && st1.pag === 'vl' && / · VT \d+$/.test(st1.sub), `1 tela para o lado: ${JSON.stringify(st1)}`),
      ck(st2 === 'norm', `4 telas: ${st2}`),
      ck(st3.pag === 'amc' && Math.abs(st3.left - 2 * w) < 2, `toque em AMC: ${JSON.stringify(st3)}`),
      ck(await p.evaluate(() => localStorage.getItem('nit-movel-filtro')) === 'amc', 'lembra a lista escolhida'),
    ]);
    await p.click('#m-abas button[data-aba="resumo"]'); await p.waitForTimeout(150);
    const res = { vis: await p.$eval('#v-resumo', x => !x.hidden), filtros: await p.$eval('#m-filtros', x => x.hidden), total: await p.$eval('#r-total', x => x.textContent), causas: await p.$$eval('#r-causas span', xs => xs.length) };
    await p.screenshot({ path: path.join(__dirname, 'movel-resumo.png') });
    await p.click('#m-abas button[data-aba="adm"]'); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 'movel-adm.png') });
    reg('E23', 'Abas embaixo: Resumo (totais, situação, causas) e ADM; busca e filtros só em Ocorrências', [
      ck(res.vis && res.filtros && res.total === '42' && res.causas === 5, JSON.stringify(res)),
      ck(await p.$eval('#v-adm', x => !x.hidden) && await p.$eval('#a-restaurar', x => x.hidden) && /teste\.adm/i.test(await p.$eval('#a-email', x => x.textContent)), 'ADM: limpar, conta; restaurar escondido (sem cópia)'),
      ck(await p.$eval('#m-abas-n', x => x.textContent) === '18', 'aba Ocorrências mostra 18 aguardando'),
    ]);
    // limpar: travado sem a palavra
    await p.click('#a-limpar'); await p.waitForTimeout(250);
    const f0 = { aberta: await p.$eval('#m-folha', x => !x.hidden), travado: await p.$eval('#m-folha-ok', x => x.disabled), txt: await p.$eval('#m-folha-txt', x => x.textContent) };
    await p.screenshot({ path: path.join(__dirname, 'movel-limpar.png') });
    await p.press('#m-palavra', 'Enter'); await p.fill('#m-palavra', 'LIMPA'); await p.press('#m-palavra', 'Enter'); await p.waitForTimeout(150);
    const nada = { escritas: await p.evaluate(() => window.__FB.escritas || 0), aberta: await p.$eval('#m-folha', x => !x.hidden) };
    await p.click('#m-folha-cancelar'); await p.waitForTimeout(100);
    const cancel = { aberta: await p.$eval('#m-folha', x => !x.hidden), escritas: await p.evaluate(() => window.__FB.escritas || 0) };
    reg('E24', 'Limpar pelo celular: pergunta por baixo, travada até digitar LIMPAR; Enter e Cancelar não apagam', [
      ck(f0.aberta && f0.travado && /Apaga os 43 cards/.test(f0.txt), JSON.stringify(f0)),
      ck(nada.escritas === 0 && nada.aberta, `sem a palavra: ${JSON.stringify(nada)}`),
      ck(!cancel.aberta && cancel.escritas === 0, `cancelar: ${JSON.stringify(cancel)}`),
    ]);
    await p.click('#a-limpar'); await p.waitForTimeout(250); await p.fill('#m-palavra', 'limpar'); await p.click('#m-folha-ok'); await p.waitForTimeout(500);
    const dep = await p.evaluate(() => { const e = window.__FB.estado; return { kanban: Object.keys(e.kanban || {}).length, lix: Object.values(e.lixeira || {}).map(c => c.cards), aud: Object.values(Object.values(e.auditoria || {})[0] || {}).map(x => x.linhas[0]), dec: !!(e.meta || {}).decisoes_ativas }; });
    const msg = await p.$eval('#m-adm-msg', x => x.textContent), rest = await p.$eval('#a-restaurar', x => !x.hidden);
    await p.click('#m-abas button[data-aba="ocorr"]'); await p.waitForTimeout(200);
    const vazio = await p.$$eval('.m-pag.on .m-r', xs => xs.length);
    reg('E25', '"limpar" + Limpar painel: apaga para todos, guarda a cópia, registra na LINHA DO TEMPO; Restaurar aparece', [
      ck(dep.kanban === 0 && JSON.stringify(dep.lix) === '[43]' && dep.aud[0] === '🧹 Painel limpo (43 cards). Cópia guardada.', JSON.stringify(dep)),
      ck(/Painel limpo\. 43 cards/.test(msg) && rest, `${msg} · restaurar visível: ${rest}`),
      ck(vazio === 0, `lista vazia: ${vazio}`),
    ]);
    await p.click('#m-abas button[data-aba="adm"]'); await p.click('#a-restaurar'); await p.waitForTimeout(200);
    await p.fill('#m-palavra', 'LIMPAR'); const outra = await p.$eval('#m-folha-ok', x => x.disabled);
    await p.fill('#m-palavra', 'restaurar'); await p.press('#m-palavra', 'Enter'); await p.waitForTimeout(500);
    const vol = await p.evaluate(() => Object.keys(window.__FB.estado.kanban || {}).length);
    reg('E26', 'Restaurar pelo celular: só com RESTAURAR; devolve os cards; some depois', [
      ck(outra, '"LIMPAR" não serve'), ck(vol === 43, `cards de volta: ${vol}`),
      ck(await p.$eval('#a-restaurar', x => x.hidden) && /restaurado: 43/.test(await p.$eval('#m-adm-msg', x => x.textContent)), await p.$eval('#m-adm-msg', x => x.textContent)),
      ck(!erros.length, `erros: ${erros.join('; ') || 'nenhum'}`),
    ]); await ctx.close(); }
  // ── Texto inteiro + tocar (detalhes) + segurar e soltar (copiar) — 01/11
  { const { p, ctx, erros } = await abrir(b, JSON.parse(JSON.stringify({ ...base, usuario: U })), 'https://nit.teste/sistemaintegrado/movel.html');   // https: como o site real (área de transferência só existe em https)
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://nit.teste' });
    const corte = await p.$$eval('.m-pag.on .m-r b', xs => xs.filter(x => x.scrollWidth > x.clientWidth + 1 || getComputedStyle(x).textOverflow === 'ellipsis' && getComputedStyle(x).whiteSpace === 'nowrap').length);
    const inteiro = await p.$eval('.m-pag.on .m-r b', x => x.textContent);
    await p.screenshot({ path: path.join(__dirname, 'movel-texto-inteiro.png') });
    reg('E28', 'Cruzamento inteiro na lista (quebra linha, não corta)', [ck(corte === 0 && / × /.test(inteiro), `cortados: ${corte} · "${inteiro}"`)]);
    await p.click('.m-pag.on .m-r'); await p.waitForTimeout(200);
    const det = { aberto: await p.$eval('#m-det', x => !x.hidden), end: await p.$eval('#d-end', x => x.textContent), txt: await p.$eval('#d-texto', x => x.textContent) };
    await p.screenshot({ path: path.join(__dirname, 'movel-detalhe.png') });
    await p.click('#d-copiar'); await p.waitForTimeout(200);
    const cb1 = await p.evaluate(() => navigator.clipboard.readText());
    reg('E29', 'Tocar na linha abre os detalhes; "Copiar para compartilhar" copia no formato do card (*CÓDIGO ENDEREÇO - PROBLEMA*)', [
      ck(det.aberto && det.end === inteiro && /^\*\d+ .+ - (APAGADO|PISCANTE)\*$/.test(det.txt), JSON.stringify(det)),
      ck(cb1 === det.txt && await p.$eval('#m-det', x => x.hidden) && /Copiado/.test(await p.$eval('#m-aviso', x => x.textContent)), `copiado: ${cb1}`),
    ]);
    await p.click('.m-chip >> text=Normalizados'); await p.waitForTimeout(800); await p.click('.m-pag.on .m-r'); await p.waitForTimeout(200);
    const kn = await p.$$eval('#d-campos span', xs => xs.map(x => x.textContent).join(','));
    await p.screenshot({ path: path.join(__dirname, 'movel-detalhe-norm.png') });
    reg('E32', 'Detalhes do normalizado: só Início, Fim e Tempo aberto (e Atuou, se houve equipe)', [ck(/^Início,Fim,Tempo aberto(,Atuou)?$/.test(kn), kn)]);
    await p.click('#d-fechar'); await p.click('.m-chip >> text=Aguardando'); await p.waitForTimeout(800);
    // segurar e soltar (toque real do aparelho, pelo protocolo do navegador)
    await p.evaluate(() => navigator.clipboard.writeText('')); 
    const cdp = await ctx.newCDPSession(p), bx = await (await p.$$('.m-pag.on .m-r'))[2].boundingBox();
    const pt = [{ x: bx.x + 60, y: bx.y + bx.height / 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await p.waitForTimeout(650);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
    const cb2 = await p.evaluate(() => navigator.clipboard.readText()), cod3 = await p.$$eval('.m-pag.on .m-r .m-av', xs => xs[2].textContent);
    reg('E30', 'Segurar e soltar copia direto (sem abrir detalhes)', [
      ck(cb2.startsWith(`*${cod3} `) && await p.$eval('#m-det', x => x.hidden) && new RegExp(`${cod3} copiado`).test(await p.$eval('#m-aviso', x => x.textContent)), `copiado: ${cb2} · aviso: ${await p.$eval('#m-aviso', x => x.textContent)}`),
    ]);
    // tocar e arrastar (rolar) não abre nada
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await p.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pt[0].x, y: pt[0].y - 60 }] }); await p.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(250);
    reg('E31', 'Rolar a lista com o dedo não copia nem abre detalhes', [ck(await p.$eval('#m-det', x => x.hidden) && (await p.evaluate(() => navigator.clipboard.readText())) === cb2, 'nada aconteceu'), ck(!erros.length, `erros: ${erros.join('; ') || 'nenhum'}`)]);
    await ctx.close(); }
  { const { p, ctx } = await abrir(b, JSON.parse(JSON.stringify({ ...base, usuario: U, gravacaoErro: 'PERMISSION_DENIED' })));
    await p.click('#m-abas button[data-aba="adm"]'); await p.click('#a-limpar'); await p.waitForTimeout(200);
    await p.fill('#m-palavra', 'limpar'); await p.click('#m-folha-ok'); await p.waitForTimeout(400);
    reg('E27', 'Banco recusa (sem permissão): diz que nada foi apagado, com o código', [
      ck(/Nada foi apagado\. \(PERMISSION_DENIED\)/.test(await p.$eval('#m-adm-msg', x => x.textContent)) && await p.evaluate(() => Object.keys(window.__FB.estado.kanban).length) === 43, await p.$eval('#m-adm-msg', x => x.textContent)),
    ]); await ctx.close(); }
  await b.close();
  const f = R.filter(x => x !== 'PASSOU').length; console.log('RESUMO movel-tela', f ? { FALHOU: f, PASSOU: R.length - f } : { PASSOU: R.length });
})();
