# HANDOFF.md — NIT

> Ponto de retomada do trabalho. Leia depois de `CONTEXT.MD` e `AI-INSTRUCTIONS.md`.
> Atualizado em: **22/10/2026**.
> Este arquivo registra **estado e próximos passos** (seções 1–6). Regras ficam em `BUSINESS-RULES.md`, `CONTRATO-ENTRADA-CEMOB.md` e `MENSAGENS.md`; pendências detalhadas, em `TODO.md`.
> Abaixo da seção 6 fica o **histórico cronológico** (não reescrever; só acrescentar).

---

## 1. Estado da produção (22/10/2026)

| Item | Situação |
|---|---|
| Versão em produção | **v13 com 13.1 + 13.2** — publicada em 21/10/2026 de madrugada; repositório `sistemaintegrado` (GitHub Pages), Firebase `nit-operacional` |
| Arquivos | `index.html` carrega `nit.js?v=20261020-132` e `nit.css?v=20261020-132` (idênticos ao 132homolog8) |
| Versão anterior (rollback) | commit `33fbec4` (13/10/2026); cópia em `producao-13.2/volta/` do pacote de publicação |
| Homologação | projeto Firebase `nit-homologacao` + repositório `nit-homologacao` (GitHub Pages, faixa vermelha) |
| Contingência | **v10** — repositório `nit-nucleo-inteligencia-trafego`. Só frontend (localStorage), **sem Firebase**. Usada só em pane |
| Regras do Firebase | sem mudança na publicação: `meta` e `auditoria` já liberados para login. `usuarios_autorizados` só grava pelo console |
| Exportação para planilha | **exportador real** atualiza `cursor_exportacao/cliente_b` na raiz (não o `meta/ultimaExportacao` documentado, parado desde 10/07). Código do exportador (Apps Script) **não está no repositório** |
| Usuários | cadastrados à mão no console (`usuarios_autorizados/{email com . e @ → \|}` = `{ nome, turno, ativo }`) |

**Período de estabilização (decisão do Cristiano, 22/10 23:39):** novas implementações pausadas até o Sistema se mostrar estável em produção (usuários novos, turnos). Exceção: defeito que trave ou faça o Sistema errar — mesmo assim **laboratório → homologação → produção**.

---

## 2. Regra de trabalho

- **Toda mudança, qualquer uma, passa por laboratório → homologação → produção.** Sem exceção.
- Publicação em produção só com "autorizo" explícito do Cristiano.
- Textos ao operador: primeiro no `MENSAGENS.md`, validados, depois no código.

---

## 3. Defeitos e achados abertos

| Onde | Problema | Desde | Situação |
|---|---|---|---|
| Planilha | Pendência que atravessa o dia vira **duas linhas**: a de ontem recebe o fim (NORMALIZADO); a de hoje fica presa em "EM ATENDIMENTO" sem fim. O NIT mantém o mesmo card (mesmo ID) e só muda `dataReferencia`; é o exportador que cria linha nova. Já existia antes da 13.2 (conferido no laboratório com a versão anterior). Visto no teste de 21/10 (linhas 2009–2013) | antigo | precisa do código do exportador |
| Planilha | Causa congelada na primeira versão; duplicadas quando a fonte corrige a data do início; duração > 24 h exibida errado | 16/10 | pós-entrega |
| Tela | Campo **Operador** nos detalhes do card não atualiza nas outras telas (`operador`/`turno` fora da lista do `child_changed`); só com Ctrl+F5. Já existia | antigo | fila |
| Login | O nome do operador é lido **só no login**: cadastro corrigido não vale até sair/recarregar (caso Fabiano, 22/10) | antigo | fila: ouvir o próprio cadastro ao vivo |
| Cadastro | Turnos gravados de formas diferentes (`manha`, `manhã`, `"manhã "`) | — | padronizar na tela Usuários |
| Texto | Depois de USAR relatório de outro dia, a ⚠ DECIDIR não explica que os cards não aparecem hoje (a versão antiga explicava) | 21/10 | 13.2.1, texto a validar |
| PERGUNTAR | Não avisa que copiou (só fica ⏳ PERGUNTADO) | 21/10 | 13.2.1: "✓ COPIADO. Cole no grupo." |
| Regras | Nó `recursos/` sem regra: gravação de `recursos/equipes` recusada em silêncio | 16/10 | 13.3 |
| 📜 | "ℹ Hora lida com correção: 446…" se repetia em **todo** processamento (11× em 23/10) | 23/10 (lab) | **corrigido na 13.2.1**: só na 1ª vez do dia (por computador) |
| 📜 | 199/350/1106 voltando a apagar aparecem em "Novos pendentes" **e** em "Apagaram de novo" na mesma linha | antigo | fila |

---

## 4. Fila de requisições (depois da estabilização)

Ordem decidida: **1º tela Usuários · 2º sidebar de Semáforos**; depois GOS/endereço e 13.2.1.

1. **Tela "Usuários" (13.3)** — proposta conservadora **aguardando aprovação**:
   - `nit_admins/{chave}: true` só pelo console (dono = Cristiano) — **aprovado**.
   - ADM cadastra, muda nome/turno, desativa/reativa usuário comum. Ninguém apaga (`ativo: false`).
   - ADM **não** grava cadastro de outro ADM (regra recusa se `nit_admins/$chave` existe).
   - `usuarios_log` só acrescenta (quem, quando, o quê, usuário afetado).
   - Turnos aceitos: `manha`, `tarde`, `noite`, `madrugada` — **aprovado**.
   - Começar com o Cristiano como único ADM (~1 semana); depois supervisor do setor + supervisora da noite.
   - Regras testadas no emulador oficial do Firebase antes da homologação.
2. **Sidebar de Semáforos** — especificação acordada (22/10):
   - ENTRADA (círculo + PROCESSAR) sempre visível.
   - SAÍDA: "último: data · hora" (último processamento de qualquer operador); totais Ocorrências · Pendentes · Normalizados; **Ver Relatório** + Incluir normalizados logo abaixo dos totais (nunca empurrado).
   - Bloco **CAUSAS DO DIA** (fundo neutro, todas as do dia, maior → menor, só as ocorridas) + **ATENDIDOS** VIA LIVRE (laranja) · AMC (azul) — confirmar no laboratório que o card guarda a passagem.
   - Pré-visualização **retirada**. Botão de recolher a sidebar de Semáforos **retirado** (forçar aberta e apagar `nit-sidebar-collapsed`). Reboques: sidebar fixa, não muda.
   - Relatório de saída (WhatsApp): cabeçalho com Furtos · Outros motivos · Investigando, como o CEMOB.
3. **Novo nome:** "Sistema de Gestão de Ocorrências Semafóricas (GOS)".
4. **Novo endereço no GitHub**, com o nome do Cristiano no final (organização no GitHub ou domínio próprio). Domínio novo precisa entrar nos domínios autorizados do Firebase Authentication; endereço antigo deve redirecionar.
5. **13.2.1:** hierarquia visual e ícone (padrão Font Awesome) do 📜 O QUE MUDOU; entrada de relatório de outro dia com a data certa; listar os códigos em "pendências de ontem"; não gravar "Nada mudou."; retenção do `auditoria/` (sugestão 7 dias, a decidir); "✓ COPIADO" no PERGUNTAR; texto do NIT-02 depois de USAR.
6. **Segurança de sessão (sem urgência):** PIN de sessão de 6 dígitos (conferido pelas regras), sessão de 6 h; filtro "minhas ações" no 📜. Decidir depois da estabilização.

---

## 5. Decisões e fatos confirmados com o responsável

- Relatório CEMOB conta por dia de calendário (00:01 → 00:00). Plantão da manhã começa 05:30; último turno encerra 21:30; **turno de madrugada pode existir** (aceito no cadastro).
- Turno dura 6 h (unidade); dobra = 12 h.
- "Sem necessidade" **não** é encerrado: continua em monitoramento e participa da herança.
- Normalizado de dia anterior não tem mais valor operacional para identidade.
- Planilha é **saída**; OPERANDO_CRUZAMENTO é preenchida ao arrastar o card (despacho).
- Prioridade: o motor funcionar sem bloquear a operação; erros não podem ser silenciosos.
- Um semáforo tem no máximo uma pendência; reincidência exige fim da anterior; normalizado que volta sem fim só por decisão humana; legado preservado e sinalizado.
- Normalização à mão é **provisória** até a fonte mandar o fim (vale o horário da fonte).
- Relatório de saída não leva marcações de "a confirmar" ("polui").
- Recolher colunas só à mão; quando a ⚠ DECIDIR aparece, as outras deslizam.
- Critérios universais: C1 proteger o já processado · C2 não criar erro novo · C3 operador desfaz a própria ação · C4 o NIT nunca para · C5 alerta proporcional ao impacto.
- Firebase no plano gratuito (100 conexões simultâneas — cada aba/aparelho conta; 1 GB; 10 GB/mês). Não alimentar o banco à toa.

---

## 6. Como retomar com uma IA (qualquer plano / fornecedor)

1. Envie: `CONTEXT.MD`, `AI-INSTRUCTIONS.md`, este `HANDOFF.md`, `MENSAGENS.md` e os arquivos do problema (normalmente `nit.js` e o relatório CEMOB envolvido).
2. Exija o protocolo do `AI-INSTRUCTIONS.md`: ler → localizar → plano (objetivo, arquivos, riscos, validação) → **aprovação explícita** → mudança mínima → validação → documentação.
3. Antes de homologar: rodar as baterias em `testes/` (`LEIA-ME.md`): 13.2, 13.1, classificação, causa, bateria, gravação e estresse. Resultado pior que o anterior = não seguir.
4. Publique com mensagem de commit descritiva e guarde os arquivos anteriores para rollback.

Documentos citados em conversas anteriores **que não existem no repositório**: `TESTES-ACEITACAO-CEMOB.md`, `AUDITOR-INTEGRIDADE-NIT-v1.0.md`, `ADR-008`, `ADR-009`, pasta `docs/adr/`. Não presuma o conteúdo deles.

---
---

# HISTÓRICO (registro cronológico — só acrescentar)

## 24/10/2026 (madrugada) — homologação relatório a relatório + ajustes autorizados

- Homologação 132homolog12, relatórios 1–8 gerados na conversa (hora errada, código sem zero, sem início, linha repetida, normalizado sem início, arrastos, normalizado à mão + fonte fecha, caso real 933/446 com o 902): **tudo conforme**. Falta: Parte 4 (duas janelas).
- "Autorizo" (01:41) para: NIT-36 linha repetida (azul, informativo); "Início:" vazio deixa de virar observação (ia ao banco/planilha; existia na produção); card que nasce normalizado não mostra ⏳ (existia na produção); **LINHA DO TEMPO** (novo visual do 📜, mesmo `auditoria/`). Bateria `testes/bateria-24-10.js` (4).
- Pedido novo: botão de excluir o nó do kanban (ADM) → 13.2.2, depende de nit_admins + regra + cópia de segurança.
- 09:00: NIT-10 reescrito ("⚠ X SAIU DO RELATÓRIO" + linha 3 "Continua pendente no painel até você decidir." + botão CONTINUA PENDENTE); "Correções de digitação (n)". Pacote 132homolog15; produção 13.2.1 montada em `entrega/producao-13.2.1` (aguarda autorizo).
- **24/10 16:22 — AUTORIZO para a produção (13.2.1 + 13.2.2 juntas, pacote `entrega/producao-13.2.2`, código = 132homolog21; regras de produção = regras da homologação aprovadas, porque as regras atuais das duas eram iguais). ADM: `nit_admins/cristianovlivre|gmail|com`. Homologação do botão ADM com relatórios reais: ok.**
- **13.2.2 (lab, 24/10 tarde):** botão ADM 🧹 LIMPAR PAINEL + ↩ RESTAURAR (BR-ADM-001), `testes/bateria-admin.js` (6). Falta: regras do Firebase (produção e homologação) — pedidas ao Cristiano; emulador oficial bloqueado aqui (download do Google recusado pela rede) → validar no *Rules Playground* do console. Base: `../nit.js.13.2.1-final`.
- **Glossário aprovado para a 13.3 (24/10, Cristiano):** CTA = setor que manda os relatórios (não "fonte"; CEMOB = a central integrada, 3 setores) · **relatório** = o que o CTA manda e o operador cola · **status** = o que o NIT gera para o grupo (STATUS SEMAFÓRICO; botão "Ver status") · **painel** = o quadro. "Erros da fonte" → "Erros no relatório". Base: Linguagem Ubíqua (DDD) e ISO 24495-1. A 13.2.1 sobe ainda com "fonte".
- **Painel (13.3, proposta):** sem coluna ⚠ DECIDIR — a decisão vai no próprio card (tarja com a placa + 2 botões); semáforo do status na lateral. Motivo: medido em Chromium, com a DECIDIR aberta NORMALIZADOS some da tela abaixo de ~1650 px (1366, 1440, 1600; e 1920 com zoom 125%) — defeito que já existe na produção 13.2.
- **Desafio lançado (13.3): avisos pelo impacto no relatório.** Proposta visual (canvas): 3 níveis MUDA O RELATÓRIO / MUDA UM DETALHE / SÓ PARA SABER; placar "RELATÓRIO CONFERE COM A CEMOB" × "DIFERENTE DA CEMOB · painel 7 · CEMOB 6 · 1 decisão"; cada aviso = título curto · efeito no relatório · ação; "Ver Relatório" com decisão pendente pergunta antes (DECIDIR / GERAR ASSIM MESMO). Aguardando aprovação.
- Backups: `../nit.js.antes-3pequenas`, `../nit.js.antes-linha-do-tempo`, `../nit.css.antes-linha-do-tempo`.

## 23/10/2026 (noite) — forçando duplicação (pedido: "tudo que afeta a contagem devemos corrigir")

- Nova bateria `testes/bateria-duplicacao.js` (sementes; erros reais da fonte + operador normalizando à mão pelos 3 caminhos, arrastando de volta, processando durante o "desfazer", 2 janelas). Confere depois de cada relatório correto: um card por ocorrência, números do painel = fonte, saída = fonte.
- 8 defeitos achados (todos existem na produção 13.2) e corrigidos — BR-DEC-005: código sem o zero; linha sem início de normalizado; card sem início nascido normalizado (_SI, _SI_2…); linha repetida; início corrigido de normalizado (fechado ou voltando aberto); normalizado à mão com início corrigido; linha encerrada sem início (apagava o início do pendente / abria card).
- Casos fixos: `testes/bateria-duplicacao-casos.js` (14; na produção 11 falham). Homologação: `testes/gerar-duplicacao-homolog.js` (Parte 4, códigos 081–806).
- 📜: "Hora lida com correção" só na 1ª vez; nova linha "ℹ Código lido com correção".
- Backup antes: `../nit.js.antes-duplicacao`.
- Rodadas: 150 sequências de duplicação (≈2.300 relatórios, ≈1.400 ações do operador) sem duplicação; estresse 80 sementes ok; todas as baterias ok. Única diferença que sobra: quando o NIT **pergunta** ("não veio") e o operador manda MANTER — decisão dele.
- Pacote **132homolog12** (relatórios de 24/10): Partes 1–3 regeneradas + Parte 4 (duplicação).

## 23/10/2026 — dia real reprocessado no laboratório

- 23 relatórios reais (00:20–17:45) em `testes/dados/dia-23-10/`, teste `testes/bateria-dia-23-10.js` (com 933 à mão 08:33 e 446 à mão 11:43, como no dia).
- **Produção (13.2):** reproduz o problema do dia — 446 e 933 ficam duplicados; painel 23 normalizados contra 21 da CEMOB; relatório de saída com 24 linhas (446 e 933 duas vezes). Avisos "sem hora" do 446/933 em 11 relatórios.
- **Laboratório (13.2.1):** tudo confere — painel igual à CEMOB nos 23 relatórios, sem duplicados, saída com 22 linhas, 933 06:50–08:15 e 446 06:50–11:41.
- Diferenças esperadas: r08 017 voltou atrás (NIT-11, painel segura até a fonte mandar o fim); 821 PGV em Sem necessidade; 199/350/1106 com dois eventos reais (03:15 e 10:00).

## 09–12/10/2026 — entregue (antes da 13.1)

**Aviso de data do plantão (TODO-030).** Antes de gravar, se a data do cabeçalho do relatório ≠ hoje, o NIT avisa. Confirmar processa como antes; Cancelar não grava nada. Origem: incidente de 09/10, cabeçalho `13/09/2026` escondeu 26 cards.

**Conferência pós-processamento v2 (TODO-026).** Depois de processar, compara relatório × painel e informa, sem alterar nada:

```text
no relatório, fora do painel       → outra ocorrência do mesmo semáforo ocupa o lugar (cardHerdado)
início diferente do painel          → o NIT manteve o início antigo
sem data/hora de início             → identidade provisória
no painel, fora do relatório        → caso 1430
situação diferente                  → normalizado que volta pendente (ou o inverso)
registradas com outra data          → não aparecem no painel de hoje
```

Mensagens no formato do CEMOB: `🚦 código 🚦 endereço ● problema ● Início` + "O NIT identificou que… Verifique… no relatório".

**Bateria de testes (`testes/`).** Ver `testes/LEIA-ME.md`. Linha de base: `PASSOU 8 · PARCIAL 3 · FALHOU 7 · NÃO IMPLEMENTADO 4`.

---

## 14–16/10/2026 — NIT 13.1 em laboratório (publicada em 21/10/2026)

Regra aprovada: **um semáforo, uma pendência** (BUSINESS-RULES BR-CON-010 a 018). Implementação em laboratório:

- `_classificarLinhas` (somente leitura): decide cada linha olhando o relatório inteiro e os cards, em ordem de horário.
- `_cargaInicial` e `_reprocessar` aplicam essa classificação (substitui `cardHerdado`); conferência reclassifica o estado gravado.
- Correção de horário mantém a chave do card (`inicio`, `inicioAnterior`, `aliases/{id}`); sem início → ID fixo `codigo_SIddmmaaaa`.
- Testes: `testes/bateria-13-1.js` (29 cenários integrados), `testes/classificacao-13-1.js` (32 verificações), `testes/bateria.js` atualizada.
- Achado com relatório real (09/10, semáforo 323): o motor atual perde a pendência quando a anterior ainda está pendente e a reincidência chega no mesmo relatório. A conferência v2 (produção) já detecta; a 13.1 corrige.
- BR-CON-017 decidida em 15/10/2026 (retificação com fim no mesmo card, CONTRATO §13; T07 passa).
- 16/10/2026: homologação com dois operadores (projeto `nit-homologacao`, repositório `nit-homologacao`, GitHub Pages) — 4 testes passaram: sincronização, correção de horário, reincidência sem perda (caso 323), processamento simultâneo.
- 16/10/2026: indicador de gravação (Mudança 6) em laboratório — "✓ Tudo salvo" / "⏳ aguardando envio" / "⚠️ Semáforo X não foi salvo"; aviso ao fechar a aba com fila; último relatório do dia guardado no computador com botão "Recuperar". Bateria `testes/bateria-gravacao.js` (7/7).
- Pendente: teste de gravação na homologação (desligar a rede); botões da 13.2; revisão de todos os textos de alerta.
- 16/10/2026 (noite): análise dos relatórios reais e da planilha. Corrigido em laboratório: (1) causa e problema corrigidos não chegavam à tela do outro operador; (2) causas fora da lista fixa viravam "N/I" (MODERNIZAÇÃO, ABALROAMENTO, ACOMPANHAMENTO) — agora vale a causa escrita pela fonte; (3) relatório de saída: normalizado mostra início e fim ("16/10 07:14 às 10:46"; dias diferentes: "15/10 14:00 às 16/10 00:01"). Bateria `testes/bateria-causa.js` (4/4, inclui os relatórios reais de 16/10).
- Incidente 16/10/2026: a fonte trocou o 973 por 025 (erro humano) e o operador precisou apagar o kanban para continuar. Na 13.1 isso não bloqueia (a conferência mostra os dois; nada é decidido sozinho); a 13.2 dá ao operador o "Retirar do painel".
- Planilha (pós-entrega): causa congelada na primeira versão; linhas duplicadas quando a fonte corrige a data do início (602, 291, 1103, 887 em 16/10); 887 de 13/10 três vezes; duração > 24 h exibida como "01/01 02:14".
- Registrado a pedido do responsável (tratar em momento oportuno): **relatório de saída** — normalizados aparecem com "Desde" (início) e sem o horário de fim; toast curto demais e aviso de horário corrigido duplicado.
- Achado (16/10/2026): as regras do Firebase não têm o nó `recursos/` — a gravação de `recursos/equipes` (aprendizado automático de equipes) é recusada em produção, em silêncio. Avaliar na 13.3 junto com as regras de `usuarios_autorizados`.

## 14/10/2026 — defeitos do motor antes da 13.1 (corrigidos/sinalizados na 13.1 e 13.2)

| Teste | Defeito | Efeito para o operador | Causa no código |
|---|---|---|---|
| T10b, T06, T12 | **Herança só por código** | duas falhas do mesmo semáforo viram uma; painel fica 1 abaixo do CEMOB | `_reprocessar()` → `cardHerdado` (pega o 1º pendente do mesmo código) |
| T08, T09 | **Normalizado que volta sem Fim é ignorado** | painel mostra normalizada; CEMOB diz pendente | `_reprocessar()` não trata `existente.normalizado && status PENDENTE` |
| T13, T14 | **Ocorrência que sai do relatório continua no painel** | painel acima do CEMOB | não há reconciliação de ausentes |
| T02, T20 | **`eventoId` com `Date.now()` sem Início** | identidade muda a cada processamento | `gerarEventoId()` (nit.js) |
| T15–T18 | Guardião / decisão humana / reversão | — | não implementados (TODO-021 a 024) |

Hoje a conferência v2 **mostra** todos esses casos ao operador. Na 13.1 (laboratório): T06, T10b, T12, T02, T20 corrigidos; T08/T09 e T13/T14 ficam sinalizados por regra (decisão humana na 13.2); T07 corrigido (BR-CON-017).

---

## 14/10/2026 — próximos passos da época (superados)

1. **Corrigir `cardHerdado` (T10b).** Diagnóstico de 21/09 + T10b provam a causa. Auditoria de impacto operacional (equipe/VT/histórico) já feita no diagnóstico. Rodar a bateria antes/depois.
2. **Decidir o conflito documental `NORMALIZADO → PENDENTE`:** `BUSINESS-RULES` BR-NOR-007 diz CONTRATO; `AI-INSTRUCTIONS` §6.3/§9 diz VALIDAR. Sem essa decisão, T08/T09 não podem ser corrigidos.
3. **`eventoId` sem Início (T02/T20).** Havia correção em laboratório (44/44 testes, conversa no ChatGPT) **não recuperada**; refazer a partir do caso real (SCNs 584/1118).
4. TODO-031 (aviso de virada depende do navegador) e TODO-032 (sinal de herança dura 3 s).
5. TODO-017: a v10 não tem Firebase (confirmado 14/10/2026); resta definir o procedimento de volta da contingência (pós-entrega).

Fora do motor, registrados para depois: duração na planilha ignora troca de dia (13/09 07:28 → 14/09 08:35 gravado como 01:07:00); retenção/limpeza do `/kanban` (exige decisão/ADR; limpeza manual continua); botão "Copiar alerta" para enviar ao CEMOB.

---

## 14/10/2026 — decisões da época (versão atual na seção 5 acima)

- Relatório CEMOB conta por dia de calendário (00:01 → 00:00); hoje não há turno de madrugada.
- Último turno encerra 21:30; plantão da manhã começa 05:30.
- "Sem necessidade" **não** é encerrado: continua em monitoramento e participa da herança.
- Normalizado de dia anterior não tem mais valor operacional para identidade.
- Planilha é **saída**; OPERANDO_CRUZAMENTO é preenchida ao arrastar o card.
- Prioridade: o motor funcionar sem bloquear a operação; erros não podem ser silenciosos.
- 14/10/2026: um semáforo tem no máximo uma pendência; reincidência exige fim da anterior; marca REINC pela data do relatório; sobreposição não cria reincidência; normalizado que volta sem fim só por decisão humana; legado preservado e sinalizado.
- Critérios universais: C1 proteger o já processado · C2 não criar erro novo · C3 operador desfaz a própria ação · C4 o NIT nunca para · C5 alerta proporcional ao impacto.
- Planilha e contingência v10: tratadas depois da entrega.

---

## 14/10/2026 — como retomar (versão atual na seção 6 acima)

1. Envie: `CONTEXT.MD`, `AI-INSTRUCTIONS.md`, este `HANDOFF.md` e os arquivos do problema (normalmente `nit.js` e o relatório CEMOB envolvido).
2. Exija o protocolo do `AI-INSTRUCTIONS.md`: ler → localizar → plano (objetivo, arquivos, riscos, validação) → **aprovação explícita** → mudança mínima → validação → documentação.
3. Antes de publicar: `cd testes && npm test`. Resumo pior que a linha de base = não publicar.
4. Publique com mensagem de commit descritiva e guarde o `nit.js` anterior para rollback.

Documentos citados em conversas anteriores **que não existem no repositório**: `TESTES-ACEITACAO-CEMOB.md`, `AUDITOR-INTEGRIDADE-NIT-v1.0.md`, `ADR-008`, `ADR-009`, pasta `docs/adr/`. Não presuma o conteúdo deles.


## 17/10/2026 — 13.2 Mensagens do NIT (laboratório)

- Catálogo validado: `MENSAGENS.md` (NIT-01..34; acréscimos da implementação na seção 4b, a validar).
- `NitDecisoes`: cards âmbar no topo (MANTER / TIRAR / REABRIR / 📋 PERGUNTAR), confirmação com totais e DESFAZER.
  TIRAR não apaga: grava `retirado` no card; DESFAZER limpa. Decisões em `decisoes/{NIT-xx}`, perguntas em `perguntas/{sig}` (mesmo nó `kanban`, sem regra nova).
- Conferência continua só leitura; ganhou a detecção "fim antes do início" (NIT-13). `_classificarLinhas` inalterada.
- `NitGravacao`: textos NIT-30..34; NIT-34 para PERMISSION_DENIED em kanban/meta/historico/relatorios/auditoria. Botão "Recuperar último relatório" removido.
- Harness: `push()` do Firebase falso não resolve mais com a própria referência (travava a promessa); `controle.codigoRecusa`.
- Limitação conhecida: os cards de decisão vêm do último relatório processado **naquela janela**; se o outro operador processa um relatório mais novo, a lista desta janela só se atualiza quando ela processar também (decisões e perguntas do outro operador já aparecem na hora).

### Estado em 17/10/2026 02:00 — homologação funcional 13.2 (132homolog3)
- Cristiano subiu e testou h1→h4 com dois operadores: funcionando. Coluna ⚠ DECIDIR, recolher/expandir (DECIDIR e SEM NECESSIDADE), NIT-02 com destaque no CANCELAR.
- Pendências antes de produção:
  1. Bateria de estresse "sentir na pele": todas as situações, sequências longas, dois operadores, rede ruim, relatórios reais do dia.
  2. Defeito do motor (13.1): fim corrigido pela fonte não atualiza card já normalizado (468: 09:30 → 10:30). Precisa de autorização; proposta: fim novo + fimAnterior + etiqueta "⟲ fim corrigido".
  3. Etapa visual separada (auditoria de UI 17/10): card neutro com borda âmbar, botões em 3 níveis, título menor, DECIDIR mais larga, contraste WCAG AA medido, prints 1366/1600/1920, estética console.
  4. Validar acréscimos de texto da seção 4b do MENSAGENS.md.
  5. Limitação: lista de decisões de uma janela não se atualiza quando outro operador processa relatório mais novo.
- Depois: publicação (autorização), 13.3 (usuários + regras Firebase), planilha, contingência v10.


### 18/10/2026 — fim corrigido + bateria de estresse
- Autorizado e feito: fim corrigido pela fonte atualiza card normalizado (mesmo início), guarda `fimAnterior`, etiqueta "⟲ fim corrigido". Fim antes do início não é aplicado (NIT-13 avisa).
- Bateria de estresse (`testes/bateria-estresse.js` + `estresse-mundo.js`): dia simulado 06:00→02:00 com dois operadores + sequências aleatórias com cliques e rede. Regras R1–R10 a cada passo; falha grava semente/sequência em `estresse-falhas.json`. `SEMENTES=4,11 node bateria-estresse.js 0 30` reproduz.
- Defeitos achados e corrigidos: (1) DESFAZER do REABRIR apagava o fim de card que nasceu normalizado; (2) REABRIR criava 2 pendentes quando o semáforo já tinha outra pendência (agora o botão não aparece).
- Comportamento correto confirmado: pendência cujo fim só saiu no relatório de ontem (depois do último relatório processado) → o relatório de hoje não a fecha → NIT-10 pergunta.
- 19/10: autorizados e feitos — linha sem início não apaga início conhecido (BR-CON-020); id sem início não colide (BR-CON-021); NIT-11 MANTER esquecido quando a fonte devolve o fim (BR-DEC-001).
- `testes/gerar-turno.js`: gera turno de 15 relatórios + roteiro com resultado esperado (homologação manual).

### 19/10/2026 — anotações da homologação manual (corrigir em lote ao fim dos testes)
1. NIT-10 (não veio): trocar MANTER/TIRAR por botões de ESTADO DO SEMÁFORO.
   - Estava pendente: [PENDENTE] · [NORMALIZOU] · [EXCLUIR] · 📋 PERGUNTAR. Estava normalizado: [NORMALIZADO] · [EXCLUIR] · 📋.
   - NORMALIZOU abre a janela de normalizar existente (hora do fim informada pelo operador).
   - EXCLUIR = retirar (soft) + DESFAZER; confirmação "✓ {cod} EXCLUÍDO DO PAINEL."
2. Regra do Cristiano: **o relatório é a verdade; ação manual só destrava.** Normalização manual (NORMALIZOU)
   é refeita pelo relatório: se o relatório seguinte ainda traz a linha aberta, o card volta a pendente sozinho
   (aviso ℹ); se traz o fim, o fim do relatório substitui o manual. (Diferente do BR-NOR-007, que vale para
   normalização que veio DO relatório.)
3. EXCLUIR: avaliar limpeza dos cards excluídos (retirados) no dia seguinte — hoje ficam no banco ocultos
   (necessário para DESFAZER, auditoria e para não ressuscitar card quebrado com gravação atrasada de outro operador).
4. NIT-12 (veio 2 vezes) vira AZUL ℹ: não conta em "esperam sua resposta", não acende "RELATÓRIO ALTERADO!".
   Texto: "ℹ {cod} VEIO 2 VEZES · Pendente às {h1} e às {h2}. Nada a fazer: o NIT ficou com {h1}. Some quando a fonte corrigir."
   Pergunta (opcional): "O {cod} aparece 2 vezes como pendente ({h1} e {h2}). O início certo é {h1} ou {h2}?"
5. **Diário consultável (prioridade logo após os testes):** os avisos ℹ somem em 8 s e o operador não viu.
   Criar um "📜 O QUE MUDOU" por processamento, consultável a qualquer hora: novos, normalizados,
   apagou de novo, resolvidos, início/fim corrigidos pela fonte, erros da fonte (não veio, 2 vezes,
   sem início, horário não fecha) e decisões do operador (quem, quando, DESFAZER). Gravar em
   `auditoria/` (regra já existe) para os dois operadores verem. Pedido do Cristiano: dá controle ao operador.
6. Relatório de saída repete o erro da fonte (108 "08:00 às 07:40"). Avaliar marcar "⚠ a confirmar"
   enquanto o NIT-13 estiver aberto.
7. NIT-11 sem REABRIR (já há outra pendência) precisa EXPLICAR no card, não esconder em silêncio:
   linha extra "Já existe outra pendência do {cod}, a das {h}. Por isso não dá para reabrir esta."
   Pergunta: "O {cod} aparece pendente às {h_antiga} e às {h_nova}. A das {h_antiga} não normalizou às {fim}?"
8. NIT-11 deixar claro que é a MESMA ocorrência "desnormalizada", não reincidência:
   "⚠ 110 VOLTOU ATRÁS" · "Mesma ocorrência (início 08:10). Normalizou às 09:50 e agora veio de novo como pendente. Não é uma nova falha."
9. Relatório de saída: enquanto houver decisão aberta (NIT-11/NIT-13), marcar a linha "⚠ a confirmar"
   (ex.: 110 sai normalizado enquanto a fonte diz pendente). Junta com o item 6.
10. Ao clicar "Ver Relatório" com decisão aberta: aviso SEM bloquear —
    "⚠ 110 ainda espera a fonte. O relatório pode sair diferente do da fonte. [ESPERAR] [GERAR ASSIM MESMO]";
    gerando assim mesmo, a linha sai "⚠ a confirmar" (itens 6 e 9).
11. Coluna ⚠ DECIDIR compartilhada: hoje cada janela monta a sua lista ao processar (o estado PERGUNTADO,
    decisões e EXCLUIR já sincronizam na hora). Fazer a lista vir do último relatório processado por QUALQUER
    operador (gravado no banco), para o B ver os cards sem precisar processar. Resolve a limitação conhecida.
12. Cards ficam estreitos quando a ⚠ DECIDIR aparece (7 colunas). Boa prática (Trello/Jira/painéis de operação):
    a) coluna VAZIA recolhe sozinha para a faixa de 36px (VIA LIVRE/AMC/SEM NECESSIDADE com 0) e abre sozinha quando chega card;
    b) largura mínima de coluna (~230px) — se faltar espaço, rolagem lateral em vez de espremer;
    c) ⚠ DECIDIR recolhe sozinha quando só restam perguntas já feitas (só ⏳ ESPERANDO A FONTE), mostrando o número.

### 20/10/2026 — lote da homologação aplicado no laboratório (132homolog6)
Feitos: 1 (botões do não veio), 4 (NIT-12 azul), 5 (📜 O QUE MUDOU em auditoria/{ddmmaaaa}), 7 e 8 (NIT-11 "VOLTOU ATRÁS" + explicação sem REABRIR),
10 (lembrete ao gerar relatório, sem marcar o relatório — item 6/9 recusado pelo Cristiano: "polui"), 11 (DECIDIR compartilhada via meta/decisoes_ativas),
12 (colunas vazias recolhem sozinhas, largura mínima 230px, DECIDIR recolhe quando só há perguntas feitas), 3 (excluídos apagados no dia seguinte).
Extra achado no estresse: DESFAZER depois que o relatório do outro operador já mudou o card sobrescrevia o estado → agora "ℹ {cod} JÁ FOI ATUALIZADO PELO RELATÓRIO. Nada a desfazer."
PENDENTE de decisão: item 2 (relatório refaz normalização manual) — aguardando resposta sobre a planilha e o vai-e-volta.
Testes: 13.2 29/29 · 13.1 33 · classificação 33 · causa 4 · bateria 18 (+4 N/I) · gravação 6 · estresse 210 sementes + dia simulado sem quebra.

### 20/10/2026 — mudanças após o teste do 132homolog6 (132homolog7)
- Colunas: o recolher automático foi RETIRADO (Cristiano: "pode ser feito manualmente. Melhor apenas deslizar as colunas"). Todas recolhem à mão; título da recolhida no alto; DECIDIR chega e as outras deslizam (minmax 230px). Item 12a/12c revogados.
- Item 2 resolvido: normalização manual provisória (BR-DEC-002, NIT-17, etiqueta ✋). Desenho respondido com "bom." — tratado como aprovação.
- Bug achado: janela de normalizar sugeria a data de AMANHÃ depois das 21h (data em UTC) → agora data local.
- Testes: 13.2 31/31 · 13.1 32 + C14 (relatório real, pulado sem o arquivo) · classificação 33 · causa 3 + K4 (pulado sem os arquivos) · bateria 18 (+4 N/I) · gravação 6 · estresse 210 sementes + dia simulado (5290 passos, 2916 relatórios, 765 cliques) sem quebra · roteiro manual `gerar-mudancas.js` conferido.

### 20/10/2026 — etapa visual da 13.2 (132homolog8)
Critérios: auditoria de UI 17/10 (item 3 acima) + medição axe/WCAG 2.2 AA (Cristiano: sem precisar do arquivo da auditoria).
- Cards de decisão: fundo neutro + borda de cor (âmbar decide, azul só para saber); título na cor do nível.
- Botões em 3 níveis: respostas (contorno claro, 36px) · EXCLUIR (contorno vermelho) · 📋 PERGUNTAR (texto, linha própria). DESFAZER com contorno.
- ⚠ DECIDIR mais larga: minmax(300px, 1.3fr).
- Fonte mínima 12px em todo o nit.css (67 declarações de 8,5–11,5px) e nos estilos inline do index.
- Contraste: "Ver Relatório" e demais .btn-primario 3,67:1 → #2563eb 5,2:1. Campo do relatório com aria-label.
- Alvos: checkbox 18px, seta de recolher 24px, contadores Ocorrências/Pendentes/Normalizados em caixa normal (não cortam).
- Medição: axe 0 violações em 1366/1600/1920 (antes: 2 — contraste e campo sem rótulo); 0 textos < 12px (antes: 42).
- Testes: todas as baterias iguais (13.2 31/31…), roteiro gerar-mudancas conferido.
- 20/10 13:46: Cristiano testou o 132homolog8 na homologação — passou. Vai testar com relatórios reais na empresa; decide a produção à noite.
- 20/10 22:52: teste real (dia tranquilo) — contagens bateram. Regras do Firebase de produção conferidas (meta e auditoria liberados). Pacote producao-13.2 pronto (= 132homolog8 + index de produção com ?v=20261020-132; volta/ = commit 33fbec4). Aguardando "autorizo".
- Depois da produção (13.2.1): hierarquia visual do 📜 O QUE MUDOU; não gravar "Nada mudou."; retenção do auditoria/ (dias a definir pelo Cristiano, sugestão 7).
- 21/10 00:01: Cristiano vai subir a produção. Teste essencial em produção: `gerar-producao.js` (semáforos 9901–9907, endereço "TESTE NIT — APAGAR"; aceita o último relatório real para levar as pendências reais). Limpeza no console depois. Ícone do 📜 O QUE MUDOU fora do padrão de ícones do NIT → ajustar depois (13.2.1).
- 21/10 00:10: teste de virada (dia + turno) em produção com o kanban zerado: `gerar-virada.js` (relatório atrasado de ontem → USAR; turno A; Sair; turno B em janela nova).
- Achado (13.2.1, texto a validar): depois de USAR um relatório de outro dia, a ⚠ DECIDIR diz só "⚠ ESTE RELATÓRIO É DE 20/10. Hoje é 21/10." — a versão anterior explicava que os cards "não aparecem no painel de hoje". Proposta: linha 2 "Hoje é 21/10. Guardei {n} semáforos com a data de 20/10: eles não aparecem no painel de hoje." Comportamento (cards de outro dia ocultos) é o mesmo da produção anterior.

### 21/10/2026 — publicação e achados no teste em produção (registro que faltava)
- 13.1 + 13.2 publicadas na madrugada de 21/10 (pacote producao-13.2; nit.js/nit.css = 132homolog8; ?v=20261020-132).
- Testes em produção: `gerar-producao.js` (00:09) e `gerar-virada.js` (00:17–00:21) — contagens e relatório de saída corretos, inclusive na virada do dia.
- **O teste chegou à planilha**: o exportador real (atualiza `cursor_exportacao/cliente_b`, visto às 00:20:30) leu os cards 990x. Linhas 2001–2016 (e 2000, relatório de homologação colado e despachado) apagadas à mão. Teste em produção também chega à planilha, não só pelo despacho.
- **Duplicação na planilha**: pendência que atravessa o dia gera 2 linhas (ver seção 3).
- Kanban de produção apagado pelo Cristiano para o teste (pendências reais 452/871 voltaram pelo relatório da manhã, sem equipe/histórico); `historico` e `auditoria` apagados.

### 21/10/2026 — 🏁 marco: chegam as primeiras requisições dos usuários
Primeiro dia da 13.1 + 13.2 em produção; os usuários começaram a pedir melhorias. Todas seguem laboratório → homologação → produção (regra sem exceção, reafirmada pelo Cristiano).
Fila de requisições:
1. **Sidebar — pré-visualização do relatório maior** (em espera): botão Ver Relatório acima da pré-visualização (nunca fora da tela); a caixa ocupa o espaço até o fim da sidebar; no alto, a contagem como no cabeçalho do CEMOB (Pendentes · Furtos · Outros motivos · Investigando · Normalizados). Dúvidas abertas: o texto do relatório continua abaixo? o relatório de saída (WhatsApp) fica igual?
2. **Novo nome:** "Sistema de Gestão de Ocorrências Semafóricas (GOS)".
3. **Novo endereço no GitHub** (hoje https://crisstiano07.github.io/sistemaintegrado/): pedido "se quiser manter teu nome, sem problemas, mas deixa tipo no final". Atenção: o domínio novo precisa entrar nos domínios autorizados do Firebase Authentication, senão o login Google falha.
4. **Tela "Usuários" (13.3):** proposta de regras enviada (nit_admins só pelo console; ADM grava usuarios_autorizados; ninguém apaga; validação nome/turno/ativo). Aguardando: aprovar nit_admins; turnos (manha/tarde/noite confirmados — tarde visto em T. Oliveira; madrugada?); quem mais é ADM.
- Cadastros manuais pelo console em 21/10: T. Oliveira (tarde), Junior (chave com ponto corrigida para junior|abl1974|gmail|com).

### 22/10/2026 00:16 — pausa (decisões em aberto)
- Ordem decidida: 1º tela Usuários (13.3), 2º sidebar de Semáforos.
- Usuários — proposta conservadora AGUARDANDO aprovação: nit_admins só pelo console (dono = Cristiano); ADM não grava cadastro de outro ADM; ninguém apaga; usuarios_log só acrescenta; ADM cadastra/edita nome-turno/desativa/reativa comuns; começar com Cristiano como único ADM por ~1 semana, depois supervisor do setor + supervisora da noite. Turnos: manha, tarde, noite, madrugada. nit_admins aprovado.
- Sidebar (especificação acordada): ENTRADA sempre visível; SAÍDA com "último: data · hora" (último processamento de qualquer operador), totais, Ver Relatório + Incluir normalizados logo abaixo dos totais; bloco CAUSAS DO DIA (fundo neutro, todas as do dia, maior→menor, só as ocorridas) + ATENDIDOS VIA LIVRE (laranja) · AMC (azul) — confirmar no lab que o card guarda a passagem; pré-visualização RETIRADA; botão de recolher a sidebar de Semáforos RETIRADO (forçar aberta e apagar nit-sidebar-collapsed). Reboques: sidebar fixa, não muda. Relatório de saída: cabeçalho com Furtos · Outros motivos · Investigando (como o CEMOB).

### 22/10/2026 — caso "Cristiano" nas ações do Fabiano: resolvido + período de estabilização
- Causa: meta/sessao tinha email fabianolv33 + operador "Cristiano" na mesma gravação → no login do Fabiano o cadastro dele dava nome "Cristiano" (ou sem nome, caindo no nome da conta Google). O nome é lido só no login: a sessão aberta seguiu assinando "Cristiano" mesmo depois de corrigido. Ninguém usou a conta do Cristiano. Cadastro corrigido; Fabiano precisa sair/entrar.
- Fila (depois da estabilização): nome do operador atualizado ao vivo (ouvir o próprio cadastro); campos operador/turno no child_changed; turnos com grafias diferentes (manha/manhã/"manhã ") → padronizar; PIN/sessão por turno como opção futura (sem urgência).
- DECISÃO (Cristiano, 22/10 23:39): pausar novas implementações até o Sistema se mostrar estável em produção (usuários novos, turnos). Exceção: defeito que trave ou erre a operação — mesmo assim lab → homologação → produção.

### 23/10/2026 — v10: endereço antigo leva ao NIT; v10 vira contingência
- Risco: a v10 grava só no navegador; quem usa ela produz um painel paralelo invisível ao NIT.
- Achado: o redirecionamento feito antes nunca foi gravado no GitHub (nem no histórico dos dois repositórios); `versao-antiga-v10` = cópia idêntica da main (commit c86f953, 18/05/2026) — fica como backup congelado.
- Pacote `v10-aviso`: raiz (index/supervisor/404) → NIT atual em 3 s; `contingencia/` = v10 intacta + faixa "MODO CONTINGÊNCIA", noindex. Testado no Chromium (4 caminhos antigos redirecionam; v10 e supervisor abrem sem erro de JS). Chaves de localStorage da v10 (`gerador-premium-v10.0-*`) e do NIT (`nit-v12-*`) não colidem; só `historicoDeAcoes_v1` é comum.
- Aprimorar a contingência (procedimento de volta, reprocessar no NIT) fica para depois — entre as primeiras prioridades.
- 23/10 09:18: homologação no repositório `teste-aviso-v10` passou (contingência processou o relatório de teste: 3 pendentes, 2 normalizados, faixa no topo). Próximo: aplicar na main do `nit-nucleo-inteligencia-trafego`, apagar o repositório de teste, trocar favoritos no setor. Futuro (momento oportuno): contingência com a cara do NIT atual.
- 23/10 09:35: PRODUÇÃO — main do `nit-nucleo-inteligencia-trafego` com os 6 arquivos (commits 9f5561a + d9ed2f2), conferidos byte a byte com o pacote. Endereço antigo leva ao NIT; contingência em https://crisstiano07.github.io/nit-nucleo-inteligencia-trafego/contingencia/ (só para Cristiano e supervisores).
- Contingência — para depois (registrado pelo Cristiano, 23/10):
  1. Risco: usuário favorita o link da contingência e usa sem autorização (o link sozinho não impede).
  2. Levar o que foi processado na contingência para o NIT principal quando ele voltar (ex.: exportar os relatórios colados na v10 e reprocessar no NIT), facilitando a volta.
  3. Contingência com a cara do NIT atual.
- 23/10 10:00 — ACHADO supervisor: são dois apps diferentes. v10 `supervisor.html` (06–08/05) = protótipo mobile estilo WhatsApp, dados de exemplo, sem Firebase. NIT `sistemaintegrado/supervisor.html` (16–20/05) lê `ocorrencias` (sem regra no Firebase → leitura negada) e grava pelo Railway (backend migrado para Apps Script) → provavelmente não funciona. O redirecionamento do supervisor antigo leva hoje a essa página. Aguardando decisão: levar ao protótipo (endereço próprio, sem faixa) ou página "em construção".
- Cartão de contingência (PDF com QR): `entrega/cartao-contingencia/` — guardar no celular e dar cópia aos supervisores.
- 23/10 10:05: decisão — o endereço do supervisor da v10 volta a abrir o PROTÓTIPO (para mostrar ao supervisor). Pacote `v10-supervisor`: supervisor.html original + supervisor/index.html (barra no final) + README. Testado: /supervisor, /supervisor/, /supervisor.html → protótipo; raiz e links quebrados seguem levando ao NIT; contingência intacta.
- 23/10 10:26: PRODUÇÃO — supervisor de volta (commit 084f3b9). Os 7 arquivos da main conferidos byte a byte com os pacotes. Protótipo em …/nit-nucleo-inteligencia-trafego/supervisor (dados de exemplo).

### 23/10/2026 — 13.2.1: hora com erro de digitação (autorizado: "sim. autorizo")
- Caso real: 446 "Início: 23/10/2026 06.:50" → o NIT lia como SEM HORA DE INÍCIO (NIT-14 incomodando o operador; card mostrava "06."; relatório de saída sem "Desde"). Contagens já batiam; quando a fonte corrige, o mesmo card recebe o início (não duplica).
- Feito no laboratório: leitura tolerante (`Semaforo._lerDataHora`, BR-CON-022), NIT-14 "HORA DE INÍCIO ILEGÍVEL · Veio "…"" quando não dá para ler, linha "ℹ Hora lida com correção" no 📜.
- Testes: `testes/bateria-hora.js` (5/5, inclui o relatório real em `testes/dados/`); 13.2 31 · 13.1 32 · classificação 33 · causa 3 · bateria 18 (+4 N/I) · gravação 6 · roteiros mudanças/virada/produção/situações conferidos · estresse 210 sementes + dia simulado (5290 passos, 2916 relatórios, 765 cliques) sem quebra. Pacote 132homolog9 (roteiro `relatorios-hora-23-10/ROTEIRO-HORA.md`).
- Pedido do supervisor (ADM): botão de limpar o painel — motivo: solução rápida para evitar que relatório errado seja compartilhado; o operador avisa o supervisor e ele decide. A tratar depois desta correção.
- 23/10 13:30 — caso relatado pelo supervisor: 446 e 933 saíam 2 vezes no relatório de saída ("Normalizado 23/10 - 08:33" + "06:50 às 08:15"). 📜 do João Paulo: 07:01 933 sem hora → 08:12 "não veio" → 08:13 PENDENTE → 08:33 normalizado à mão → fonte 06:50–08:15. Causa: card SEM início normalizado à mão saía da lista de casáveis do motor. Reproduzido na versão de produção; corrigido no laboratório (BR-DEC-003). Também corrigido: com a fonte ainda mandando sem hora depois da normalização à mão, o NIT criava um pendente a mais.
- `testes/bateria-hora.js` agora 17 cenários (H1–H5 hora; P1–P12 provisório, inclui as sequências reais do 933 e do 446, dois operadores, REABRIR, fonte fechando depois do horário à mão, reincidência). Contra a versão de produção: 14 falham (os corrigidos), 3 passam (os que já funcionavam).
- Observação (a avaliar depois): às 07:01 e 08:12 o NIT perguntou "não veio" para 7 normalizados da madrugada (792, 084, 248, 017, 1105, 766, 462) que a fonte só listou mais tarde — ruído para o operador.
- Estresse com as duas correções: 210 sementes + dia simulado (5290 passos, 2916 relatórios, 765 cliques) sem quebra. Pacote 132homolog10 pronto (hora + provisório sem início); aguardando "autorizo" do Cristiano para a correção do motor (BR-DEC-003).
- 23/10 13:56: Cristiano autorizou a homologação ("vamos a homologação") — 132homolog10 entregue.
- 23/10 14:xx: roteiro amplo de homologação 13.2.1 (`testes/gerar-hora-homolog.js`, 8 passos, semáforos 601–609, duas janelas): horas tortas no início e no fim, sem hora, ilegível, normalização à mão com/sem início, fonte fechando antes/depois, REABRIR, não veio→PENDENTE, reincidência, dois operadores. Conferido no NIT do laboratório.
- 23/10 14:07 — pergunta do Cristiano: "normalização ocorre pelo botão, pelo arrastar e pelo relatório — está tudo previsto?" Achado: só o botão ✓ seguia a regra. **Central** não marcava normManual (VOLTOU ATRÁS; sem início → duplicava). **Arrastar para NORMALIZADOS** só trocava a coluna (banco PENDENTE sem fim; sem início → duplicava). **Arrastar de volta** deixava o banco NORMALIZADO. Antigos (antes da 13.2), expostos pela regra do provisório. Corrigido no laboratório (BR-DEC-004); arrastar normaliza na hora atual (decisão do Cristiano). Origem do arraste passa a ser a coluna real do card.
- `bateria-hora.js` 25 cenários (N1–N8: os 3 caminhos × com/sem início, arrastar de volta). Roteiro de homologação Parte 3 (`testes/gerar-caminhos-homolog.js`).
- Estresse com as três correções (hora, provisório sem início, caminhos de normalizar): 210 sementes + dia simulado sem quebra. Pacote 132homolog11 (substitui o 10): roteiros relatorios-hora-23-10 (partes 1–2), relatorios-13-2-1 (amplo, 8 passos) e relatorios-13-2-1-parte3 (arrastar/Central).
